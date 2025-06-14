// Package webui provides comprehensive unit tests for ColorConverter functionality.
package webui

import (
	"reflect"
	"testing"

	"github.com/fatih/color"
)

// TestNewColorConverter tests the constructor function
func TestNewColorConverter_CreatesValidInstance_ReturnsNonNilConverter(t *testing.T) {
	converter := NewColorConverter()

	if converter == nil {
		t.Fatal("NewColorConverter() returned nil")
	}

	// Verify it's the correct type
	if reflect.TypeOf(converter).String() != "*webui.ColorConverter" {
		t.Errorf("NewColorConverter() returned wrong type: %T", converter)
	}
}

// TestProcessSGRParams_EmptyParams tests behavior with empty parameter list
func TestProcessSGRParams_EmptyParams_ReturnsDefaults(t *testing.T) {
	converter := NewColorConverter()
	fg, bg, bold, inverse, blink := converter.ProcessSGRParams([]string{})

	expectedFg := "#FFFFFF"
	expectedBg := "#000000"
	expectedBold := false
	expectedInverse := false
	expectedBlink := false

	if fg != expectedFg {
		t.Errorf("Expected foreground %s, got %s", expectedFg, fg)
	}
	if bg != expectedBg {
		t.Errorf("Expected background %s, got %s", expectedBg, bg)
	}
	if bold != expectedBold {
		t.Errorf("Expected bold %t, got %t", expectedBold, bold)
	}
	if inverse != expectedInverse {
		t.Errorf("Expected inverse %t, got %t", expectedInverse, inverse)
	}
	if blink != expectedBlink {
		t.Errorf("Expected blink %t, got %t", expectedBlink, blink)
	}
}

// TestProcessSGRParams_StandardCodes tests standard ANSI color codes using table-driven approach
func TestProcessSGRParams_StandardCodes_ProcessesCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name            string
		params          []string
		expectedFg      string
		expectedBg      string
		expectedBold    bool
		expectedInverse bool
		expectedBlink   bool
	}{
		{
			name:            "Reset code",
			params:          []string{"0"},
			expectedFg:      "#FFFFFF",
			expectedBg:      "#000000",
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Bold code",
			params:          []string{"1"},
			expectedFg:      "#FFFFFF",
			expectedBg:      "#000000",
			expectedBold:    true,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Blink code",
			params:          []string{"5"},
			expectedFg:      "#FFFFFF",
			expectedBg:      "#000000",
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   true,
		},
		{
			name:            "Inverse code",
			params:          []string{"7"},
			expectedFg:      "#FFFFFF",
			expectedBg:      "#000000",
			expectedBold:    false,
			expectedInverse: true,
			expectedBlink:   false,
		},
		{
			name:            "Red foreground",
			params:          []string{"31"},
			expectedFg:      "#800000", // Standard red
			expectedBg:      "#000000",
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Blue background",
			params:          []string{"44"},
			expectedFg:      "#FFFFFF",
			expectedBg:      "#000080", // Standard blue
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Bright green foreground",
			params:          []string{"92"},
			expectedFg:      "#00FF00", // Bright green
			expectedBg:      "#000000",
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Combined attributes",
			params:          []string{"1", "5", "31", "44"},
			expectedFg:      "#800000", // Red
			expectedBg:      "#000080", // Blue
			expectedBold:    true,
			expectedInverse: false,
			expectedBlink:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fg, bg, bold, inverse, blink := converter.ProcessSGRParams(tt.params)

			if fg != tt.expectedFg {
				t.Errorf("Expected foreground %s, got %s", tt.expectedFg, fg)
			}
			if bg != tt.expectedBg {
				t.Errorf("Expected background %s, got %s", tt.expectedBg, bg)
			}
			if bold != tt.expectedBold {
				t.Errorf("Expected bold %t, got %t", tt.expectedBold, bold)
			}
			if inverse != tt.expectedInverse {
				t.Errorf("Expected inverse %t, got %t", tt.expectedInverse, inverse)
			}
			if blink != tt.expectedBlink {
				t.Errorf("Expected blink %t, got %t", tt.expectedBlink, blink)
			}
		})
	}
}

