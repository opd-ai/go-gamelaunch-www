// Package webui provides ColorConverter implementation for ANSI color processing.
// Moved from: color.go
package webui

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/fatih/color"
)

// ColorConverter handles ANSI color parsing and conversion using fatih/color library
// Moved from: color.go
type ColorConverter struct{}

// NewColorConverter creates a new color converter with ANSI256 profile
// NewColorConverter creates a new color converter
// Moved from: color.go
func NewColorConverter() *ColorConverter {
	return &ColorConverter{}
}

// ProcessSGRParams processes SGR (Select Graphic Rendition) parameters
// Returns foreground color, background color, and text attributes
// Moved from: color.go
func (cc *ColorConverter) ProcessSGRParams(params []string) (fgColor, bgColor string, bold, inverse, blink bool) {
	// Set defaults
	fgColor = "#FFFFFF"
	bgColor = "#000000"

	for i := 0; i < len(params); i++ {
		param, err := strconv.Atoi(params[i])
		if err != nil {
			continue
		}

		switch param {
		case 0: // Reset
			fgColor, bgColor = "#FFFFFF", "#000000"
			bold, inverse, blink = false, false, false
		case 1: // Bold
			bold = true
		case 5: // Blink
			blink = true
		case 7: // Inverse
			inverse = true
		case 22: // Normal intensity
			bold = false
		case 25: // No blink
			blink = false
		case 27: // No inverse
			inverse = false
		case 30, 31, 32, 33, 34, 35, 36, 37: // Standard foreground colors
			fgColor = cc.standardColorToHex(param-30, false)
		case 40, 41, 42, 43, 44, 45, 46, 47: // Standard background colors
			bgColor = cc.standardColorToHex(param-40, false)
		case 90, 91, 92, 93, 94, 95, 96, 97: // Bright foreground colors
			fgColor = cc.standardColorToHex(param-90, true)
		case 100, 101, 102, 103, 104, 105, 106, 107: // Bright background colors
			bgColor = cc.standardColorToHex(param-100, true)
		case 38: // Extended foreground color
			if i+1 < len(params) {
				extColor, consumed := cc.parseExtendedColor(params[i+1:])
				if extColor != "" {
					fgColor = extColor
				}
				i += consumed
			}
		case 48: // Extended background color
			if i+1 < len(params) {
				extColor, consumed := cc.parseExtendedColor(params[i+1:])
				if extColor != "" {
					bgColor = extColor
				}
				i += consumed
			}
		case 39: // Default foreground color
			fgColor = "#FFFFFF"
		case 49: // Default background color
			bgColor = "#000000"
		}
	}

	return
}

// parseExtendedColor handles 256-color and RGB color parsing
// Moved from: color.go
func (cc *ColorConverter) parseExtendedColor(params []string) (string, int) {
	if len(params) == 0 {
		return "", 0
	}

	mode, err := strconv.Atoi(params[0])
	if err != nil {
		return "", 0
	}

	switch mode {
	case 2: // RGB color
		if len(params) >= 4 {
			r, _ := strconv.Atoi(params[1])
			g, _ := strconv.Atoi(params[2])
			b, _ := strconv.Atoi(params[3])
			// Use library's RGB color creation
			c := color.RGB(r, g, b)
			return cc.colorToHex(c), 4
		}
	case 5: // 256-color palette
		if len(params) >= 2 {
			idx, _ := strconv.Atoi(params[1])
			// Use library's 256-color support
			c := Color256(uint8(idx))
			return cc.colorToHex(c), 2
		}
	}

	return "", 0
}

// standardColorToHex converts standard ANSI colors to hex using direct mapping
// Moved from: color.go
func (cc *ColorConverter) standardColorToHex(colorIndex int, bright bool) string {
	// Direct color mapping without relying on fatih/color library parsing
	if colorIndex < 0 || colorIndex >= 8 {
		return "#FFFFFF"
	}

	// Standard (dim) colors
	standardColors := []string{
		"#000000", // Black
		"#800000", // Dark Red
		"#008000", // Dark Green
		"#808000", // Dark Yellow
		"#000080", // Dark Blue
		"#800080", // Dark Magenta
		"#008080", // Dark Cyan
		"#C0C0C0", // Light Gray
	}

	// Bright colors
	brightColors := []string{
		"#808080", // Dark Gray
		"#FF0000", // Bright Red
		"#00FF00", // Bright Green
		"#FFFF00", // Bright Yellow
		"#0000FF", // Bright Blue
		"#FF00FF", // Bright Magenta
		"#00FFFF", // Bright Cyan
		"#FFFFFF", // White
	}

	if bright {
		return brightColors[colorIndex]
	}
	return standardColors[colorIndex]
}

