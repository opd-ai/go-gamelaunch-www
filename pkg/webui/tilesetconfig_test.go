// Package webui provides comprehensive unit tests for TilesetConfig functionality.
// This file contains tests for tileset configuration loading, validation, and management.
package webui

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestLoadTilesetConfig_ValidFile tests loading a valid tileset configuration
func TestLoadTilesetConfig_ValidFile_ReturnsConfigWithCorrectData(t *testing.T) {
	// Create a temporary directory for test files
	tempDir := t.TempDir()

	// Create a valid YAML configuration
	yamlContent := `tileset:
  name: "Test Tileset"
  version: "1.0.0"
  tile_width: 16
  tile_height: 16
  source_image: "test.png"
  mappings:
    - char: "@"
      x: 0
      y: 0
      fg_color: "#FFFFFF"
      bg_color: "#000000"
    - char: "."
      x: 1
      y: 0
      fg_color: "#888888"
`

	// Create test files
	configPath := filepath.Join(tempDir, "test.yaml")
	imagePath := filepath.Join(tempDir, "test.png")

	// Write YAML config
	err := os.WriteFile(configPath, []byte(yamlContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test config file: %v", err)
	}

	// Create a simple test PNG image (32x16 pixels to match tile requirements)
	createTestImage(t, imagePath, 32, 16)

	// Test loading the configuration
	config, err := LoadTilesetConfig(configPath)
	if err != nil {
		t.Fatalf("LoadTilesetConfig failed: %v", err)
	}

	// Verify basic properties
	if config.Name != "Test Tileset" {
		t.Errorf("Expected name 'Test Tileset', got '%s'", config.Name)
	}

	if config.Version != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got '%s'", config.Version)
	}

	if config.TileWidth != 16 || config.TileHeight != 16 {
		t.Errorf("Expected tile size 16x16, got %dx%d", config.TileWidth, config.TileHeight)
	}

	if len(config.Mappings) != 2 {
		t.Errorf("Expected 2 mappings, got %d", len(config.Mappings))
	}

	// Verify mapping index was built
	if config.mappingIndex == nil {
		t.Error("Expected mapping index to be built")
	}

	// Test mapping retrieval
	mapping := config.GetMapping('@')
	if mapping == nil {
		t.Error("Expected to find mapping for '@'")
	} else if mapping.X != 0 || mapping.Y != 0 {
		t.Errorf("Expected mapping coordinates (0,0), got (%d,%d)", mapping.X, mapping.Y)
	}
}

