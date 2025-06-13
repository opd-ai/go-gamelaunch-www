// Package webui provides utility functions shared across the webui package.
// This file contains comprehensive unit tests for utils.go
package webui

import (
	"testing"
)

// TestIsValidColor_ValidHexColors tests isValidColor with valid hex color formats
func TestIsValidColor_ValidHexColors_ReturnsTrue(t *testing.T) {
	tests := []struct {
		name  string
		color string
	}{
		{"3-digit hex", "#abc"},
		{"3-digit hex uppercase", "#ABC"},
		{"3-digit hex mixed case", "#aBc"},
		{"6-digit hex lowercase", "#abcdef"},
		{"6-digit hex uppercase", "#ABCDEF"},
		{"6-digit hex mixed case", "#aBcDeF"},
		{"numeric hex", "#123456"},
		{"mixed alphanumeric", "#a1b2c3"},
		{"all zeros short", "#000"},
		{"all zeros long", "#000000"},
		{"all f's short", "#fff"},
		{"all f's long", "#ffffff"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidColor(tt.color)
			if !result {
				t.Errorf("isValidColor(%s) = %v, want %v", tt.color, result, true)
			}
		})
	}
}

// TestIsValidColor_InvalidHexColors tests isValidColor with invalid hex color formats
func TestIsValidColor_InvalidHexColors_ReturnsFalse(t *testing.T) {
	tests := []struct {
		name  string
		color string
	}{
		{"no hash prefix", "abc123"},
		{"empty string", ""},
		{"only hash", "#"},
		{"too short", "#ab"},
		{"too long", "#abcdefg"},
		{"invalid length 4", "#abcd"},
		{"invalid length 5", "#abcde"},
		{"invalid character G", "#abcdeG"},
		{"invalid character space", "#abc ef"},
		{"invalid character special", "#abc@ef"},
		{"lowercase g", "#abcdeg"},
		{"numeric out of range", "#xyz123"},
		{"hash in middle", "ab#cde"},
		{"multiple hashes", "##abcde"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidColor(tt.color)
			if result {
				t.Errorf("isValidColor(%s) = %v, want %v", tt.color, result, false)
			}
		})
	}
}

// TestColor256_ValidIndices tests Color256 with various valid color indices
func TestColor256_ValidIndices_ReturnsColorObject(t *testing.T) {
	tests := []struct {
		name  string
		index uint8
	}{
		{"black", 0},
		{"red", 1},
		{"green", 2},
		{"standard color boundary", 15},
		{"216-color cube start", 16},
		{"216-color cube middle", 100},
		{"216-color cube end", 231},
		{"grayscale start", 232},
		{"grayscale middle", 240},
		{"grayscale end", 255},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Color256(tt.index)
			if result == nil {
				t.Errorf("Color256(%d) returned nil, expected color object", tt.index)
			}
			// Verify it's a valid color.Color object by checking it has expected methods
			_ = result.SprintFunc()
		})
	}
}

// TestColor256ToRGB_StandardColors tests color256ToRGB for standard 16 colors
func TestColor256ToRGB_StandardColors_ReturnsExpectedRGB(t *testing.T) {
	tests := []struct {
		name      string
		index     uint8
		expectedR int
		expectedG int
		expectedB int
	}{
		{"black", 0, 0, 0, 0},
		{"red", 1, 128, 0, 0},
		{"green", 2, 0, 128, 0},
		{"yellow", 3, 128, 128, 0},
		{"blue", 4, 0, 0, 128},
		{"magenta", 5, 128, 0, 128},
		{"cyan", 6, 0, 128, 128},
		{"white", 7, 192, 192, 192},
		{"bright black", 8, 128, 128, 128},
		{"bright red", 9, 255, 0, 0},
		{"bright green", 10, 0, 255, 0},
		{"bright yellow", 11, 255, 255, 0},
		{"bright blue", 12, 0, 0, 255},
		{"bright magenta", 13, 255, 0, 255},
		{"bright cyan", 14, 0, 255, 255},
		{"bright white", 15, 255, 255, 255},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, g, b := color256ToRGB(tt.index)
			if r != tt.expectedR || g != tt.expectedG || b != tt.expectedB {
				t.Errorf("color256ToRGB(%d) = (%d, %d, %d), want (%d, %d, %d)",
					tt.index, r, g, b, tt.expectedR, tt.expectedG, tt.expectedB)
			}
		})
	}
}

