//go:build !js

// Package wasm provides non-WASM stubs so the package can be tested
// in headless environments without an Ebitengine/GLFW display.
package wasm

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"sync"
)

// GameConfig holds configuration for the game instance.
type GameConfig struct {
	Width      int
	Height     int
	TileWidth  int
	TileHeight int
	TargetTPS  int
}

// DefaultGameConfig returns a sensible default configuration.
func DefaultGameConfig() GameConfig {
	return GameConfig{
		Width:      80,
		Height:     24,
		TileWidth:  16,
		TileHeight: 16,
		TargetTPS:  60,
	}
}

// Scene represents a renderable, updatable game scene.
type Scene interface {
	Update(game *Game) error
	OnEnter(game *Game)
	OnExit(game *Game)
}

// SceneManager manages scene transitions.
type SceneManager struct {
	currentScene Scene
	nextScene    Scene
}

// NewSceneManager creates a new scene manager.
func NewSceneManager() *SceneManager { return &SceneManager{} }

// SetScene queues a scene transition.
func (sm *SceneManager) SetScene(scene Scene) { sm.nextScene = scene }

// Update processes scene transitions.
func (sm *SceneManager) Update(game *Game) error {
	if sm.nextScene != nil {
		if sm.currentScene != nil {
			sm.currentScene.OnExit(game)
		}
		sm.currentScene = sm.nextScene
		sm.nextScene = nil
		if sm.currentScene != nil {
			sm.currentScene.OnEnter(game)
		}
	}
	if sm.currentScene != nil {
		return sm.currentScene.Update(game)
	}
	return nil
}

// InputHandler manages keyboard input (stub for non-WASM builds).
type InputHandler struct{}

// NewInputHandler creates a new input handler stub.
func NewInputHandler() *InputHandler { return &InputHandler{} }

// Game implements the game loop for the roguelike terminal renderer.
type Game struct {
	config    GameConfig
	sceneMu   sync.RWMutex
	scene     Scene
	input     *InputHandler
	transport Transport

	buffer   [][]Cell
	bufferMu sync.RWMutex
}

// NewGame creates a new Game with the given configuration.
func NewGame(config GameConfig) *Game {
	g := &Game{
		config: config,
		input:  NewInputHandler(),
	}
	g.buffer = make([][]Cell, config.Height)
	for y := range g.buffer {
		g.buffer[y] = make([]Cell, config.Width)
		for x := range g.buffer[y] {
			g.buffer[y][x] = Cell{Char: ' ', FgColor: "#FFFFFF", BgColor: "#000000"}
		}
	}
	return g
}

// GetBuffer returns a copy of the current cell buffer.
func (g *Game) GetBuffer() [][]Cell {
	g.bufferMu.RLock()
	defer g.bufferMu.RUnlock()
	return g.buffer
}

// GetConfig returns the game configuration.
func (g *Game) GetConfig() GameConfig { return g.config }

// ApplyState updates the game buffer from a GameState snapshot.
func (g *Game) ApplyState(state *GameState) {
	if state == nil {
		return
	}
	g.bufferMu.Lock()
	defer g.bufferMu.Unlock()
	rows := min(state.Height, g.config.Height)
	for y := 0; y < rows; y++ {
		cols := min(state.Width, g.config.Width)
		for x := 0; x < cols; x++ {
			g.buffer[y][x] = state.Buffer[y][x]
		}
	}
}

// Layout returns the logical screen dimensions in pixels.
func (g *Game) Layout(_, _ int) (int, int) {
	return g.config.Width * g.config.TileWidth, g.config.Height * g.config.TileHeight
}

// SetScene sets the active scene.
func (g *Game) SetScene(scene Scene) {
	g.sceneMu.Lock()
	defer g.sceneMu.Unlock()
	g.scene = scene
}

// SetTransport sets the server transport.
func (g *Game) SetTransport(t Transport) { g.transport = t }

// Run is a no-op in non-WASM builds.
func (g *Game) Run() error { return nil }

// TileRenderer renders tiles to the screen.
type TileRenderer struct {
	tileWidth   int
	tileHeight  int
	charMapping map[rune]image.Point
}

