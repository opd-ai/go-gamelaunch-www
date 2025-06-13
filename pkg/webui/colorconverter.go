// Package webui provides ColorConverter implementation for ANSI color processing.
// Moved from: color.go
package webui

import (
	"strconv"

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

// Color256 converts a 256-color index to a hex color string
// Moved from: color.go
func Color256(u uint8) *color.Color {
	// Convert 256-color index to RGB values
	r, g, b := color256ToRGB(u)
	return color.RGB(r, g, b)
}

// color256ToRGB converts a 256-color index to RGB values
// Moved from: color.go
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
// Moved from: color.go
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

	if index < 16 {
		return colors[index][0], colors[index][1], colors[index][2]
	}
	return 255, 255, 255 // fallback to white
}

// standardColorToHex converts standard ANSI colors to hex using library
// Moved from: color.go
func (cc *ColorConverter) standardColorToHex(colorIndex int, bright bool) string {
	var attr color.Attribute

	// Map to color attributes
	baseColors := []color.Attribute{
		color.FgBlack, color.FgRed, color.FgGreen, color.FgYellow,
		color.FgBlue, color.FgMagenta, color.FgCyan, color.FgWhite,
	}

	brightColors := []color.Attribute{
		color.FgHiBlack, color.FgHiRed, color.FgHiGreen, color.FgHiYellow,
		color.FgHiBlue, color.FgHiMagenta, color.FgHiCyan, color.FgHiWhite,
	}

	if colorIndex >= 0 && colorIndex < 8 {
		if bright {
			attr = brightColors[colorIndex]
		} else {
			attr = baseColors[colorIndex]
		}

		c := color.New(attr)
		return cc.colorToHex(c)
	}

	return "#FFFFFF"
}

// colorToHex converts a fatih/color Color to hex format
// Moved from: color.go
func (cc *ColorConverter) colorToHex(c *color.Color) string {
	// For production use, you would implement proper color extraction
	// This is a simplified version that maps common colors

	// Get the color sequence and parse it
	seq := c.SprintFunc()("")

	// Map common ANSI sequences to hex colors
	colorMap := map[string]string{
		"\x1b[30m": "#000000", // Black
		"\x1b[31m": "#800000", // Red
		"\x1b[32m": "#008000", // Green
		"\x1b[33m": "#808000", // Yellow
		"\x1b[34m": "#000080", // Blue
		"\x1b[35m": "#800080", // Magenta
		"\x1b[36m": "#008080", // Cyan
		"\x1b[37m": "#C0C0C0", // White
		"\x1b[90m": "#808080", // Bright Black
		"\x1b[91m": "#FF0000", // Bright Red
		"\x1b[92m": "#00FF00", // Bright Green
		"\x1b[93m": "#FFFF00", // Bright Yellow
		"\x1b[94m": "#0000FF", // Bright Blue
		"\x1b[95m": "#FF00FF", // Bright Magenta
		"\x1b[96m": "#00FFFF", // Bright Cyan
		"\x1b[97m": "#FFFFFF", // Bright White
	}

	// Extract ANSI sequence from the colored string
	if len(seq) >= 4 {
		ansiSeq := seq[:4] + "m"
		if hex, found := colorMap[ansiSeq]; found {
			return hex
		}
	}

	// For 256-color and RGB, implement proper extraction
	// This would require parsing the actual escape sequences
	return "#FFFFFF" // Default fallback
}