// colorToHex converts a fatih/color Color to hex format
// Moved from: color.go
func (cc *ColorConverter) colorToHex(c *color.Color) string {
	// Handle nil color
	if c == nil {
		return "#FFFFFF"
	}

	// Since fatih/color doesn't expose attributes directly, we'll use a more reliable approach
	// Try to format some text and extract ANSI sequence
	formatted := c.SprintFunc()("X") // Format a single character to get escape sequences

	// Extract ANSI escape sequence
	start := strings.Index(formatted, "\x1b[")
	if start == -1 {
		return "#FFFFFF"
	}

	end := strings.Index(formatted[start:], "m")
	if end == -1 {
		return "#FFFFFF"
	}

	// Extract the sequence parameters
	sequence := formatted[start+2 : start+end]

	// Split by semicolon to handle multiple parameters
	parts := strings.Split(sequence, ";")

	// Process each part to find color codes
	for _, part := range parts {
		switch part {
		case "30":
			return "#000000" // Black
		case "31":
			return "#800000" // Dark Red
		case "32":
			return "#008000" // Dark Green
		case "33":
			return "#808000" // Dark Yellow
		case "34":
			return "#000080" // Dark Blue
		case "35":
			return "#800080" // Dark Magenta
		case "36":
			return "#008080" // Dark Cyan
		case "37":
			return "#C0C0C0" // Light Gray
		case "90":
			return "#808080" // Dark Gray
		case "91":
			return "#FF0000" // Bright Red
		case "92":
			return "#00FF00" // Bright Green
		case "93":
			return "#FFFF00" // Bright Yellow
		case "94":
			return "#0000FF" // Bright Blue
		case "95":
			return "#FF00FF" // Bright Magenta
		case "96":
			return "#00FFFF" // Bright Cyan
		case "97":
			return "#FFFFFF" // White
		}
	}

	// Handle extended color sequences
	if len(parts) >= 3 && parts[0] == "38" {
		if parts[1] == "2" && len(parts) >= 5 {
			// RGB format: 38;2;r;g;b
			r, _ := strconv.Atoi(parts[2])
			g, _ := strconv.Atoi(parts[3])
			b, _ := strconv.Atoi(parts[4])
			return cc.rgbToHex(r, g, b)
		} else if parts[1] == "5" && len(parts) >= 3 {
			// 256-color format: 38;5;n
			idx, _ := strconv.Atoi(parts[2])
			return cc.color256ToHex(idx)
		}
	}

	// Default fallback
	return "#FFFFFF"
}

// rgbToHex converts RGB values to hex format
func (cc *ColorConverter) rgbToHex(r, g, b int) string {
	// Clamp values to 0-255 range
	if r < 0 {
		r = 0
	} else if r > 255 {
		r = 255
	}
	if g < 0 {
		g = 0
	} else if g > 255 {
		g = 255
	}
	if b < 0 {
		b = 0
	} else if b > 255 {
		b = 255
	}

	return fmt.Sprintf("#%02X%02X%02X", r, g, b)
}

// color256ToHex converts 256-color palette index to hex format
func (cc *ColorConverter) color256ToHex(idx int) string {
	// Standard 16 colors (0-15)
	if idx < 16 {
		colors := []string{
			"#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#C0C0C0",
			"#808080", "#FF0000", "#00FF00", "#FFFF00", "#0000FF", "#FF00FF", "#00FFFF", "#FFFFFF",
		}
		if idx >= 0 && idx < len(colors) {
			return colors[idx]
		}
	}

	// 216-color cube (16-231)
	if idx >= 16 && idx <= 231 {
		idx -= 16
		r := (idx / 36) * 51
		g := ((idx % 36) / 6) * 51
		b := (idx % 6) * 51
		return cc.rgbToHex(r, g, b)
	}

	// Grayscale ramp (232-255)
	if idx >= 232 && idx <= 255 {
		gray := 8 + (idx-232)*10
		return cc.rgbToHex(gray, gray, gray)
	}

	return "#FFFFFF"
}
