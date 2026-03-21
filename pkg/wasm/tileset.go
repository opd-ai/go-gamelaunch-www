// Package wasm provides tileset loading and management for Ebitengine.
package wasm

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"  // GIF format support
	_ "image/jpeg" // JPEG format support
	_ "image/png"  // PNG format support

	"github.com/hajimehoshi/ebiten/v2"
)

// TilesetConfig defines tileset configuration
type TilesetConfig struct {
	Name        string        `yaml:"name" json:"name"`
	Version     string        `yaml:"version" json:"version"`
	TileWidth   int           `yaml:"tile_width" json:"tile_width"`
	TileHeight  int           `yaml:"tile_height" json:"tile_height"`
	SourceImage string        `yaml:"source_image" json:"source_image"`
	Mappings    []TileMapping `yaml:"mappings" json:"mappings"`
}

// TileMapping maps a character to a tile position
type TileMapping struct {
	Char string `yaml:"char" json:"char"`
	X    int    `yaml:"x" json:"x"`
	Y    int    `yaml:"y" json:"y"`
}

// Tileset represents a loaded tileset
type Tileset struct {
	config      TilesetConfig
	image       *ebiten.Image
	charMapping map[rune]image.Point
}

// NewTileset creates a new empty tileset
func NewTileset() *Tileset {
	return &Tileset{
		charMapping: make(map[rune]image.Point),
	}
}

// LoadFromBytes loads a tileset image from byte data
func (ts *Tileset) LoadFromBytes(data []byte) error {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	ts.image = ebiten.NewImageFromImage(img)
	return nil
}

// LoadConfig applies tileset configuration
func (ts *Tileset) LoadConfig(config TilesetConfig) {
	ts.config = config
	ts.charMapping = make(map[rune]image.Point)

	for _, m := range config.Mappings {
		if len(m.Char) > 0 {
			ts.charMapping[rune(m.Char[0])] = image.Point{X: m.X, Y: m.Y}
		}
	}
}

// GetImage returns the tileset image
func (ts *Tileset) GetImage() *ebiten.Image {
	return ts.image
}

// GetTileSize returns the tile dimensions
func (ts *Tileset) GetTileSize() (width, height int) {
	return ts.config.TileWidth, ts.config.TileHeight
}

// GetCharMapping returns the character to tile position mapping
func (ts *Tileset) GetCharMapping() map[rune]image.Point {
	return ts.charMapping
}

// GetTilePosition returns the tile position for a character
func (ts *Tileset) GetTilePosition(char rune) (x, y int, found bool) {
	pos, found := ts.charMapping[char]
	return pos.X, pos.Y, found
}

// GetConfig returns the tileset configuration
func (ts *Tileset) GetConfig() TilesetConfig {
	return ts.config
}

// IsLoaded returns true if the tileset image is loaded
func (ts *Tileset) IsLoaded() bool {
	return ts.image != nil
}

// ApplyToRenderer applies this tileset to a tile renderer
func (ts *Tileset) ApplyToRenderer(renderer *TileRenderer) {
	if ts.image != nil {
		renderer.SetTileset(ts.image, ts.config.TileWidth, ts.config.TileHeight)
		renderer.SetCharMapping(ts.charMapping)
	}
}

// Validate checks if the tileset configuration is valid
func (ts *Tileset) Validate() error {
	if ts.config.TileWidth <= 0 {
		return fmt.Errorf("invalid tile width: %d", ts.config.TileWidth)
	}
	if ts.config.TileHeight <= 0 {
		return fmt.Errorf("invalid tile height: %d", ts.config.TileHeight)
	}
	return nil
}
