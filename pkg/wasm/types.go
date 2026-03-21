// Package wasm provides types for the WASM game interface.
package wasm

// Cell represents a single terminal cell
type Cell struct {
	Char    rune   `json:"char"`
	FgColor string `json:"fg_color"`
	BgColor string `json:"bg_color"`
	Bold    bool   `json:"bold"`
	Inverse bool   `json:"inverse"`
	Blink   bool   `json:"blink"`
	TileX   int    `json:"tile_x,omitempty"`
	TileY   int    `json:"tile_y,omitempty"`
}

// GameState represents the complete game state
type GameState struct {
	Buffer    [][]Cell `json:"buffer"`
	Width     int      `json:"width"`
	Height    int      `json:"height"`
	CursorX   int      `json:"cursor_x"`
	CursorY   int      `json:"cursor_y"`
	Version   uint64   `json:"version"`
	Timestamp int64    `json:"timestamp"`
}

// Transport defines the interface for server communication
type Transport interface {
	// Connect establishes connection to the server
	Connect(url string) error

	// Disconnect closes the connection
	Disconnect() error

	// SendInput sends user input to the server
	SendInput(input string) error

	// GetLatestState returns the latest game state from the server
	// Returns nil if no new state is available
	GetLatestState() *GameState

	// IsConnected returns true if connected to the server
	IsConnected() bool
}