// TestColor256ToRGB_216ColorCube tests color256ToRGB for 216-color cube range
func TestColor256ToRGB_216ColorCube_ReturnsCalculatedRGB(t *testing.T) {
	tests := []struct {
		name      string
		index     uint8
		expectedR int
		expectedG int
		expectedB int
	}{
		{"cube start", 16, 0, 0, 0},        // (0,0,0) * 51
		{"cube red", 52, 51, 0, 0},         // (1,0,0) * 51
		{"cube green", 22, 0, 51, 0},       // (0,1,0) * 51
		{"cube blue", 17, 0, 0, 51},        // (0,0,1) * 51
		{"cube white", 231, 255, 255, 255}, // (5,5,5) * 51
		{"cube mid", 100, 102, 51, 102},    // calculated for index 100
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, g, b := color256ToRGB(tt.index)
			if r != tt.expectedR || g != tt.expectedG || b != tt.expectedB {
				t.Errorf("color256ToRGB(%d) = (%d, %d, %d), want (%d, %d, %d)",
					tt.index, r, g, b, tt.expectedR, tt.expectedG, tt.expectedB)
			}
		})
	}
}

// TestColor256ToRGB_GrayscaleRamp tests color256ToRGB for grayscale colors (232-255)
func TestColor256ToRGB_GrayscaleRamp_ReturnsGrayscaleRGB(t *testing.T) {
	tests := []struct {
		name         string
		index        uint8
		expectedGray int
	}{
		{"grayscale start", 232, 8},     // (232-232)*10 + 8 = 8
		{"grayscale step 1", 233, 18},   // (233-232)*10 + 8 = 18
		{"grayscale step 5", 237, 58},   // (237-232)*10 + 8 = 58
		{"grayscale step 10", 242, 108}, // (242-232)*10 + 8 = 108
		{"grayscale end", 255, 238},     // (255-232)*10 + 8 = 238
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, g, b := color256ToRGB(tt.index)
			if r != tt.expectedGray || g != tt.expectedGray || b != tt.expectedGray {
				t.Errorf("color256ToRGB(%d) = (%d, %d, %d), want (%d, %d, %d)",
					tt.index, r, g, b, tt.expectedGray, tt.expectedGray, tt.expectedGray)
			}
		})
	}
}

// TestStandardColor16ToRGB_AllStandardColors tests standardColor16ToRGB for all 16 standard colors
func TestStandardColor16ToRGB_AllStandardColors_ReturnsExpectedRGB(t *testing.T) {
	tests := []struct {
		name      string
		index     uint8
		expectedR int
		expectedG int
		expectedB int
	}{
		{"black", 0, 0, 0, 0},
		{"red", 1, 128, 0, 0},
		{"green", 2, 0, 128, 0},
		{"yellow", 3, 128, 128, 0},
		{"blue", 4, 0, 0, 128},
		{"magenta", 5, 128, 0, 128},
		{"cyan", 6, 0, 128, 128},
		{"white", 7, 192, 192, 192},
		{"bright black", 8, 128, 128, 128},
		{"bright red", 9, 255, 0, 0},
		{"bright green", 10, 0, 255, 0},
		{"bright yellow", 11, 255, 255, 0},
		{"bright blue", 12, 0, 0, 255},
		{"bright magenta", 13, 255, 0, 255},
		{"bright cyan", 14, 0, 255, 255},
		{"bright white", 15, 255, 255, 255},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, g, b := standardColor16ToRGB(tt.index)
			if r != tt.expectedR || g != tt.expectedG || b != tt.expectedB {
				t.Errorf("standardColor16ToRGB(%d) = (%d, %d, %d), want (%d, %d, %d)",
					tt.index, r, g, b, tt.expectedR, tt.expectedG, tt.expectedB)
			}
		})
	}
}

