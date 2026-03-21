// Package wasm provides tile rendering for the game interface.
package wasm

import (
	"image"
	"image/color"

	"github.com/hajimehoshi/ebiten/v2"
)

// TileRenderer handles rendering of tiles to the screen
type TileRenderer struct {
	tileset     *ebiten.Image
	tileWidth   int
	tileHeight  int
	charMapping map[rune]image.Point
}

// NewTileRenderer creates a new tile renderer
func NewTileRenderer() *TileRenderer {
	return &TileRenderer{
		tileWidth:   16,
		tileHeight:  16,
		charMapping: make(map[rune]image.Point),
	}
}

// SetTileset sets the tileset image
func (tr *TileRenderer) SetTileset(img *ebiten.Image, tileW, tileH int) {
	tr.tileset = img
	tr.tileWidth = tileW
	tr.tileHeight = tileH
}

// SetCharMapping sets the character to tile position mapping
func (tr *TileRenderer) SetCharMapping(mapping map[rune]image.Point) {
	tr.charMapping = mapping
}

// Draw renders the game buffer to the screen
func (tr *TileRenderer) Draw(game *Game, screen *ebiten.Image) {
	buffer := game.GetBuffer()
	config := game.GetConfig()

	for y, row := range buffer {
		for x, cell := range row {
			tr.drawCell(screen, x, y, cell, config)
		}
	}
}

// drawCell renders a single cell
func (tr *TileRenderer) drawCell(screen *ebiten.Image, x, y int, cell Cell, config GameConfig) {
	// Calculate screen position
	screenX := x * config.TileWidth
	screenY := y * config.TileHeight

	// Draw background
	bgColor := parseHexColor(cell.BgColor)
	drawRect(screen, screenX, screenY, config.TileWidth, config.TileHeight, bgColor)

	// Draw tile or character
	if tr.tileset != nil && cell.TileX > 0 && cell.TileY > 0 {
		tr.drawTile(screen, screenX, screenY, cell.TileX, cell.TileY)
	} else if tr.tileset != nil {
		if pos, ok := tr.charMapping[cell.Char]; ok {
			tr.drawTile(screen, screenX, screenY, pos.X, pos.Y)
		} else {
			tr.drawCharFallback(screen, screenX, screenY, cell, config)
		}
	} else {
		tr.drawCharFallback(screen, screenX, screenY, cell, config)
	}
}

// drawTile draws a tile from the tileset
func (tr *TileRenderer) drawTile(screen *ebiten.Image, screenX, screenY, tileX, tileY int) {
	if tr.tileset == nil {
		return
	}

	sx := tileX * tr.tileWidth
	sy := tileY * tr.tileHeight

	op := &ebiten.DrawImageOptions{}
	op.GeoM.Translate(float64(screenX), float64(screenY))

	rect := image.Rect(sx, sy, sx+tr.tileWidth, sy+tr.tileHeight)
	screen.DrawImage(tr.tileset.SubImage(rect).(*ebiten.Image), op)
}

// drawCharFallback draws a character as a simple colored rectangle
func (tr *TileRenderer) drawCharFallback(screen *ebiten.Image, screenX, screenY int, cell Cell, config GameConfig) {
	if cell.Char == ' ' {
		return
	}

	fgColor := parseHexColor(cell.FgColor)
	if cell.Inverse {
		fgColor = parseHexColor(cell.BgColor)
	}

	// Draw a simple representation (a smaller colored rectangle)
	padding := config.TileWidth / 4
	drawRect(screen, screenX+padding, screenY+padding,
		config.TileWidth-2*padding, config.TileHeight-2*padding, fgColor)
}

// parseHexColor converts a hex color string to color.RGBA
func parseHexColor(hex string) color.RGBA {
	if len(hex) != 7 || hex[0] != '#' {
		return color.RGBA{255, 255, 255, 255}
	}

	r := hexToByte(hex[1:3])
	g := hexToByte(hex[3:5])
	b := hexToByte(hex[5:7])

	return color.RGBA{r, g, b, 255}
}

// hexToByte converts a 2-character hex string to a byte
func hexToByte(s string) byte {
	var result byte
	for _, c := range s {
		result <<= 4
		switch {
		case c >= '0' && c <= '9':
			result |= byte(c - '0')
		case c >= 'a' && c <= 'f':
			result |= byte(c - 'a' + 10)
		case c >= 'A' && c <= 'F':
			result |= byte(c - 'A' + 10)
		}
	}
	return result
}

// drawRect draws a filled rectangle
func drawRect(screen *ebiten.Image, x, y, w, h int, c color.RGBA) {
	rect := ebiten.NewImage(w, h)
	rect.Fill(c)
	op := &ebiten.DrawImageOptions{}
	op.GeoM.Translate(float64(x), float64(y))
	screen.DrawImage(rect, op)
}