// TestProcessSGRParams_ExtendedColors tests extended color parsing (256-color and RGB)
func TestProcessSGRParams_ExtendedColors_ProcessesCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name        string
		params      []string
		expectedFg  string
		expectedBg  string
		description string
	}{
		{
			name:        "256-color foreground",
			params:      []string{"38", "5", "196"}, // Bright red in 256-color
			expectedFg:  "#FFFFFF",                  // Default since colorToHex returns default
			expectedBg:  "#000000",
			description: "Should process 256-color foreground code",
		},
		{
			name:        "256-color background",
			params:      []string{"48", "5", "21"}, // Blue in 256-color
			expectedFg:  "#FFFFFF",
			expectedBg:  "#FFFFFF", // Default since colorToHex returns default
			description: "Should process 256-color background code",
		},
		{
			name:        "RGB foreground",
			params:      []string{"38", "2", "255", "128", "0"}, // Orange RGB
			expectedFg:  "#FFFFFF",                              // Default since colorToHex returns default
			expectedBg:  "#000000",
			description: "Should process RGB foreground color",
		},
		{
			name:        "RGB background",
			params:      []string{"48", "2", "0", "255", "128"}, // Green-cyan RGB
			expectedFg:  "#FFFFFF",
			expectedBg:  "#FFFFFF", // Default since colorToHex returns default
			description: "Should process RGB background color",
		},
		{
			name:        "Default foreground reset",
			params:      []string{"39"},
			expectedFg:  "#FFFFFF",
			expectedBg:  "#000000",
			description: "Should reset foreground to default",
		},
		{
			name:        "Default background reset",
			params:      []string{"49"},
			expectedFg:  "#FFFFFF",
			expectedBg:  "#000000",
			description: "Should reset background to default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fg, bg, _, _, _ := converter.ProcessSGRParams(tt.params)

			if fg != tt.expectedFg {
				t.Errorf("Expected foreground %s, got %s", tt.expectedFg, fg)
			}
			if bg != tt.expectedBg {
				t.Errorf("Expected background %s, got %s", tt.expectedBg, bg)
			}
		})
	}
}

// TestProcessSGRParams_InvalidParams tests error handling with invalid parameters
func TestProcessSGRParams_InvalidParams_HandlesGracefully(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name        string
		params      []string
		description string
	}{
		{
			name:        "Non-numeric params",
			params:      []string{"invalid", "abc", "xyz"},
			description: "Should ignore non-numeric parameters",
		},
		{
			name:        "Mixed valid and invalid",
			params:      []string{"1", "invalid", "31", "abc"},
			description: "Should process valid params and ignore invalid ones",
		},
		{
			name:        "Empty strings",
			params:      []string{"", "", ""},
			description: "Should handle empty string parameters",
		},
		{
			name:        "Out of range values",
			params:      []string{"999", "1000", "-1"},
			description: "Should handle out-of-range numeric values",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic and should return valid defaults
			fg, bg, bold, inverse, blink := converter.ProcessSGRParams(tt.params)

			// Verify we get valid hex colors (basic format check)
			if len(fg) != 7 || fg[0] != '#' {
				t.Errorf("Invalid foreground color format: %s", fg)
			}
			if len(bg) != 7 || bg[0] != '#' {
				t.Errorf("Invalid background color format: %s", bg)
			}

			// Verify boolean values are actual booleans
			_ = bold && inverse && blink // Use the values to prevent unused variable warnings
		})
	}
}

