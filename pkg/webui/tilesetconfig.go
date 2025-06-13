// Package webui provides TilesetConfig implementation for tileset management.
// Moved from: tileset.go
package webui

import (
	"fmt"
	"image"
	_ "image/gif"  // Import for GIF support
	_ "image/jpeg" // Import for JPEG support
	_ "image/png"  // Import for PNG support
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

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

// LoadTilesetConfig loads a tileset from a YAML file
// Moved from: tileset.go
func LoadTilesetConfig(path string) (*TilesetConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read tileset file: %w", err)
	}

	var config struct {
		Tileset TilesetConfig `yaml:"tileset"`
	}

	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse tileset YAML: %w", err)
	}

	tileset := &config.Tileset

	// Set base path for resolving relative image paths
	tileset.basePath = filepath.Dir(path)

	if err := tileset.validate(); err != nil {
		return nil, fmt.Errorf("invalid tileset configuration: %w", err)
	}

	if err := tileset.buildIndex(); err != nil {
		return nil, fmt.Errorf("failed to build tileset index: %w", err)
	}

	if err := tileset.loadImage(); err != nil {
		return nil, fmt.Errorf("failed to load tileset image: %w", err)
	}

	return tileset, nil
}

// SaveTilesetConfig saves a tileset configuration to a YAML file
// Moved from: tileset.go
func SaveTilesetConfig(tileset *TilesetConfig, path string) error {
	config := struct {
		Tileset *TilesetConfig `yaml:"tileset"`
	}{
		Tileset: tileset,
	}

	data, err := yaml.Marshal(&config)
	if err != nil {
		return fmt.Errorf("failed to marshal tileset: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("failed to write tileset file: %w", err)
	}

	return nil
}

// DefaultTilesetConfig returns a basic ASCII tileset configuration
// Moved from: tileset.go
func DefaultTilesetConfig() *TilesetConfig {
	config := &TilesetConfig{
		Name:       "ASCII Default",
		Version:    "1.0.0",
		TileWidth:  8,
		TileHeight: 16,
		Mappings: []TileMapping{
			{Char: "@", X: 0, Y: 0, FgColor: "#FFFFFF", BgColor: "#000000"},
			{Char: ".", X: 1, Y: 0, FgColor: "#888888", BgColor: "#000000"},
			{Char: "#", X: 2, Y: 0, FgColor: "#AAAAAA", BgColor: "#000000"},
			{Char: "+", X: 3, Y: 0, FgColor: "#8B4513", BgColor: "#000000"},
			{Char: "d", X: 0, Y: 1, FgColor: "#FF0000", BgColor: "#000000"},
			{Char: "k", X: 1, Y: 1, FgColor: "#00FF00", BgColor: "#000000"},
			{Char: "D", X: 2, Y: 1, FgColor: "#FF4500", BgColor: "#000000"},
			{Char: " ", X: 3, Y: 1, FgColor: "#000000", BgColor: "#000000"},
		},
	}

	// Build the index for the default config
	config.buildIndex()
	return config
}

// isValidColor checks if a color string is in valid hex format
// Moved from: tileset.go
func isValidColor(color string) bool {
	if !strings.HasPrefix(color, "#") {
		return false
	}

	hex := color[1:]
	if len(hex) != 3 && len(hex) != 6 {
		return false
	}

	for _, c := range hex {
		if !((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}

	return true
}

// validate checks if the tileset configuration is valid
// Moved from: tileset.go
func (tc *TilesetConfig) validate() error {
	if tc.Name == "" {
		return fmt.Errorf("tileset name is required")
	}

	if tc.Version == "" {
		return fmt.Errorf("tileset version is required")
	}

	if tc.TileWidth <= 0 || tc.TileHeight <= 0 {
		return fmt.Errorf("tile dimensions must be positive (got %dx%d)", tc.TileWidth, tc.TileHeight)
	}

	if tc.SourceImage == "" {
		return fmt.Errorf("source image is required")
	}

	// Check if image file has a supported extension
	ext := strings.ToLower(filepath.Ext(tc.SourceImage))
	supportedExts := []string{".png", ".jpg", ".jpeg", ".gif"}
	supported := false
	for _, supportedExt := range supportedExts {
		if ext == supportedExt {
			supported = true
			break
		}
	}
	if !supported {
		return fmt.Errorf("unsupported image format '%s', supported formats: %v", ext, supportedExts)
	}

	// Validate mappings
	charSet := make(map[string]bool)
	coordSet := make(map[string]bool)

	for i, mapping := range tc.Mappings {
		if mapping.Char == "" {
			return fmt.Errorf("mapping %d: character is required", i)
		}

		if charSet[mapping.Char] {
			return fmt.Errorf("mapping %d: duplicate character '%s'", i, mapping.Char)
		}
		charSet[mapping.Char] = true

		if mapping.X < 0 || mapping.Y < 0 {
			return fmt.Errorf("mapping %d: tile coordinates must be non-negative (got %d, %d)", i, mapping.X, mapping.Y)
		}

		// Check for duplicate coordinates
		coordKey := fmt.Sprintf("%d,%d", mapping.X, mapping.Y)
		if coordSet[coordKey] {
			return fmt.Errorf("mapping %d: duplicate tile coordinates (%d, %d)", i, mapping.X, mapping.Y)
		}
		coordSet[coordKey] = true

		// Validate color formats if provided
		if mapping.FgColor != "" && !isValidColor(mapping.FgColor) {
			return fmt.Errorf("mapping %d: invalid foreground color format '%s'", i, mapping.FgColor)
		}
		if mapping.BgColor != "" && !isValidColor(mapping.BgColor) {
			return fmt.Errorf("mapping %d: invalid background color format '%s'", i, mapping.BgColor)
		}
	}

	// Validate special tiles
	specialIDSet := make(map[string]bool)
	for i, special := range tc.SpecialTiles {
		if special.ID == "" {
			return fmt.Errorf("special tile %d: ID is required", i)
		}

		if specialIDSet[special.ID] {
			return fmt.Errorf("special tile %d: duplicate ID '%s'", i, special.ID)
		}
		specialIDSet[special.ID] = true

		if len(special.Tiles) == 0 {
			return fmt.Errorf("special tile %d: at least one tile reference is required", i)
		}

		for j, tile := range special.Tiles {
			if tile.X < 0 || tile.Y < 0 {
				return fmt.Errorf("special tile %d, tile %d: coordinates must be non-negative", i, j)
			}
		}
	}

	return nil
}

// buildIndex creates the character-to-mapping lookup table
// Moved from: tileset.go
func (tc *TilesetConfig) buildIndex() error {
	tc.mappingIndex = make(map[rune]*TileMapping)

	for i := range tc.Mappings {
		mapping := &tc.Mappings[i]

		// Convert string to rune
		runes := []rune(mapping.Char)
		if len(runes) != 1 {
			return fmt.Errorf("character '%s' must be a single rune", mapping.Char)
		}

		mapping.charRune = runes[0]
		tc.mappingIndex[mapping.charRune] = mapping
	}

	return nil
}

// loadImage loads the tileset source image
// Moved from: tileset.go
func (tc *TilesetConfig) loadImage() error {
	imagePath := tc.SourceImage

	// If path is relative, resolve it relative to the tileset config file
	if !filepath.IsAbs(imagePath) && tc.basePath != "" {
		imagePath = filepath.Join(tc.basePath, imagePath)
	}

	// Check if image file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return fmt.Errorf("image file does not exist: %s", imagePath)
	}

	file, err := os.Open(imagePath)
	if err != nil {
		return fmt.Errorf("failed to open image file: %w", err)
	}
	defer file.Close()

	img, format, err := image.Decode(file)
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	tc.imageData = img

	// Validate that the image dimensions are compatible with tile size
	bounds := img.Bounds()
	imageWidth := bounds.Dx()
	imageHeight := bounds.Dy()

	if imageWidth%tc.TileWidth != 0 {
		return fmt.Errorf("image width (%d) is not divisible by tile width (%d)", imageWidth, tc.TileWidth)
	}

	if imageHeight%tc.TileHeight != 0 {
		return fmt.Errorf("image height (%d) is not divisible by tile height (%d)", imageHeight, tc.TileHeight)
	}

	// Validate tile coordinates against image dimensions
	maxTileX := imageWidth / tc.TileWidth
	maxTileY := imageHeight / tc.TileHeight

	for _, mapping := range tc.Mappings {
		if mapping.X >= maxTileX || mapping.Y >= maxTileY {
			return fmt.Errorf("tile coordinates (%d, %d) for character '%s' exceed image bounds (max: %d, %d)",
				mapping.X, mapping.Y, mapping.Char, maxTileX-1, maxTileY-1)
		}
	}

	// Validate special tile coordinates
	for _, special := range tc.SpecialTiles {
		for _, tile := range special.Tiles {
			if tile.X >= maxTileX || tile.Y >= maxTileY {
				return fmt.Errorf("special tile '%s' coordinates (%d, %d) exceed image bounds (max: %d, %d)",
					special.ID, tile.X, tile.Y, maxTileX-1, maxTileY-1)
			}
		}
	}

	fmt.Printf("Loaded tileset image: %s (%s, %dx%d, %dx%d tiles)\n",
		imagePath, format, imageWidth, imageHeight, maxTileX, maxTileY)

	return nil
}

// GetMapping returns the tile mapping for a character
// Moved from: tileset.go
func (tc *TilesetConfig) GetMapping(char rune) *TileMapping {
	if tc.mappingIndex == nil {
		return nil
	}
	return tc.mappingIndex[char]
}

// GetImageData returns the loaded image data
// Moved from: tileset.go
func (tc *TilesetConfig) GetImageData() image.Image {
	return tc.imageData
}

// GetTileCount returns the number of tiles in the tileset
// Moved from: tileset.go
func (tc *TilesetConfig) GetTileCount() (int, int) {
	if tc.imageData == nil {
		return 0, 0
	}

	bounds := tc.imageData.Bounds()
	tilesX := bounds.Dx() / tc.TileWidth
	tilesY := bounds.Dy() / tc.TileHeight

	return tilesX, tilesY
}

// ToJSON returns a JSON representation for client-side use
// Moved from: tileset.go
func (tc *TilesetConfig) ToJSON() map[string]interface{} {
	mappings := make([]map[string]interface{}, len(tc.Mappings))
	for i, mapping := range tc.Mappings {
		mappings[i] = map[string]interface{}{
			"char":     mapping.Char,
			"x":        mapping.X,
			"y":        mapping.Y,
			"fg_color": mapping.FgColor,
			"bg_color": mapping.BgColor,
		}
	}

	tilesX, tilesY := tc.GetTileCount()

	result := map[string]interface{}{
		"name":          tc.Name,
		"version":       tc.Version,
		"tile_width":    tc.TileWidth,
		"tile_height":   tc.TileHeight,
		"tiles_x":       tilesX,
		"tiles_y":       tilesY,
		"mappings":      mappings,
		"special_tiles": tc.SpecialTiles,
	}

	return result
}

// Clone creates a deep copy of the tileset configuration
// Moved from: tileset.go
func (tc *TilesetConfig) Clone() *TilesetConfig {
	clone := &TilesetConfig{
		Name:        tc.Name,
		Version:     tc.Version,
		TileWidth:   tc.TileWidth,
		TileHeight:  tc.TileHeight,
		SourceImage: tc.SourceImage,
		imageData:   tc.imageData, // Image data is immutable, safe to share
		basePath:    tc.basePath,
	}

	// Deep copy mappings
	clone.Mappings = make([]TileMapping, len(tc.Mappings))
	copy(clone.Mappings, tc.Mappings)

	// Deep copy special tiles
	clone.SpecialTiles = make([]SpecialTile, len(tc.SpecialTiles))
	for i, special := range tc.SpecialTiles {
		clone.SpecialTiles[i] = SpecialTile{
			ID:    special.ID,
			Tiles: make([]TileRef, len(special.Tiles)),
		}
		copy(clone.SpecialTiles[i].Tiles, special.Tiles)
	}

	// Rebuild index
	clone.buildIndex()

	return clone
}
