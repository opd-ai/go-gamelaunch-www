// Package webui provides type definitions for the webui package.
// This file contains all interface and struct type definitions.
package webui

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/rpc/v2"
)

// Cell represents a single character cell with rendering attributes
// Moved from: view.go
type Cell struct {
	Char    rune   `json:"char"`
	FgColor string `json:"fg_color"`
	BgColor string `json:"bg_color"`
	Bold    bool   `json:"bold"`
	Inverse bool   `json:"inverse"`
	Blink   bool   `json:"blink"`
	TileX   int    `json:"tile_x,omitempty"`
	TileY   int    `json:"tile_y,omitempty"`
	Changed bool   `json:"-"`
}

// GameState represents the current state of the game screen
// Moved from: view.go
type GameState struct {
	Buffer    [][]Cell `json:"buffer"`
	Width     int      `json:"width"`
	Height    int      `json:"height"`
	CursorX   int      `json:"cursor_x"`
	CursorY   int      `json:"cursor_y"`
	Version   uint64   `json:"version"`
	Timestamp int64    `json:"timestamp"`
}

// StateDiff represents changes between game states
// Moved from: view.go
type StateDiff struct {
	Version   uint64     `json:"version"`
	Changes   []CellDiff `json:"changes"`
	CursorX   int        `json:"cursor_x"`
	CursorY   int        `json:"cursor_y"`
	Timestamp int64      `json:"timestamp"`
}

// CellDiff represents a change to a specific cell
// Moved from: view.go
type CellDiff struct {
	X    int  `json:"x"`
	Y    int  `json:"y"`
	Cell Cell `json:"cell"`
}



// WebUIOptions contains configuration for WebUI
// Moved from: webui.go
type WebUIOptions struct {
	// View to use for rendering
	View *WebView

	// Tileset configuration
	TilesetPath string
	Tileset     *TilesetConfig

	// Server configuration
	ListenAddr  string
	PollTimeout time.Duration

	// CORS settings
	AllowOrigins []string

	// Static file serving
	StaticPath string // Optional: override embedded files
}

// WebUI provides a web-based interface for dgclient
// Moved from: webui.go
type WebUI struct {
	view       *WebView
	tileset    *TilesetConfig
	rpcHandler *RPCHandler
	mux        *http.ServeMux
	options    WebUIOptions
}