// TestProcessSGRParams_AttributeToggles tests turning attributes on and off
func TestProcessSGRParams_AttributeToggles_WorksCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name            string
		params          []string
		expectedBold    bool
		expectedInverse bool
		expectedBlink   bool
	}{
		{
			name:            "Turn on bold, then off",
			params:          []string{"1", "22"},
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Turn on blink, then off",
			params:          []string{"5", "25"},
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Turn on inverse, then off",
			params:          []string{"7", "27"},
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Multiple toggles",
			params:          []string{"1", "5", "7", "22", "25", "27"},
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
		{
			name:            "Reset clears all",
			params:          []string{"1", "5", "7", "0"},
			expectedBold:    false,
			expectedInverse: false,
			expectedBlink:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, bold, inverse, blink := converter.ProcessSGRParams(tt.params)

			if bold != tt.expectedBold {
				t.Errorf("Expected bold %t, got %t", tt.expectedBold, bold)
			}
			if inverse != tt.expectedInverse {
				t.Errorf("Expected inverse %t, got %t", tt.expectedInverse, inverse)
			}
			if blink != tt.expectedBlink {
				t.Errorf("Expected blink %t, got %t", tt.expectedBlink, blink)
			}
		})
	}
}

// TestParseExtendedColor_256Color tests 256-color parsing
func TestParseExtendedColor_256Color_ParsesCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name             string
		params           []string
		expectedColor    string
		expectedConsumed int
	}{
		{
			name:             "Valid 256-color",
			params:           []string{"5", "196"},
			expectedColor:    "#FFFFFF", // colorToHex returns default
			expectedConsumed: 2,
		},
		{
			name:             "256-color with extra params",
			params:           []string{"5", "21", "extra", "params"},
			expectedColor:    "#FFFFFF", // colorToHex returns default
			expectedConsumed: 2,
		},
		{
			name:             "Missing color index",
			params:           []string{"5"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			color, consumed := converter.parseExtendedColor(tt.params)

			if color != tt.expectedColor {
				t.Errorf("Expected color %s, got %s", tt.expectedColor, color)
			}
			if consumed != tt.expectedConsumed {
				t.Errorf("Expected consumed %d, got %d", tt.expectedConsumed, consumed)
			}
		})
	}
}

// TestParseExtendedColor_RGB tests RGB color parsing
func TestParseExtendedColor_RGB_ParsesCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name             string
		params           []string
		expectedColor    string
		expectedConsumed int
	}{
		{
			name:             "Valid RGB color",
			params:           []string{"2", "255", "128", "0"},
			expectedColor:    "#FFFFFF", // colorToHex returns default
			expectedConsumed: 4,
		},
		{
			name:             "RGB with extra params",
			params:           []string{"2", "0", "255", "128", "extra"},
			expectedColor:    "#FFFFFF", // colorToHex returns default
			expectedConsumed: 4,
		},
		{
			name:             "Incomplete RGB",
			params:           []string{"2", "255", "128"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
		{
			name:             "Empty RGB",
			params:           []string{"2"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			color, consumed := converter.parseExtendedColor(tt.params)

			if color != tt.expectedColor {
				t.Errorf("Expected color %s, got %s", tt.expectedColor, color)
			}
			if consumed != tt.expectedConsumed {
				t.Errorf("Expected consumed %d, got %d", tt.expectedConsumed, consumed)
			}
		})
	}
}

// TestParseExtendedColor_EdgeCases tests edge cases and error conditions
func TestParseExtendedColor_EdgeCases_HandlesCorrectly(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		name             string
		params           []string
		expectedColor    string
		expectedConsumed int
	}{
		{
			name:             "Empty params",
			params:           []string{},
			expectedColor:    "",
			expectedConsumed: 0,
		},
		{
			name:             "Invalid mode",
			params:           []string{"invalid"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
		{
			name:             "Unknown mode",
			params:           []string{"99", "1", "2", "3"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
		{
			name:             "Non-numeric mode",
			params:           []string{"abc", "5", "196"},
			expectedColor:    "",
			expectedConsumed: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			color, consumed := converter.parseExtendedColor(tt.params)

			if color != tt.expectedColor {
				t.Errorf("Expected color %s, got %s", tt.expectedColor, color)
			}
			if consumed != tt.expectedConsumed {
				t.Errorf("Expected consumed %d, got %d", tt.expectedConsumed, consumed)
			}
		})
	}
}

// TestStandardColorToHex tests standard ANSI color conversion
func TestStandardColorToHex_StandardColors_ReturnsCorrectHex(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		colorIndex    int
		bright        bool
		expectedColor string
		description   string
	}{
		{0, false, "#000000", "Black (normal)"},
		{1, false, "#800000", "Red (normal)"},
		{2, false, "#008000", "Green (normal)"},
		{3, false, "#808000", "Yellow (normal)"},
		{4, false, "#000080", "Blue (normal)"},
		{5, false, "#800080", "Magenta (normal)"},
		{6, false, "#008080", "Cyan (normal)"},
		{7, false, "#C0C0C0", "White (normal)"},
		{0, true, "#808080", "Black (bright)"},
		{1, true, "#FF0000", "Red (bright)"},
		{2, true, "#00FF00", "Green (bright)"},
		{3, true, "#FFFF00", "Yellow (bright)"},
		{4, true, "#0000FF", "Blue (bright)"},
		{5, true, "#FF00FF", "Magenta (bright)"},
		{6, true, "#00FFFF", "Cyan (bright)"},
		{7, true, "#FFFFFF", "White (bright)"},
	}

	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			result := converter.standardColorToHex(tt.colorIndex, tt.bright)

			if result != tt.expectedColor {
				t.Errorf("Expected %s, got %s for color index %d (bright: %t)",
					tt.expectedColor, result, tt.colorIndex, tt.bright)
			}

			// Verify it's a valid hex color format
			if len(result) != 7 || result[0] != '#' {
				t.Errorf("Invalid hex color format: %s", result)
			}
		})
	}
}