// NewTileRenderer creates a new tile renderer with default 16×16 tile size.
func NewTileRenderer() *TileRenderer {
	return &TileRenderer{
		tileWidth:   16,
		tileHeight:  16,
		charMapping: make(map[rune]image.Point),
	}
}

// SetCharMapping sets the character-to-tile-position mapping.
func (tr *TileRenderer) SetCharMapping(mapping map[rune]image.Point) {
	tr.charMapping = mapping
}

// parseHexColor converts a "#RRGGBB" string to color.RGBA.
func parseHexColor(hex string) color.RGBA {
	if len(hex) != 7 || hex[0] != '#' {
		return color.RGBA{255, 255, 255, 255}
	}
	return color.RGBA{hexToByte(hex[1:3]), hexToByte(hex[3:5]), hexToByte(hex[5:7]), 255}
}

// hexToByte converts a 2-character hex string to a byte value.
func hexToByte(s string) byte {
	var result byte
	for _, c := range s {
		result <<= 4
		switch {
		case c >= '0' && c <= '9':
			result |= byte(c - '0')
		case c >= 'a' && c <= 'f':
			result |= byte(c-'a') + 10
		case c >= 'A' && c <= 'F':
			result |= byte(c-'A') + 10
		}
	}
	return result
}

// TilesetConfig defines tileset configuration.
type TilesetConfig struct {
	Name        string        `yaml:"name"         json:"name"`
	Version     string        `yaml:"version"      json:"version"`
	TileWidth   int           `yaml:"tile_width"   json:"tile_width"`
	TileHeight  int           `yaml:"tile_height"  json:"tile_height"`
	SourceImage string        `yaml:"source_image" json:"source_image"`
	Mappings    []TileMapping `yaml:"mappings"     json:"mappings"`
}

// TileMapping maps a character to a tile position.
type TileMapping struct {
	Char string `yaml:"char" json:"char"`
	X    int    `yaml:"x"    json:"x"`
	Y    int    `yaml:"y"    json:"y"`
}

// Tileset represents a loaded tileset (non-WASM stub).
type Tileset struct {
	config      TilesetConfig
	image       image.Image
	charMapping map[rune]image.Point
}

// NewTileset creates a new empty tileset.
func NewTileset() *Tileset {
	return &Tileset{charMapping: make(map[rune]image.Point)}
}

// LoadFromBytes loads a tileset image from raw bytes.
func (ts *Tileset) LoadFromBytes(data []byte) error {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}
	ts.image = img
	return nil
}

// LoadConfig applies tileset configuration and builds the char mapping.
func (ts *Tileset) LoadConfig(config TilesetConfig) {
	ts.config = config
	ts.charMapping = make(map[rune]image.Point)
	for _, m := range config.Mappings {
		if len(m.Char) > 0 {
			ts.charMapping[rune(m.Char[0])] = image.Point{X: m.X, Y: m.Y}
		}
	}
}

// GetTileSize returns the configured tile width and height.
func (ts *Tileset) GetTileSize() (width, height int) {
	return ts.config.TileWidth, ts.config.TileHeight
}

// GetCharMapping returns the character-to-tile-position mapping.
func (ts *Tileset) GetCharMapping() map[rune]image.Point { return ts.charMapping }

// GetTilePosition returns the tile position for a character.
func (ts *Tileset) GetTilePosition(char rune) (x, y int, found bool) {
	pos, found := ts.charMapping[char]
	return pos.X, pos.Y, found
}

// GetConfig returns the tileset configuration.
func (ts *Tileset) GetConfig() TilesetConfig { return ts.config }

// IsLoaded returns true if a tileset image has been loaded.
func (ts *Tileset) IsLoaded() bool { return ts.image != nil }

// Validate checks that the tileset configuration is valid.
func (ts *Tileset) Validate() error {
	if ts.config.TileWidth <= 0 {
		return fmt.Errorf("invalid tile width: %d", ts.config.TileWidth)
	}
	if ts.config.TileHeight <= 0 {
		return fmt.Errorf("invalid tile height: %d", ts.config.TileHeight)
	}
	return nil
}

// min returns the smaller of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