// TestLoadTilesetConfig_InvalidFile tests error handling with invalid files
func TestLoadTilesetConfig_InvalidFile_ReturnsError(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		content  string
		wantErr  bool
	}{
		{
			name:     "NonexistentFile",
			filename: "nonexistent.yaml",
			content:  "",
			wantErr:  true,
		},
		{
			name:     "InvalidYAML",
			filename: "invalid.yaml",
			content:  "invalid: yaml: content: [",
			wantErr:  true,
		},
		{
			name:     "MissingTilesetKey",
			filename: "missing.yaml",
			content:  "name: test",
			wantErr:  true,
		},
	}

	tempDir := t.TempDir()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var configPath string

			if tt.name == "NonexistentFile" {
				configPath = filepath.Join(tempDir, tt.filename)
			} else {
				configPath = filepath.Join(tempDir, tt.filename)
				err := os.WriteFile(configPath, []byte(tt.content), 0644)
				if err != nil {
					t.Fatalf("Failed to create test file: %v", err)
				}
			}

			_, err := LoadTilesetConfig(configPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("LoadTilesetConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestSaveTilesetConfig_ValidConfig tests saving a tileset configuration
func TestSaveTilesetConfig_ValidConfig_CreatesValidFile(t *testing.T) {
	tempDir := t.TempDir()
	outputPath := filepath.Join(tempDir, "output.yaml")

	// Create a test configuration
	config := &TilesetConfig{
		Name:        "Save Test",
		Version:     "1.0.0",
		TileWidth:   8,
		TileHeight:  8,
		SourceImage: "test.png",
		Mappings: []TileMapping{
			{Char: "a", X: 0, Y: 0},
			{Char: "b", X: 1, Y: 0},
		},
	}

	// Save the configuration
	err := SaveTilesetConfig(config, outputPath)
	if err != nil {
		t.Fatalf("SaveTilesetConfig failed: %v", err)
	}

	// Verify file was created
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Expected output file to be created")
	}

	// Verify we can load it back
	loadedConfig, err := LoadTilesetConfig(outputPath)
	if err != nil {
		t.Fatalf("Failed to load saved config: %v", err)
	}

	if loadedConfig.Name != config.Name {
		t.Errorf("Expected name '%s', got '%s'", config.Name, loadedConfig.Name)
	}
}

// TestDefaultTilesetConfig_ReturnsValidConfig tests the default configuration
func TestDefaultTilesetConfig_ReturnsValidConfig_WithBasicMappings(t *testing.T) {
	config := DefaultTilesetConfig()

	if config == nil {
		t.Fatal("Expected non-nil config")
	}

	// Verify basic properties
	if config.Name == "" {
		t.Error("Expected non-empty name")
	}

	if config.Version == "" {
		t.Error("Expected non-empty version")
	}

	if config.TileWidth <= 0 || config.TileHeight <= 0 {
		t.Errorf("Expected positive tile dimensions, got %dx%d", config.TileWidth, config.TileHeight)
	}

	if len(config.Mappings) == 0 {
		t.Error("Expected some default mappings")
	}

	// Verify mapping index is built
	if config.mappingIndex == nil {
		t.Error("Expected mapping index to be built")
	}

	// Test specific mappings exist
	expectedChars := []rune{'@', '.', '#', '+'}
	for _, char := range expectedChars {
		if config.GetMapping(char) == nil {
			t.Errorf("Expected mapping for character '%c'", char)
		}
	}
}

// TestTilesetConfig_validate tests the validation method
func TestTilesetConfig_validate_DetectsInvalidConfigurations(t *testing.T) {
	tests := []struct {
		name    string
		config  *TilesetConfig
		wantErr bool
		errMsg  string
	}{
		{
			name: "ValidConfig",
			config: &TilesetConfig{
				Name:        "Valid",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
				Mappings: []TileMapping{
					{Char: "a", X: 0, Y: 0},
				},
			},
			wantErr: false,
		},
		{
			name: "EmptyName",
			config: &TilesetConfig{
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
			},
			wantErr: true,
			errMsg:  "name is required",
		},
		{
			name: "EmptyVersion",
			config: &TilesetConfig{
				Name:        "Test",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
			},
			wantErr: true,
			errMsg:  "version is required",
		},
		{
			name: "ZeroTileWidth",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   0,
				TileHeight:  8,
				SourceImage: "test.png",
			},
			wantErr: true,
			errMsg:  "tile dimensions must be positive",
		},
		{
			name: "NegativeTileHeight",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  -5,
				SourceImage: "test.png",
			},
			wantErr: true,
			errMsg:  "tile dimensions must be positive",
		},
		{
			name: "EmptySourceImage",
			config: &TilesetConfig{
				Name:       "Test",
				Version:    "1.0.0",
				TileWidth:  8,
				TileHeight: 8,
			},
			wantErr: true,
			errMsg:  "source image is required",
		},
		{
			name: "UnsupportedImageFormat",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.bmp",
			},
			wantErr: true,
			errMsg:  "unsupported image format",
		},
		{
			name: "DuplicateCharacter",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
				Mappings: []TileMapping{
					{Char: "a", X: 0, Y: 0},
					{Char: "a", X: 1, Y: 0},
				},
			},
			wantErr: true,
			errMsg:  "duplicate character",
		},
		{
			name: "NegativeCoordinates",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
				Mappings: []TileMapping{
					{Char: "a", X: -1, Y: 0},
				},
			},
			wantErr: true,
			errMsg:  "coordinates must be non-negative",
		},
		{
			name: "InvalidFgColor",
			config: &TilesetConfig{
				Name:        "Test",
				Version:     "1.0.0",
				TileWidth:   8,
				TileHeight:  8,
				SourceImage: "test.png",
				Mappings: []TileMapping{
					{Char: "a", X: 0, Y: 0, FgColor: "invalid"},
				},
			},
			wantErr: true,
			errMsg:  "invalid foreground color format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !contains(err.Error(), tt.errMsg) {
					t.Errorf("Expected error containing '%s', got '%v'", tt.errMsg, err)
				}
			}
		})
	}
}