// TestStandardColor16ToRGB_InvalidIndices tests standardColor16ToRGB with invalid indices
func TestStandardColor16ToRGB_InvalidIndices_ReturnsBlack(t *testing.T) {
	tests := []struct {
		name  string
		index uint8
	}{
		{"index 16", 16},
		{"index 50", 50},
		{"index 100", 100},
		{"index 255", 255},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, g, b := standardColor16ToRGB(tt.index)
			if r != 0 || g != 0 || b != 0 {
				t.Errorf("standardColor16ToRGB(%d) = (%d, %d, %d), want (0, 0, 0)",
					tt.index, r, g, b)
			}
		})
	}
}

// TestColor256ToRGB_EdgeCases tests edge cases and boundary conditions
func TestColor256ToRGB_EdgeCases_ReturnsCorrectRGB(t *testing.T) {
	t.Run("boundary_standard_to_cube", func(t *testing.T) {
		// Test boundary between standard colors (15) and 216-color cube (16)
		r15, g15, b15 := color256ToRGB(15)
		r16, g16, b16 := color256ToRGB(16)

		// Index 15 should use standard colors
		if r15 != 255 || g15 != 255 || b15 != 255 {
			t.Errorf("color256ToRGB(15) = (%d, %d, %d), want (255, 255, 255)", r15, g15, b15)
		}

		// Index 16 should use cube calculation (0,0,0) * 51 = (0,0,0)
		if r16 != 0 || g16 != 0 || b16 != 0 {
			t.Errorf("color256ToRGB(16) = (%d, %d, %d), want (0, 0, 0)", r16, g16, b16)
		}
	})

	t.Run("boundary_cube_to_grayscale", func(t *testing.T) {
		// Test boundary between 216-color cube (231) and grayscale (232)
		r231, g231, b231 := color256ToRGB(231)
		r232, g232, b232 := color256ToRGB(232)

		// Index 231 should use cube calculation (5,5,5) * 51 = (255,255,255)
		if r231 != 255 || g231 != 255 || b231 != 255 {
			t.Errorf("color256ToRGB(231) = (%d, %d, %d), want (255, 255, 255)", r231, g231, b231)
		}

		// Index 232 should use grayscale calculation (232-232)*10 + 8 = 8
		if r232 != 8 || g232 != 8 || b232 != 8 {
			t.Errorf("color256ToRGB(232) = (%d, %d, %d), want (8, 8, 8)", r232, g232, b232)
		}
	})
}

// TestColor256_IntegrationWithFatihColor tests that Color256 properly integrates with fatih/color
func TestColor256_IntegrationWithFatihColor_CreatesValidColorObject(t *testing.T) {
	// Test a few representative indices
	indices := []uint8{0, 1, 15, 16, 100, 232, 255}

	for _, index := range indices {
		t.Run("index_"+string(rune(index+'0')), func(t *testing.T) {
			colorObj := Color256(index)

			// Verify the color object can be used with fatih/color
			sprintFunc := colorObj.SprintFunc()
			result := sprintFunc("test")

			// Should contain ANSI escape sequences (basic validation)
			if len(result) < 4 { // "test" + some escape sequences
				t.Errorf("Color256(%d).SprintFunc() produced too short result: %q", index, result)
			}

			// Should contain the original text
			if !containsText(result, "test") {
				t.Errorf("Color256(%d).SprintFunc() should contain 'test', got: %q", index, result)
			}
		})
	}
}

// containsText checks if a string contains the given text, ignoring ANSI escape sequences
func containsText(s, text string) bool {
	// Simple check - in a real scenario you might want to strip ANSI sequences
	// but for this test, just checking if the text appears somewhere is sufficient
	return len(s) >= len(text) && findSubstring(s, text)
}

// findSubstring is a simple substring search helper
func findSubstring(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	if len(s) < len(substr) {
		return false
	}

	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if s[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
