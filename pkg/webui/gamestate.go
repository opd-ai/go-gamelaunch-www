// Package webui provides game state data types.
// Moved from: types.go
package webui

// Cell represents a single character cell with rendering attributes
// Moved from: view.go via types.go
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
// Moved from: view.go via types.go
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
// Moved from: view.go via types.go
type StateDiff struct {
	Version   uint64     `json:"version"`
	Changes   []CellDiff `json:"changes"`
	CursorX   int        `json:"cursor_x"`
	CursorY   int        `json:"cursor_y"`
	Timestamp int64      `json:"timestamp"`
}

// CellDiff represents a change to a specific cell
// Moved from: view.go via types.go
type CellDiff struct {
	X    int  `json:"x"`
	Y    int  `json:"y"`
	Cell Cell `json:"cell"`
}
