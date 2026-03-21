//go:build js

// Package wasm provides an Ebitengine-based game interface for browser rendering.
// This package implements the ebiten.Game interface and provides real-time
// terminal-to-tile rendering for roguelike games in WebAssembly.
package wasm

import (
	"image/color"
	"sync"

	"github.com/hajimehoshi/ebiten/v2"
)

// GameConfig holds configuration for the game instance
type GameConfig struct {
	// Terminal dimensions
	Width  int
	Height int

	// Tile dimensions in pixels
	TileWidth  int
	TileHeight int

	// Target FPS
	TargetTPS int
}

// DefaultGameConfig returns a sensible default configuration
func DefaultGameConfig() GameConfig {
	return GameConfig{
		Width:      80,
		Height:     24,
		TileWidth:  16,
		TileHeight: 16,
		TargetTPS:  60,
	}
}

// Game implements ebiten.Game interface for the roguelike terminal renderer
type Game struct {
	config    GameConfig
	scene     Scene
	sceneMu   sync.RWMutex
	input     *InputHandler
	transport Transport

	// Game state
	buffer     [][]Cell
	bufferMu   sync.RWMutex
	needRedraw bool
}

// NewGame creates a new game instance with the given configuration
func NewGame(config GameConfig) *Game {
	g := &Game{
		config:     config,
		input:      NewInputHandler(),
		needRedraw: true,
	}
	g.initBuffer()
	return g
}

// initBuffer initializes the terminal buffer
func (g *Game) initBuffer() {
	g.bufferMu.Lock()
	defer g.bufferMu.Unlock()

	g.buffer = make([][]Cell, g.config.Height)
	for y := 0; y < g.config.Height; y++ {
		g.buffer[y] = make([]Cell, g.config.Width)
		for x := 0; x < g.config.Width; x++ {
			g.buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: "#FFFFFF",
				BgColor: "#000000",
			}
		}
	}
}

// SetScene sets the current scene
func (g *Game) SetScene(scene Scene) {
	g.sceneMu.Lock()
	defer g.sceneMu.Unlock()
	g.scene = scene
}

// SetTransport sets the transport for server communication
func (g *Game) SetTransport(t Transport) {
	g.transport = t
}

// Update implements ebiten.Game interface
// Called every tick (default 60 ticks per second)
func (g *Game) Update() error {
	// Handle input
	g.input.Update()

	// Get pending input and send to server
	if g.transport != nil {
		for _, key := range g.input.PopPressedKeys() {
			g.transport.SendInput(key)
		}
	}

	// Update current scene
	g.sceneMu.RLock()
	scene := g.scene
	g.sceneMu.RUnlock()

	if scene != nil {
		if err := scene.Update(g); err != nil {
			return err
		}
	}

	// Check for state updates from transport
	if g.transport != nil {
		if state := g.transport.GetLatestState(); state != nil {
			g.ApplyState(state)
		}
	}

	return nil
}

// Draw implements ebiten.Game interface
// Called every frame to render the screen
func (g *Game) Draw(screen *ebiten.Image) {
	// Clear screen
	screen.Fill(color.Black)

	// Draw current scene
	g.sceneMu.RLock()
	scene := g.scene
	g.sceneMu.RUnlock()

	if scene != nil {
		scene.Draw(g, screen)
	}
}

// Layout implements ebiten.Game interface
// Returns the game's logical screen size
func (g *Game) Layout(outsideWidth, outsideHeight int) (int, int) {
	return g.config.Width * g.config.TileWidth, g.config.Height * g.config.TileHeight
}

// ApplyState applies a game state update to the buffer
func (g *Game) ApplyState(state *GameState) {
	g.bufferMu.Lock()
	defer g.bufferMu.Unlock()

	for y := 0; y < min(state.Height, g.config.Height); y++ {
		for x := 0; x < min(state.Width, g.config.Width); x++ {
			if y < len(state.Buffer) && x < len(state.Buffer[y]) {
				g.buffer[y][x] = state.Buffer[y][x]
			}
		}
	}
	g.needRedraw = true
}

// GetBuffer returns a copy of the current buffer
func (g *Game) GetBuffer() [][]Cell {
	g.bufferMu.RLock()
	defer g.bufferMu.RUnlock()

	buf := make([][]Cell, len(g.buffer))
	for y, row := range g.buffer {
		buf[y] = make([]Cell, len(row))
		copy(buf[y], row)
	}
	return buf
}

// GetConfig returns the game configuration
func (g *Game) GetConfig() GameConfig {
	return g.config
}

// Run starts the game loop
func (g *Game) Run() error {
	ebiten.SetTPS(g.config.TargetTPS)
	ebiten.SetWindowSize(
		g.config.Width*g.config.TileWidth,
		g.config.Height*g.config.TileHeight,
	)
	ebiten.SetWindowTitle("go-gamelaunch-www")

	return ebiten.RunGame(g)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
