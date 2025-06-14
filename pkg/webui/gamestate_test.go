package webui

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

// TestCell_JSONMarshaling tests JSON marshaling and unmarshaling of Cell struct
func TestCell_JSONMarshaling(t *testing.T) {
	tests := []struct {
		name string
		cell Cell
	}{
		{
			name: "BasicCell_DefaultValues",
			cell: Cell{
				Char:    'A',
				FgColor: "#FFFFFF",
				BgColor: "#000000",
				Bold:    false,
				Inverse: false,
				Blink:   false,
			},
		},
		{
			name: "CellWithAllAttributes_SetTrue",
			cell: Cell{
				Char:    '♠',
				FgColor: "#FF0000",
				BgColor: "#00FF00",
				Bold:    true,
				Inverse: true,
				Blink:   true,
				TileX:   10,
				TileY:   20,
				Changed: true,
			},
		},
		{
			name: "CellWithUnicodeChar_ValidRune",
			cell: Cell{
				Char:    '🎮',
				FgColor: "#FFFF00",
				BgColor: "#0000FF",
			},
		},
		{
			name: "CellWithZeroValues_EmptyAttributes",
			cell: Cell{
				Char:    0,
				FgColor: "",
				BgColor: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal to JSON
			data, err := json.Marshal(tt.cell)
			if err != nil {
				t.Fatalf("Failed to marshal Cell: %v", err)
			}

			// Unmarshal from JSON
			var unmarshaled Cell
			err = json.Unmarshal(data, &unmarshaled)
			if err != nil {
				t.Fatalf("Failed to unmarshal Cell: %v", err)
			}

			// Compare (note: Changed field has json:"-" tag so it won't be marshaled)
			expected := tt.cell
			expected.Changed = false // Reset because it's not marshaled
			if !reflect.DeepEqual(unmarshaled, expected) {
				t.Errorf("Cell mismatch after JSON round-trip:\nExpected: %+v\nGot: %+v", expected, unmarshaled)
			}
		})
	}
}

// TestCell_JSONOmitEmpty tests that TileX and TileY are omitted when zero
func TestCell_JSONOmitEmpty(t *testing.T) {
	cell := Cell{
		Char:    'X',
		FgColor: "#FFFFFF",
		BgColor: "#000000",
		TileX:   0,
		TileY:   0,
	}

	data, err := json.Marshal(cell)
	if err != nil {
		t.Fatalf("Failed to marshal Cell: %v", err)
	}

	jsonStr := string(data)
	if strings.Contains(jsonStr, "tile_x") || strings.Contains(jsonStr, "tile_y") {
		t.Errorf("Expected tile_x and tile_y to be omitted when zero, but got: %s", jsonStr)
	}
}

// TestGameState_JSONMarshaling tests JSON marshaling of GameState
func TestGameState_JSONMarshaling(t *testing.T) {
	now := time.Now().Unix()

	gameState := GameState{
		Buffer: [][]Cell{
			{
				{Char: 'H', FgColor: "#FFFFFF", BgColor: "#000000"},
				{Char: 'i', FgColor: "#FF0000", BgColor: "#000000"},
			},
			{
				{Char: '!', FgColor: "#00FF00", BgColor: "#000000"},
				{Char: ' ', FgColor: "#FFFFFF", BgColor: "#000000"},
			},
		},
		Width:     2,
		Height:    2,
		CursorX:   1,
		CursorY:   0,
		Version:   42,
		Timestamp: now,
	}

	// Marshal to JSON
	data, err := json.Marshal(gameState)
	if err != nil {
		t.Fatalf("Failed to marshal GameState: %v", err)
	}

	// Unmarshal from JSON
	var unmarshaled GameState
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal GameState: %v", err)
	}

	// Compare
	if !reflect.DeepEqual(unmarshaled, gameState) {
		t.Errorf("GameState mismatch after JSON round-trip:\nExpected: %+v\nGot: %+v", gameState, unmarshaled)
	}
}

// TestGameState_EmptyBuffer tests GameState with empty buffer
func TestGameState_EmptyBuffer(t *testing.T) {
	gameState := GameState{
		Buffer:    [][]Cell{},
		Width:     0,
		Height:    0,
		CursorX:   0,
		CursorY:   0,
		Version:   1,
		Timestamp: time.Now().Unix(),
	}

	data, err := json.Marshal(gameState)
	if err != nil {
		t.Fatalf("Failed to marshal empty GameState: %v", err)
	}

	var unmarshaled GameState
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal empty GameState: %v", err)
	}

	if !reflect.DeepEqual(unmarshaled, gameState) {
		t.Errorf("Empty GameState mismatch after JSON round-trip")
	}
}

