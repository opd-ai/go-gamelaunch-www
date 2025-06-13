// Package webui provides RPC parameter and input event data types.
// Moved from: types.go (originally from rpc.go)
package webui

// GamePollParams represents parameters for game polling
// Parameter types for RPC methods
// Moved from: rpc.go via types.go
type GamePollParams struct {
	Version uint64 `json:"version"`
	Timeout int    `json:"timeout,omitempty"`
}

// GameInputParams represents parameters for game input
// Moved from: rpc.go via types.go
type GameInputParams struct {
	Events []InputEvent `json:"events"`
}

// InputEvent represents a user input event
// Moved from: rpc.go via types.go
type InputEvent struct {
	Type      string `json:"type"`
	Key       string `json:"key,omitempty"`
	KeyCode   int    `json:"keyCode,omitempty"`
	Data      string `json:"data,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// Empty represents an empty parameter set
// Moved from: rpc.go via types.go
type Empty struct{}