// TestTilesetConfig_GetMapping tests character mapping retrieval
func TestTilesetConfig_GetMapping_ReturnsCorrectMappings(t *testing.T) {
	config := &TilesetConfig{
		Mappings: []TileMapping{
			{Char: "a", X: 0, Y: 0, FgColor: "#FF0000"},
			{Char: "b", X: 1, Y: 1, FgColor: "#00FF00"},
		},
	}

	// Build the index
	err := config.buildIndex()
	if err != nil {
		t.Fatalf("Failed to build index: %v", err)
	}

	tests := []struct {
		char    rune
		want    *TileMapping
		wantNil bool
	}{
		{
			char: 'a',
			want: &TileMapping{Char: "a", X: 0, Y: 0, FgColor: "#FF0000", charRune: 'a'},
		},
		{
			char: 'b',
			want: &TileMapping{Char: "b", X: 1, Y: 1, FgColor: "#00FF00", charRune: 'b'},
		},
		{
			char:    'c',
			wantNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("char_%c", tt.char), func(t *testing.T) {
			got := config.GetMapping(tt.char)
			if tt.wantNil {
				if got != nil {
					t.Errorf("GetMapping(%c) = %v, want nil", tt.char, got)
				}
				return
			}

			if got == nil {
				t.Errorf("GetMapping(%c) = nil, want %v", tt.char, tt.want)
				return
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("GetMapping(%c) = %v, want %v", tt.char, got, tt.want)
			}
		})
	}
}

// TestTilesetConfig_GetImageData tests image data retrieval
func TestTilesetConfig_GetImageData_ReturnsCorrectImage(t *testing.T) {
	config := &TilesetConfig{}

	// Initially should return nil
	if config.GetImageData() != nil {
		t.Error("Expected nil image data for uninitialized config")
	}

	// Create and set test image
	testImg := image.NewRGBA(image.Rect(0, 0, 16, 16))
	config.imageData = testImg

	retrieved := config.GetImageData()
	if retrieved != testImg {
		t.Error("Expected to retrieve the same image that was set")
	}
}

// TestTilesetConfig_GetTileCount tests tile count calculation
func TestTilesetConfig_GetTileCount_CalculatesCorrectCounts(t *testing.T) {
	tests := []struct {
		name       string
		imageSize  image.Rectangle
		tileWidth  int
		tileHeight int
		wantX      int
		wantY      int
	}{
		{
			name:       "16x16_tiles_in_32x32_image",
			imageSize:  image.Rect(0, 0, 32, 32),
			tileWidth:  16,
			tileHeight: 16,
			wantX:      2,
			wantY:      2,
		},
		{
			name:       "8x8_tiles_in_64x32_image",
			imageSize:  image.Rect(0, 0, 64, 32),
			tileWidth:  8,
			tileHeight: 8,
			wantX:      8,
			wantY:      4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &TilesetConfig{
				TileWidth:  tt.tileWidth,
				TileHeight: tt.tileHeight,
			}

			// Create test image with specified size
			config.imageData = image.NewRGBA(tt.imageSize)

			gotX, gotY := config.GetTileCount()
			if gotX != tt.wantX || gotY != tt.wantY {
				t.Errorf("GetTileCount() = (%d, %d), want (%d, %d)", gotX, gotY, tt.wantX, tt.wantY)
			}
		})
	}

	// Test with nil image
	config := &TilesetConfig{}
	gotX, gotY := config.GetTileCount()
	if gotX != 0 || gotY != 0 {
		t.Errorf("GetTileCount() with nil image = (%d, %d), want (0, 0)", gotX, gotY)
	}
}