// TestStateDiff_JSONMarshaling tests JSON marshaling of StateDiff
func TestStateDiff_JSONMarshaling(t *testing.T) {
	now := time.Now().Unix()

	stateDiff := StateDiff{
		Version: 100,
		Changes: []CellDiff{
			{
				X: 5,
				Y: 10,
				Cell: Cell{
					Char:    '@',
					FgColor: "#FFFF00",
					BgColor: "#800080",
					Bold:    true,
				},
			},
			{
				X: 0,
				Y: 0,
				Cell: Cell{
					Char:    ' ',
					FgColor: "#FFFFFF",
					BgColor: "#000000",
				},
			},
		},
		CursorX:   5,
		CursorY:   10,
		Timestamp: now,
	}

	// Marshal to JSON
	data, err := json.Marshal(stateDiff)
	if err != nil {
		t.Fatalf("Failed to marshal StateDiff: %v", err)
	}

	// Unmarshal from JSON
	var unmarshaled StateDiff
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal StateDiff: %v", err)
	}

	// Compare
	if !reflect.DeepEqual(unmarshaled, stateDiff) {
		t.Errorf("StateDiff mismatch after JSON round-trip:\nExpected: %+v\nGot: %+v", stateDiff, unmarshaled)
	}
}

// TestStateDiff_EmptyChanges tests StateDiff with no changes
func TestStateDiff_EmptyChanges(t *testing.T) {
	stateDiff := StateDiff{
		Version:   50,
		Changes:   []CellDiff{},
		CursorX:   0,
		CursorY:   0,
		Timestamp: time.Now().Unix(),
	}

	data, err := json.Marshal(stateDiff)
	if err != nil {
		t.Fatalf("Failed to marshal StateDiff with empty changes: %v", err)
	}

	var unmarshaled StateDiff
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal StateDiff with empty changes: %v", err)
	}

	if !reflect.DeepEqual(unmarshaled, stateDiff) {
		t.Errorf("StateDiff with empty changes mismatch after JSON round-trip")
	}
}

