// Package webui provides utility functions shared across the webui package.
// Moved from: multiple files
package webui

import (
	"strings"

	"github.com/fatih/color"
)

// isValidColor checks if a color string is in valid hex format
// Moved from: tileset.go via tilesetconfig.go
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

// Color256 converts a 256-color index to a hex color string
// Moved from: color.go via colorconverter.go
func Color256(u uint8) *color.Color {
	// Convert 256-color index to RGB values
	r, g, b := color256ToRGB(u)
	return color.RGB(r, g, b)
}

// color256ToRGB converts a 256-color index to RGB values
// Moved from: color.go via colorconverter.go
func color256ToRGB(index uint8) (r, g, b int) {
	switch {
	case index < 16:
		// Standard 16 colors (0-15)
		return standardColor16ToRGB(index)
	case index < 232:
		// 216-color cube (16-231)
		index -= 16
		r = int((index / 36) * 51)
		g = int(((index % 36) / 6) * 51)
		b = int((index % 6) * 51)
		return
	default:
		// Grayscale ramp (232-255)
		gray := int((index-232)*10 + 8)
		return gray, gray, gray
	}
}

// standardColor16ToRGB converts standard 16 color indices to RGB
// Moved from: color.go via colorconverter.go
func standardColor16ToRGB(index uint8) (r, g, b int) {
	colors := [][3]int{
		{0, 0, 0},       // 0: black
		{128, 0, 0},     // 1: red
		{0, 128, 0},     // 2: green
		{128, 128, 0},   // 3: yellow
		{0, 0, 128},     // 4: blue
		{128, 0, 128},   // 5: magenta
		{0, 128, 128},   // 6: cyan
		{192, 192, 192}, // 7: white
		{128, 128, 128}, // 8: bright black
		{255, 0, 0},     // 9: bright red
		{0, 255, 0},     // 10: bright green
		{255, 255, 0},   // 11: bright yellow
		{0, 0, 255},     // 12: bright blue
		{255, 0, 255},   // 13: bright magenta
		{0, 255, 255},   // 14: bright cyan
		{255, 255, 255}, // 15: bright white
	}

	if index < uint8(len(colors)) {
		return colors[index][0], colors[index][1], colors[index][2]
	}
	return 0, 0, 0 // Default to black for invalid indices
}
