// Package webui provides interface definitions for the webui package.
// This file contains only interface type definitions following Go best practices.
// All struct definitions have been moved to their respective dedicated files.
package webui

import (
	"context"
	"time"
)

// ViewRenderer defines the interface for game view rendering implementations
// This interface abstracts the rendering backend, allowing for different
// rendering strategies (web, terminal, etc.)
type ViewRenderer interface {
	// Init initializes the renderer
	Init() error

	// Render processes data and updates the display
	Render(data []byte) error

	// Clear clears the display
	Clear() error

	// SetSize updates the renderer dimensions
	SetSize(width, height int) error

	// GetSize returns current dimensions
	GetSize() (width, height int)

	// Close cleans up renderer resources
	Close() error
}

// StateProvider defines the interface for game state management
// This interface abstracts state tracking and change notification
type StateProvider interface {
	// GetCurrentState returns the current game state
	GetCurrentState() *GameState

	// GetCurrentVersion returns the current state version
	GetCurrentVersion() uint64

	// PollChanges waits for state changes since the given version
	PollChanges(clientVersion uint64, timeout time.Duration) (*StateDiff, error)

	// PollChangesWithContext waits for changes with context cancellation
	PollChangesWithContext(ctx context.Context, version uint64) (*StateDiff, error)
}

// RPCService defines the interface for RPC service implementations
// This interface standardizes RPC method signatures for Gorilla RPC integration
type RPCService interface {
	// ServiceName returns the name used for RPC registration
	ServiceName() string
}

// ColorProcessor defines the interface for color conversion implementations
// This interface abstracts ANSI color processing for different terminal modes
type ColorProcessor interface {
	// ProcessSGRParams processes SGR (Select Graphic Rendition) parameters
	ProcessSGRParams(params []string) (fgColor, bgColor string, bold, inverse, blink bool)
}
