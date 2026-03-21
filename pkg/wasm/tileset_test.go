// Package wasm provides tests for tileset loading and management.
// These tests don't require a display/window system.
package wasm

import (
	"image"
	"testing"
)

// Note: These tests avoid ebiten.Image operations since they require
// a display on Linux. Tests focus on non-graphical functionality.

func TestNewTileset_CreatesValidInstance(t *testing.T) {
	ts := NewTileset()
	if ts == nil {
		t.Fatal("NewTileset() returned nil")
	}
	if ts.charMapping == nil {
		t.Error("charMapping should be initialized")
	}
}

func TestTileset_LoadConfig_SetsConfigCorrectly(t *testing.T) {
	ts := NewTileset()

	config := TilesetConfig{
		Name:       "TestTileset",
		Version:    "1.0",
		TileWidth:  16,
		TileHeight: 16,
		Mappings: []TileMapping{
			{Char: "@", X: 0, Y: 0},
			{Char: "#", X: 1, Y: 0},
			{Char: ".", X: 2, Y: 0},
		},
	}

	ts.LoadConfig(config)

	if ts.config.Name != "TestTileset" {
		t.Errorf("expected name 'TestTileset', got '%s'", ts.config.Name)
	}
	if ts.config.TileWidth != 16 {
		t.Errorf("expected TileWidth 16, got %d", ts.config.TileWidth)
	}
	if ts.config.TileHeight != 16 {
		t.Errorf("expected TileHeight 16, got %d", ts.config.TileHeight)
	}
}

func TestTileset_LoadConfig_BuildsCharMappingCorrectly(t *testing.T) {
	ts := NewTileset()

	config := TilesetConfig{
		TileWidth:  16,
		TileHeight: 16,
		Mappings: []TileMapping{
			{Char: "@", X: 0, Y: 0},
			{Char: "#", X: 1, Y: 2},
			{Char: ".", X: 5, Y: 3},
		},
	}

	ts.LoadConfig(config)

	tests := []struct {
		char      rune
		expectedX int
		expectedY int
	}{
		{'@', 0, 0},
		{'#', 1, 2},
		{'.', 5, 3},
	}

	for _, tt := range tests {
		x, y, found := ts.GetTilePosition(tt.char)
		if !found {
			t.Errorf("character '%c' not found in mapping", tt.char)
			continue
		}
		if x != tt.expectedX || y != tt.expectedY {
			t.Errorf("character '%c': expected (%d, %d), got (%d, %d)",
				tt.char, tt.expectedX, tt.expectedY, x, y)
		}
	}
}

func TestTileset_GetTilePosition_ReturnsFalseForUnknownChar(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		Mappings: []TileMapping{
			{Char: "@", X: 0, Y: 0},
		},
	})

	_, _, found := ts.GetTilePosition('X')
	if found {
		t.Error("expected found=false for unknown character")
	}
}

func TestTileset_GetTileSize_ReturnsConfiguredDimensions(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		TileWidth:  32,
		TileHeight: 24,
	})

	w, h := ts.GetTileSize()
	if w != 32 {
		t.Errorf("expected width 32, got %d", w)
	}
	if h != 24 {
		t.Errorf("expected height 24, got %d", h)
	}
}

func TestTileset_IsLoaded_ReturnsFalseWhenNoImage(t *testing.T) {
	ts := NewTileset()
	if ts.IsLoaded() {
		t.Error("expected IsLoaded() to return false without image")
	}
}

func TestTileset_GetConfig_ReturnsLoadedConfig(t *testing.T) {
	ts := NewTileset()
	config := TilesetConfig{
		Name:       "TestConfig",
		Version:    "2.0",
		TileWidth:  8,
		TileHeight: 8,
	}
	ts.LoadConfig(config)

	retrieved := ts.GetConfig()
	if retrieved.Name != config.Name {
		t.Errorf("expected name '%s', got '%s'", config.Name, retrieved.Name)
	}
	if retrieved.Version != config.Version {
		t.Errorf("expected version '%s', got '%s'", config.Version, retrieved.Version)
	}
}

func TestTileset_GetCharMapping_ReturnsMapping(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		Mappings: []TileMapping{
			{Char: "A", X: 1, Y: 1},
			{Char: "B", X: 2, Y: 2},
		},
	})

	mapping := ts.GetCharMapping()
	if mapping == nil {
		t.Fatal("GetCharMapping() returned nil")
	}
	if len(mapping) != 2 {
		t.Errorf("expected 2 mappings, got %d", len(mapping))
	}

	if pos, ok := mapping['A']; !ok {
		t.Error("mapping should contain 'A'")
	} else if pos != (image.Point{X: 1, Y: 1}) {
		t.Errorf("incorrect position for 'A': %v", pos)
	}
}

func TestTileset_Validate_FailsWithInvalidWidth(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		TileWidth:  0,
		TileHeight: 16,
	})

	if err := ts.Validate(); err == nil {
		t.Error("expected error for invalid tile width")
	}
}

func TestTileset_Validate_FailsWithInvalidHeight(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		TileWidth:  16,
		TileHeight: -1,
	})

	if err := ts.Validate(); err == nil {
		t.Error("expected error for invalid tile height")
	}
}

func TestTileset_Validate_SucceedsWithValidConfig(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		TileWidth:  16,
		TileHeight: 16,
	})

	if err := ts.Validate(); err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestTileset_LoadConfig_HandlesEmptyCharMapping(t *testing.T) {
	ts := NewTileset()
	ts.LoadConfig(TilesetConfig{
		Mappings: []TileMapping{
			{Char: "", X: 0, Y: 0}, // Empty char should be ignored
		},
	})

	if len(ts.charMapping) != 0 {
		t.Errorf("expected 0 mappings for empty chars, got %d", len(ts.charMapping))
	}
}

func TestTileset_LoadFromBytes_FailsWithInvalidData(t *testing.T) {
	ts := NewTileset()
	err := ts.LoadFromBytes([]byte("not an image"))
	if err == nil {
		t.Error("expected error for invalid image data")
	}
}
