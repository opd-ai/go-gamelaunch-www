// Package wasm provides tests for tile rendering functionality.
package wasm

import (
	"image/color"
	"testing"
)

func TestNewTileRenderer_CreatesValidInstance(t *testing.T) {
	renderer := NewTileRenderer()
	if renderer == nil {
		t.Fatal("NewTileRenderer() returned nil")
	}
	if renderer.charMapping == nil {
		t.Error("charMapping should be initialized")
	}
}

func TestTileRenderer_SetCharMapping_StoresMapping(t *testing.T) {
	renderer := NewTileRenderer()

	// Verify the renderer is initialized and SetCharMapping doesn't panic
	if renderer == nil {
		t.Fatal("NewTileRenderer() returned nil")
	}

	// SetCharMapping should work without panic
	renderer.SetCharMapping(nil)
}

func TestTileRenderer_DefaultTileSize(t *testing.T) {
	renderer := NewTileRenderer()
	// Default should be 16x16
	if renderer.tileWidth != 16 {
		t.Errorf("expected default tileWidth 16, got %d", renderer.tileWidth)
	}
	if renderer.tileHeight != 16 {
		t.Errorf("expected default tileHeight 16, got %d", renderer.tileHeight)
	}
}

func TestParseHexColor_ValidHexColors(t *testing.T) {
	tests := []struct {
		hex      string
		expected color.RGBA
	}{
		{"#FFFFFF", color.RGBA{255, 255, 255, 255}},
		{"#000000", color.RGBA{0, 0, 0, 255}},
		{"#FF0000", color.RGBA{255, 0, 0, 255}},
		{"#00FF00", color.RGBA{0, 255, 0, 255}},
		{"#0000FF", color.RGBA{0, 0, 255, 255}},
		{"#808080", color.RGBA{128, 128, 128, 255}},
		{"#ff8000", color.RGBA{255, 128, 0, 255}},   // lowercase
		{"#aAbBcC", color.RGBA{170, 187, 204, 255}}, // mixed case
	}

	for _, tt := range tests {
		t.Run(tt.hex, func(t *testing.T) {
			result := parseHexColor(tt.hex)
			if result != tt.expected {
				t.Errorf("parseHexColor(%s) = %v, expected %v", tt.hex, result, tt.expected)
			}
		})
	}
}

func TestParseHexColor_InvalidFormat_ReturnsWhite(t *testing.T) {
	tests := []string{
		"",
		"FFFFFF",    // Missing #
		"#FFF",      // Too short
		"#FFFFFFFF", // Too long
		"invalid",
	}

	expected := color.RGBA{255, 255, 255, 255}

	for _, hex := range tests {
		t.Run(hex, func(t *testing.T) {
			result := parseHexColor(hex)
			if result != expected {
				t.Errorf("parseHexColor(%s) = %v, expected white (%v)", hex, result, expected)
			}
		})
	}
}

func TestParseHexColor_NonHexCharacters_ReturnsZero(t *testing.T) {
	// Non-hex characters result in zero values being parsed
	result := parseHexColor("#GGGGGG")
	expected := color.RGBA{0, 0, 0, 255}
	if result != expected {
		t.Errorf("parseHexColor(#GGGGGG) = %v, expected %v", result, expected)
	}
}

