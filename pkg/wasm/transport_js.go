//go:build js && wasm
// +build js,wasm

// Package wasm provides WebSocket transport for WASM clients.
package wasm

import (
	"encoding/json"
	"sync"
	"syscall/js"
	"time"
)

// Message types for WebSocket communication
const (
	MsgTypeState = "state"
	MsgTypeInput = "input"
	MsgTypePing  = "ping"
	MsgTypePong  = "pong"
)

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"timestamp"`
}

// InputPayload contains user input data
type InputPayload struct {
	Input string `json:"input"`
}

// WebSocketTransport implements Transport interface using JavaScript WebSocket API
type WebSocketTransport struct {
	ws          js.Value
	url         string
	connected   bool
	mu          sync.Mutex
	latestState *GameState
	stateMu     sync.RWMutex
	onMessage   js.Func
	onOpen      js.Func
	onClose     js.Func
	onError     js.Func
}

// NewWebSocketTransport creates a new WebSocket transport
func NewWebSocketTransport() *WebSocketTransport {
	return &WebSocketTransport{}
}

// Connect establishes connection to the server
func (t *WebSocketTransport) Connect(url string) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.connected {
		return nil
	}

	t.url = url

	// Create WebSocket using JavaScript API
	wsConstructor := js.Global().Get("WebSocket")
	t.ws = wsConstructor.New(url)

	// Set up event handlers
	t.setupEventHandlers()

	return nil
}

// setupEventHandlers sets up JavaScript event handlers for the WebSocket
func (t *WebSocketTransport) setupEventHandlers() {
	// onopen handler
	t.onOpen = js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		t.mu.Lock()
		t.connected = true
		t.mu.Unlock()
		return nil
	})
	t.ws.Set("onopen", t.onOpen)

	// onclose handler
	t.onClose = js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		t.mu.Lock()
		t.connected = false
		t.mu.Unlock()
		return nil
	})
	t.ws.Set("onclose", t.onClose)

	// onerror handler
	t.onError = js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		t.mu.Lock()
		t.connected = false
		t.mu.Unlock()
		return nil
	})
	t.ws.Set("onerror", t.onError)

	// onmessage handler
	t.onMessage = js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		if len(args) == 0 {
			return nil
		}
		event := args[0]
		data := event.Get("data").String()
		t.handleMessage(data)
		return nil
	})
	t.ws.Set("onmessage", t.onMessage)
}

// handleMessage processes an incoming WebSocket message
func (t *WebSocketTransport) handleMessage(data string) {
	var msg WebSocketMessage
	if err := json.Unmarshal([]byte(data), &msg); err != nil {
		return
	}

	switch msg.Type {
	case MsgTypeState:
		var state GameState
		if err := json.Unmarshal(msg.Payload, &state); err == nil {
			t.stateMu.Lock()
			t.latestState = &state
			t.stateMu.Unlock()
		}
	case MsgTypePing:
		// Respond with pong
		t.sendPong()
	}
}

// sendPong sends a pong response
func (t *WebSocketTransport) sendPong() {
	msg := WebSocketMessage{
		Type:      MsgTypePong,
		Timestamp: time.Now().UnixMilli(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	t.ws.Call("send", string(data))
}

// Disconnect closes the connection
func (t *WebSocketTransport) Disconnect() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.connected {
		return nil
	}

	t.ws.Call("close")
	t.connected = false

	// Release JavaScript functions
	t.onOpen.Release()
	t.onClose.Release()
	t.onError.Release()
	t.onMessage.Release()

	return nil
}

// SendInput sends user input to the server
func (t *WebSocketTransport) SendInput(input string) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.connected {
		return nil
	}

	payload, _ := json.Marshal(InputPayload{Input: input})
	msg := WebSocketMessage{
		Type:      MsgTypeInput,
		Payload:   payload,
		Timestamp: time.Now().UnixMilli(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	t.ws.Call("send", string(data))
	return nil
}

// GetLatestState returns the latest game state from the server
func (t *WebSocketTransport) GetLatestState() *GameState {
	t.stateMu.Lock()
	defer t.stateMu.Unlock()

	state := t.latestState
	t.latestState = nil
	return state
}

// IsConnected returns true if connected to the server
func (t *WebSocketTransport) IsConnected() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.connected
}
