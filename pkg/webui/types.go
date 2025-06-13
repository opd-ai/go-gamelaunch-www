// Package webui provides type definitions for the webui package.
// This file contains all interface and struct type definitions.
package webui

import (
	"encoding/json"
	"image"
	"net/http"
	"sync"
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

// WebView implements dgclient.View for web browser rendering
// Moved from: view.go
type WebView struct {
	mu           sync.RWMutex
	buffer       [][]Cell
	width        int
	height       int
	cursorX      int
	cursorY      int
	inputChan    chan []byte
	updateNotify chan struct{}
	stateManager *StateManager
	tileset      *TilesetConfig

	// ANSI parsing state - simplified with library integration
	currentFgColor string
	currentBgColor string
	currentBold    bool
	currentInverse bool
	currentBlink   bool
	escapeBuffer   []byte
	inEscapeSeq    bool

	// Color converter using fatih/color library
	colorConverter *ColorConverter
}

// StateManager manages game state versions and change tracking
// Moved from: state.go
type StateManager struct {
	mu           sync.RWMutex
	currentState *GameState
	version      uint64
	waiters      map[string]chan *StateDiff
	waitersMu    sync.Mutex
}

// ColorConverter handles ANSI color parsing and conversion using fatih/color library
// Moved from: color.go
type ColorConverter struct{}

// TilesetConfig represents a tileset configuration
// Moved from: tileset.go
type TilesetConfig struct {
	Name         string        `yaml:"name"`
	Version      string        `yaml:"version"`
	TileWidth    int           `yaml:"tile_width"`
	TileHeight   int           `yaml:"tile_height"`
	SourceImage  string        `yaml:"source_image"`
	Mappings     []TileMapping `yaml:"mappings"`
	SpecialTiles []SpecialTile `yaml:"special_tiles"`

	// Runtime data
	mappingIndex map[rune]*TileMapping
	imageData    image.Image
	basePath     string // Base path for resolving relative image paths
}

// TileMapping maps characters to tile coordinates
// Moved from: tileset.go
type TileMapping struct {
	Char    string `yaml:"char"`
	X       int    `yaml:"x"`
	Y       int    `yaml:"y"`
	FgColor string `yaml:"fg_color,omitempty"`
	BgColor string `yaml:"bg_color,omitempty"`

	// Runtime data
	charRune rune
}

// SpecialTile represents multi-tile entities
// Moved from: tileset.go
type SpecialTile struct {
	ID    string    `yaml:"id"`
	Tiles []TileRef `yaml:"tiles"`
}

// TileRef references a specific tile
// Moved from: tileset.go
type TileRef struct {
	X int `yaml:"x"`
	Y int `yaml:"y"`
}

// RPCRequest represents a JSON-RPC request
// Legacy types preserved for compatibility
// Moved from: rpc.go
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id"`
}

// RPCResponse represents a JSON-RPC response
// Moved from: rpc.go
type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

// RPCError represents a JSON-RPC error
// Moved from: rpc.go
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// RPCHandler maintains compatibility with existing code
// Moved from: rpc.go
type RPCHandler struct {
	webui     *WebUI
	rpcServer *rpc.Server
}

// GameService provides game-related RPC methods
// Service structs for Gorilla RPC
// Moved from: rpc.go
type GameService struct {
	handler *RPCHandler
}

// TilesetService provides tileset-related RPC methods
// Moved from: rpc.go
type TilesetService struct {
	handler *RPCHandler
}

// SessionService provides session-related RPC methods
// Moved from: rpc.go
type SessionService struct {
	handler *RPCHandler
}

// GamePollParams represents parameters for game polling
// Parameter types for RPC methods
// Moved from: rpc.go
type GamePollParams struct {
	Version uint64 `json:"version"`
	Timeout int    `json:"timeout,omitempty"`
}

// GameInputParams represents parameters for game input
// Moved from: rpc.go
type GameInputParams struct {
	Events []InputEvent `json:"events"`
}

// InputEvent represents a user input event
// Moved from: rpc.go
type InputEvent struct {
	Type      string `json:"type"`
	Key       string `json:"key,omitempty"`
	KeyCode   int    `json:"keyCode,omitempty"`
	Data      string `json:"data,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// Empty represents an empty parameter set
// Moved from: rpc.go
type Empty struct{}

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
