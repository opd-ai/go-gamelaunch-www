// Package transport provides WebSocket communication for game state synchronization.
package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// Message types for WebSocket communication
const (
	MsgTypeState      = "state"
	MsgTypeStateDiff  = "state_diff"
	MsgTypeInput      = "input"
	MsgTypePing       = "ping"
	MsgTypePong       = "pong"
	MsgTypeError      = "error"
	MsgTypeConnect    = "connect"
	MsgTypeDisconnect = "disconnect"
)

// Message represents a WebSocket message
type Message struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"timestamp"`
}

// StatePayload contains game state data
type StatePayload struct {
	Buffer    [][]Cell `json:"buffer"`
	Width     int      `json:"width"`
	Height    int      `json:"height"`
	CursorX   int      `json:"cursor_x"`
	CursorY   int      `json:"cursor_y"`
	Version   uint64   `json:"version"`
	Timestamp int64    `json:"timestamp"`
}

// Cell represents a terminal cell
type Cell struct {
	Char    string `json:"char"`
	FgColor string `json:"fg_color"`
	BgColor string `json:"bg_color"`
	Bold    bool   `json:"bold"`
	Inverse bool   `json:"inverse"`
	Blink   bool   `json:"blink"`
	TileX   int    `json:"tile_x,omitempty"`
	TileY   int    `json:"tile_y,omitempty"`
}

// InputPayload contains user input data
type InputPayload struct {
	Input string `json:"input"`
}

// ErrorPayload contains error information
type ErrorPayload struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Client represents a connected WebSocket client
type Client struct {
	conn    *websocket.Conn
	send    chan Message
	handler *Handler
	id      string
	version uint64
	mu      sync.Mutex
	ctx     context.Context
	cancel  context.CancelFunc
}

// Handler manages WebSocket connections
type Handler struct {
	clients      map[string]*Client
	clientsMu    sync.RWMutex
	onInput      func(clientID, input string) error
	onConnect    func(clientID string)
	onDisconnect func(clientID string)
	idCounter    uint64
	idMu         sync.Mutex
}

// NewHandler creates a new WebSocket handler
func NewHandler() *Handler {
	return &Handler{
		clients: make(map[string]*Client),
	}
}

// SetInputHandler sets the callback for user input
func (h *Handler) SetInputHandler(fn func(clientID, input string) error) {
	h.onInput = fn
}

// SetConnectHandler sets the callback for client connections
func (h *Handler) SetConnectHandler(fn func(clientID string)) {
	h.onConnect = fn
}

// SetDisconnectHandler sets the callback for client disconnections
func (h *Handler) SetDisconnectHandler(fn func(clientID string)) {
	h.onDisconnect = fn
}

// ServeHTTP implements http.Handler for WebSocket upgrades
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	h.handleConnection(r.Context(), conn)
}

// handleConnection manages a single WebSocket connection
func (h *Handler) handleConnection(ctx context.Context, conn *websocket.Conn) {
	clientCtx, cancel := context.WithCancel(ctx)

	client := &Client{
		conn:    conn,
		send:    make(chan Message, 256),
		handler: h,
		id:      h.generateClientID(),
		ctx:     clientCtx,
		cancel:  cancel,
	}

	h.registerClient(client)
	defer h.unregisterClient(client)

	// Start read and write goroutines
	go client.writePump()
	client.readPump()
}

// generateClientID generates a unique client ID
func (h *Handler) generateClientID() string {
	h.idMu.Lock()
	defer h.idMu.Unlock()
	h.idCounter++
	return fmt.Sprintf("client-%d-%d", time.Now().UnixNano(), h.idCounter)
}

// registerClient adds a client to the handler
func (h *Handler) registerClient(client *Client) {
	h.clientsMu.Lock()
	h.clients[client.id] = client
	h.clientsMu.Unlock()

	if h.onConnect != nil {
		h.onConnect(client.id)
	}
}

// unregisterClient removes a client from the handler
func (h *Handler) unregisterClient(client *Client) {
	h.clientsMu.Lock()
	delete(h.clients, client.id)
	h.clientsMu.Unlock()

	client.cancel()
	close(client.send)

	if h.onDisconnect != nil {
		h.onDisconnect(client.id)
	}
}

// BroadcastState sends state to all connected clients
func (h *Handler) BroadcastState(state *StatePayload) {
	payload, err := json.Marshal(state)
	if err != nil {
		return
	}

	msg := Message{
		Type:      MsgTypeState,
		Payload:   payload,
		Timestamp: time.Now().UnixMilli(),
	}

	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.send <- msg:
		default:
			// Client send buffer full, skip
		}
	}
}

// SendToClient sends a message to a specific client
func (h *Handler) SendToClient(clientID string, msg Message) error {
	h.clientsMu.RLock()
	client, ok := h.clients[clientID]
	h.clientsMu.RUnlock()

	if !ok {
		return fmt.Errorf("client not found: %s", clientID)
	}

	select {
	case client.send <- msg:
		return nil
	default:
		return fmt.Errorf("client send buffer full: %s", clientID)
	}
}

// GetClientCount returns the number of connected clients
func (h *Handler) GetClientCount() int {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	return len(h.clients)
}

// readPump handles incoming messages from the client
func (c *Client) readPump() {
	defer c.conn.Close(websocket.StatusNormalClosure, "")

	for {
		var msg Message
		err := wsjson.Read(c.ctx, c.conn, &msg)
		if err != nil {
			return
		}

		c.handleMessage(msg)
	}
}

// writePump handles outgoing messages to the client
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			if err := wsjson.Write(c.ctx, c.conn, msg); err != nil {
				return
			}
		case <-ticker.C:
			// Send ping
			msg := Message{
				Type:      MsgTypePing,
				Timestamp: time.Now().UnixMilli(),
			}
			if err := wsjson.Write(c.ctx, c.conn, msg); err != nil {
				return
			}
		case <-c.ctx.Done():
			return
		}
	}
}

// handleMessage processes an incoming message
func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case MsgTypeInput:
		var input InputPayload
		if err := json.Unmarshal(msg.Payload, &input); err == nil {
			if c.handler.onInput != nil {
				c.handler.onInput(c.id, input.Input)
			}
		}
	case MsgTypePong:
		// Client responded to ping
	}
}

// UpdateVersion updates the client's state version
func (c *Client) UpdateVersion(version uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.version = version
}

// GetVersion returns the client's current state version
func (c *Client) GetVersion() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.version
}