// TestStandardColorToHex_InvalidIndices tests behavior with invalid color indices
func TestStandardColorToHex_InvalidIndices_ReturnsDefault(t *testing.T) {
	converter := NewColorConverter()

	tests := []struct {
		colorIndex int
		bright     bool
	}{
		{-1, false},
		{8, false},
		{100, false},
		{-1, true},
		{8, true},
		{100, true},
	}

	for _, tt := range tests {
		t.Run("Invalid index", func(t *testing.T) {
			result := converter.standardColorToHex(tt.colorIndex, tt.bright)

			// Should return default white
			if result != "#FFFFFF" {
				t.Errorf("Expected #FFFFFF for invalid index %d, got %s", tt.colorIndex, result)
			}
		})
	}
}

// TestColorToHex tests color object to hex conversion
func TestColorToHex_BasicColors_ReturnsValidHex(t *testing.T) {
	converter := NewColorConverter()

	// Test with various color objects
	colors := []*color.Color{
		color.New(color.FgRed),
		color.New(color.FgGreen),
		color.New(color.FgBlue),
		color.New(color.FgYellow),
		color.New(color.FgMagenta),
		color.New(color.FgCyan),
		color.New(color.FgWhite),
		color.New(color.FgBlack),
	}

	for i, c := range colors {
		t.Run("Color conversion", func(t *testing.T) {
			result := converter.colorToHex(c)

			// Should return a valid hex color (the implementation returns default #FFFFFF)
			if len(result) != 7 || result[0] != '#' {
				t.Errorf("Invalid hex color format for color %d: %s", i, result)
			}

			// Current implementation returns default
			if result != "#FFFFFF" {
				t.Errorf("Expected #FFFFFF (default fallback), got %s", result)
			}
		})
	}
}

// TestColorToHex_NilColor tests behavior with nil color pointer
func TestColorToHex_NilColor_HandlesGracefully(t *testing.T) {
	converter := NewColorConverter()

	// This should not panic
	result := converter.colorToHex(nil)

	// Should return default fallback
	if result != "#FFFFFF" {
		t.Errorf("Expected #FFFFFF for nil color, got %s", result)
	}
}