// TestCellDiff_JSONMarshaling tests JSON marshaling of CellDiff
func TestCellDiff_JSONMarshaling(t *testing.T) {
	tests := []struct {
		name     string
		cellDiff CellDiff
	}{
		{
			name: "BasicCellDiff_SimpleCharacter",
			cellDiff: CellDiff{
				X: 10,
				Y: 5,
				Cell: Cell{
					Char:    'Z',
					FgColor: "#FF00FF",
					BgColor: "#00FFFF",
				},
			},
		},
		{
			name: "CellDiffWithSpecialChar_UnicodeSymbol",
			cellDiff: CellDiff{
				X: -1, // Test negative coordinates
				Y: -1,
				Cell: Cell{
					Char:    '█',
					FgColor: "#808080",
					BgColor: "#404040",
					Bold:    true,
					Inverse: true,
					Blink:   true,
					TileX:   100,
					TileY:   200,
				},
			},
		},
		{
			name: "CellDiffAtOrigin_ZeroCoordinates",
			cellDiff: CellDiff{
				X: 0,
				Y: 0,
				Cell: Cell{
					Char:    '.',
					FgColor: "#FFFFFF",
					BgColor: "#000000",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal to JSON
			data, err := json.Marshal(tt.cellDiff)
			if err != nil {
				t.Fatalf("Failed to marshal CellDiff: %v", err)
			}

			// Unmarshal from JSON
			var unmarshaled CellDiff
			err = json.Unmarshal(data, &unmarshaled)
			if err != nil {
				t.Fatalf("Failed to unmarshal CellDiff: %v", err)
			}

			// Compare (Reset Changed field as it's not marshaled)
			expected := tt.cellDiff
			expected.Cell.Changed = false
			if !reflect.DeepEqual(unmarshaled, expected) {
				t.Errorf("CellDiff mismatch after JSON round-trip:\nExpected: %+v\nGot: %+v", expected, unmarshaled)
			}
		})
	}
}

// TestCell_Creation tests creating Cell structs with various configurations
func TestCell_Creation(t *testing.T) {
	t.Run("DefaultCell_ZeroValues", func(t *testing.T) {
		var cell Cell

		if cell.Char != 0 {
			t.Errorf("Expected default Char to be 0, got %v", cell.Char)
		}
		if cell.FgColor != "" {
			t.Errorf("Expected default FgColor to be empty, got %v", cell.FgColor)
		}
		if cell.Bold != false {
			t.Errorf("Expected default Bold to be false, got %v", cell.Bold)
		}
	})

	t.Run("InitializedCell_SetValues", func(t *testing.T) {
		cell := Cell{
			Char:    'A',
			FgColor: "#FFFFFF",
			BgColor: "#000000",
			Bold:    true,
			Changed: true,
		}

		if cell.Char != 'A' {
			t.Errorf("Expected Char to be 'A', got %v", cell.Char)
		}
		if cell.FgColor != "#FFFFFF" {
			t.Errorf("Expected FgColor to be '#FFFFFF', got %v", cell.FgColor)
		}
		if !cell.Bold {
			t.Errorf("Expected Bold to be true, got %v", cell.Bold)
		}
		if !cell.Changed {
			t.Errorf("Expected Changed to be true, got %v", cell.Changed)
		}
	})
}

// TestGameState_Creation tests creating GameState structs
func TestGameState_Creation(t *testing.T) {
	t.Run("EmptyGameState_DefaultValues", func(t *testing.T) {
		var state GameState

		if state.Buffer != nil {
			t.Errorf("Expected default Buffer to be nil, got %v", state.Buffer)
		}
		if state.Width != 0 {
			t.Errorf("Expected default Width to be 0, got %v", state.Width)
		}
		if state.Version != 0 {
			t.Errorf("Expected default Version to be 0, got %v", state.Version)
		}
	})

	t.Run("InitializedGameState_WithBuffer", func(t *testing.T) {
		buffer := [][]Cell{
			{{Char: 'H'}, {Char: 'i'}},
			{{Char: '!'}, {Char: ' '}},
		}

		state := GameState{
			Buffer:    buffer,
			Width:     2,
			Height:    2,
			CursorX:   1,
			CursorY:   1,
			Version:   1,
			Timestamp: 1234567890,
		}

		if len(state.Buffer) != 2 {
			t.Errorf("Expected Buffer to have 2 rows, got %d", len(state.Buffer))
		}
		if len(state.Buffer[0]) != 2 {
			t.Errorf("Expected Buffer row to have 2 columns, got %d", len(state.Buffer[0]))
		}
		if state.Buffer[0][0].Char != 'H' {
			t.Errorf("Expected first cell to be 'H', got %v", state.Buffer[0][0].Char)
		}
		if state.CursorX != 1 {
			t.Errorf("Expected CursorX to be 1, got %v", state.CursorX)
		}
		if state.Version != 1 {
			t.Errorf("Expected Version to be 1, got %v", state.Version)
		}
	})
}

// TestStructFieldTypes tests that struct fields have correct types
func TestStructFieldTypes(t *testing.T) {
	t.Run("Cell_FieldTypes", func(t *testing.T) {
		var cell Cell

		// Test field types using reflection
		cellType := reflect.TypeOf(cell)

		charField, found := cellType.FieldByName("Char")
		if !found {
			t.Error("Char field not found")
		}
		if charField.Type.Kind() != reflect.Int32 { // rune is int32
			t.Errorf("Expected Char field to be rune (int32), got %v", charField.Type.Kind())
		}

		fgColorField, found := cellType.FieldByName("FgColor")
		if !found {
			t.Error("FgColor field not found")
		}
		if fgColorField.Type.Kind() != reflect.String {
			t.Errorf("Expected FgColor field to be string, got %v", fgColorField.Type.Kind())
		}

		boldField, found := cellType.FieldByName("Bold")
		if !found {
			t.Error("Bold field not found")
		}
		if boldField.Type.Kind() != reflect.Bool {
			t.Errorf("Expected Bold field to be bool, got %v", boldField.Type.Kind())
		}
	})

	t.Run("GameState_FieldTypes", func(t *testing.T) {
		var state GameState

		stateType := reflect.TypeOf(state)

		bufferField, found := stateType.FieldByName("Buffer")
		if !found {
			t.Error("Buffer field not found")
		}
		if bufferField.Type.Kind() != reflect.Slice {
			t.Errorf("Expected Buffer field to be slice, got %v", bufferField.Type.Kind())
		}

		versionField, found := stateType.FieldByName("Version")
		if !found {
			t.Error("Version field not found")
		}
		if versionField.Type.Kind() != reflect.Uint64 {
			t.Errorf("Expected Version field to be uint64, got %v", versionField.Type.Kind())
		}
	})
}