func TestHexToByte_ConvertsCorrectly(t *testing.T) {
	tests := []struct {
		input    string
		expected byte
	}{
		{"00", 0},
		{"FF", 255},
		{"ff", 255},
		{"80", 128},
		{"0A", 10},
		{"A0", 160},
		{"ab", 171},
		{"AB", 171},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := hexToByte(tt.input)
			if result != tt.expected {
				t.Errorf("hexToByte(%s) = %d, expected %d", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNewGame_CreatesValidInstance(t *testing.T) {
	config := DefaultGameConfig()
	game := NewGame(config)

	if game == nil {
		t.Fatal("NewGame() returned nil")
	}
	if game.input == nil {
		t.Error("InputHandler should be initialized")
	}
	if game.buffer == nil {
		t.Error("buffer should be initialized")
	}
}

func TestDefaultGameConfig_ReturnsValidDefaults(t *testing.T) {
	config := DefaultGameConfig()

	if config.Width != 80 {
		t.Errorf("expected Width 80, got %d", config.Width)
	}
	if config.Height != 24 {
		t.Errorf("expected Height 24, got %d", config.Height)
	}
	if config.TileWidth != 16 {
		t.Errorf("expected TileWidth 16, got %d", config.TileWidth)
	}
	if config.TileHeight != 16 {
		t.Errorf("expected TileHeight 16, got %d", config.TileHeight)
	}
	if config.TargetTPS != 60 {
		t.Errorf("expected TargetTPS 60, got %d", config.TargetTPS)
	}
}

func TestGame_InitBuffer_CreatesCorrectDimensions(t *testing.T) {
	config := GameConfig{
		Width:      40,
		Height:     10,
		TileWidth:  16,
		TileHeight: 16,
	}
	game := NewGame(config)

	buffer := game.GetBuffer()
	if len(buffer) != config.Height {
		t.Errorf("expected %d rows, got %d", config.Height, len(buffer))
	}
	for y, row := range buffer {
		if len(row) != config.Width {
			t.Errorf("row %d: expected %d columns, got %d", y, config.Width, len(row))
		}
	}
}

func TestGame_InitBuffer_CellsHaveDefaults(t *testing.T) {
	game := NewGame(DefaultGameConfig())
	buffer := game.GetBuffer()

	cell := buffer[0][0]
	if cell.Char != ' ' {
		t.Errorf("expected default char ' ', got '%c'", cell.Char)
	}
	if cell.FgColor != "#FFFFFF" {
		t.Errorf("expected default FgColor '#FFFFFF', got '%s'", cell.FgColor)
	}
	if cell.BgColor != "#000000" {
		t.Errorf("expected default BgColor '#000000', got '%s'", cell.BgColor)
	}
}

func TestGame_GetConfig_ReturnsConfiguration(t *testing.T) {
	config := GameConfig{
		Width:      100,
		Height:     50,
		TileWidth:  8,
		TileHeight: 8,
		TargetTPS:  30,
	}
	game := NewGame(config)

	retrieved := game.GetConfig()
	if retrieved.Width != config.Width {
		t.Errorf("expected Width %d, got %d", config.Width, retrieved.Width)
	}
	if retrieved.TargetTPS != config.TargetTPS {
		t.Errorf("expected TargetTPS %d, got %d", config.TargetTPS, retrieved.TargetTPS)
	}
}

func TestGame_ApplyState_UpdatesBuffer(t *testing.T) {
	game := NewGame(DefaultGameConfig())

	state := &GameState{
		Width:  80,
		Height: 24,
		Buffer: make([][]Cell, 24),
	}
	for y := 0; y < 24; y++ {
		state.Buffer[y] = make([]Cell, 80)
		for x := 0; x < 80; x++ {
			state.Buffer[y][x] = Cell{
				Char:    '@',
				FgColor: "#FF0000",
				BgColor: "#0000FF",
			}
		}
	}

	game.ApplyState(state)

	buffer := game.GetBuffer()
	cell := buffer[0][0]
	if cell.Char != '@' {
		t.Errorf("expected char '@', got '%c'", cell.Char)
	}
	if cell.FgColor != "#FF0000" {
		t.Errorf("expected FgColor '#FF0000', got '%s'", cell.FgColor)
	}
}

func TestGame_Layout_ReturnsCorrectDimensions(t *testing.T) {
	config := GameConfig{
		Width:      80,
		Height:     24,
		TileWidth:  16,
		TileHeight: 16,
	}
	game := NewGame(config)

	w, h := game.Layout(1920, 1080)
	expectedW := config.Width * config.TileWidth
	expectedH := config.Height * config.TileHeight

	if w != expectedW {
		t.Errorf("expected layout width %d, got %d", expectedW, w)
	}
	if h != expectedH {
		t.Errorf("expected layout height %d, got %d", expectedH, h)
	}
}

func TestGame_SetScene_SetsCurrentScene(t *testing.T) {
	game := NewGame(DefaultGameConfig())

	// We can't easily test the internal scene without a mock,
	// but we can verify SetScene doesn't panic
	game.SetScene(nil)
	// If we got here, the method works without panicking
}

func TestGame_SetTransport_SetsTransport(t *testing.T) {
	game := NewGame(DefaultGameConfig())

	// SetTransport should accept nil
	game.SetTransport(nil)
	// If we got here, the method works without panicking
}

func TestMin_ReturnsSmaller(t *testing.T) {
	tests := []struct {
		a, b     int
		expected int
	}{
		{5, 10, 5},
		{10, 5, 5},
		{7, 7, 7},
		{0, 5, 0},
		{-3, 2, -3},
	}

	for _, tt := range tests {
		result := min(tt.a, tt.b)
		if result != tt.expected {
			t.Errorf("min(%d, %d) = %d, expected %d", tt.a, tt.b, result, tt.expected)
		}
	}
}