// TestTilesetConfig_ToJSON tests JSON serialization
func TestTilesetConfig_ToJSON_ReturnsCorrectStructure(t *testing.T) {
	config := &TilesetConfig{
		Name:       "Test JSON",
		Version:    "2.0.0",
		TileWidth:  12,
		TileHeight: 12,
		Mappings: []TileMapping{
			{Char: "x", X: 0, Y: 0, FgColor: "#FFFFFF", BgColor: "#000000"},
			{Char: "y", X: 1, Y: 0, FgColor: "#FF0000"},
		},
		SpecialTiles: []SpecialTile{
			{
				ID: "door",
				Tiles: []TileRef{
					{X: 2, Y: 0},
					{X: 3, Y: 0},
				},
			},
		},
	}

	// Set test image for tile count calculation
	config.imageData = image.NewRGBA(image.Rect(0, 0, 48, 24)) // 4x2 tiles

	result := config.ToJSON()

	// Verify basic fields
	if result["name"] != "Test JSON" {
		t.Errorf("Expected name 'Test JSON', got %v", result["name"])
	}

	if result["version"] != "2.0.0" {
		t.Errorf("Expected version '2.0.0', got %v", result["version"])
	}

	if result["tile_width"] != 12 {
		t.Errorf("Expected tile_width 12, got %v", result["tile_width"])
	}

	if result["tiles_x"] != 4 || result["tiles_y"] != 2 {
		t.Errorf("Expected tiles (4,2), got (%v,%v)", result["tiles_x"], result["tiles_y"])
	}

	// Verify mappings structure
	mappings, ok := result["mappings"].([]map[string]interface{})
	if !ok {
		t.Error("Expected mappings to be slice of maps")
	} else if len(mappings) != 2 {
		t.Errorf("Expected 2 mappings, got %d", len(mappings))
	}

	// Verify special tiles are included
	if result["special_tiles"] == nil {
		t.Error("Expected special_tiles to be included")
	}
}

// TestTilesetConfig_Clone tests configuration cloning
func TestTilesetConfig_Clone_CreatesIndependentCopy(t *testing.T) {
	original := &TilesetConfig{
		Name:       "Original",
		Version:    "1.0.0",
		TileWidth:  8,
		TileHeight: 8,
		Mappings: []TileMapping{
			{Char: "a", X: 0, Y: 0},
			{Char: "b", X: 1, Y: 0},
		},
		SpecialTiles: []SpecialTile{
			{
				ID: "special1",
				Tiles: []TileRef{
					{X: 0, Y: 1},
				},
			},
		},
	}

	// Build index for original
	original.buildIndex()

	// Clone the configuration
	clone := original.Clone()

	// Verify clone is independent
	if clone == original {
		t.Error("Clone should be a different object")
	}

	// Verify basic fields are copied
	if clone.Name != original.Name {
		t.Errorf("Clone name = %s, want %s", clone.Name, original.Name)
	}

	if clone.TileWidth != original.TileWidth {
		t.Errorf("Clone TileWidth = %d, want %d", clone.TileWidth, original.TileWidth)
	}

	// Verify mappings are deep copied
	if len(clone.Mappings) != len(original.Mappings) {
		t.Errorf("Clone mappings length = %d, want %d", len(clone.Mappings), len(original.Mappings))
	}

	// Modify clone and verify original is unchanged
	clone.Name = "Modified"
	clone.Mappings[0].Char = "modified"

	if original.Name == "Modified" {
		t.Error("Original should not be affected by clone modification")
	}

	if original.Mappings[0].Char == "modified" {
		t.Error("Original mappings should not be affected by clone modification")
	}

	// Verify mapping index is rebuilt
	if clone.mappingIndex == nil {
		t.Error("Clone should have mapping index rebuilt")
	}
}

// Helper functions

// createTestImage creates a simple test PNG image for testing
func createTestImage(t *testing.T, path string, width, height int) {
	t.Helper()

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Fill with a pattern to make it valid
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x * 255) / width),
				G: uint8((y * 255) / height),
				B: 128,
				A: 255,
			})
		}
	}

	// Save as PNG
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("Failed to create test image file: %v", err)
	}
	defer file.Close()

	// Encode as PNG
	err = png.Encode(file, img)
	if err != nil {
		t.Fatalf("Failed to encode PNG: %v", err)
	}
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					containsSubstring(s, substr))))
}

// containsSubstring is a simple substring search helper
func containsSubstring(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	if len(s) < len(substr) {
		return false
	}

	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
