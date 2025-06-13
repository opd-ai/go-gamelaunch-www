// Package webui provides WebView implementation for web browser rendering.
// Moved from: view.go
package webui

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// NewWebView creates a new web-based view
// Moved from: view.go
func NewWebView(opts dgclient.ViewOptions) (*WebView, error) {
	width := opts.InitialWidth
	height := opts.InitialHeight

	if width <= 0 {
		width = 80
	}
	if height <= 0 {
		height = 24
	}

	view := &WebView{
		width:        width,
		height:       height,
		inputChan:    make(chan []byte, 100),
		updateNotify: make(chan struct{}, 10),
		stateManager: NewStateManager(),

		// Initialize color state
		currentFgColor: "#FFFFFF",
		currentBgColor: "#000000",
		currentBold:    false,
		currentInverse: false,
		currentBlink:   false,
		escapeBuffer:   make([]byte, 0, 32),
		inEscapeSeq:    false,

		// Initialize color converter
		colorConverter: NewColorConverter(),
	}

	view.initBuffer()
	return view, nil
}

// Init initializes the web view
// Moved from: view.go
func (v *WebView) Init() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.initBuffer()
	return nil
}

// initBuffer initializes the screen buffer
// Moved from: view.go
func (v *WebView) initBuffer() {
	v.buffer = make([][]Cell, v.height)
	for y := 0; y < v.height; y++ {
		v.buffer[y] = make([]Cell, v.width)
		for x := 0; x < v.width; x++ {
			v.buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: v.currentFgColor,
				BgColor: v.currentBgColor,
				Bold:    false,
				Inverse: false,
				Blink:   false,
				Changed: true,
			}
		}
	}

	v.cursorX = 0
	v.cursorY = 0
}

// Render processes terminal data and updates the screen buffer
// Moved from: view.go
func (v *WebView) Render(data []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Process the terminal data to update buffer
	v.processTerminalData(data)

	// Update state manager with new version
	state := v.getCurrentState()
	v.stateManager.UpdateState(state)

	// Notify polling clients of updates
	select {
	case v.updateNotify <- struct{}{}:
	default:
	}

	return nil
}

// Clear clears the display
// Moved from: view.go
func (v *WebView) Clear() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.clearScreen()
	v.cursorX = 0
	v.cursorY = 0

	// Update state manager
	state := v.getCurrentState()
	v.stateManager.UpdateState(state)

	return nil
}

// SetSize updates the view dimensions
// Moved from: view.go
func (v *WebView) SetSize(width, height int) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.width = width
	v.height = height
	v.initBuffer()

	// Update state manager
	state := v.getCurrentState()
	v.stateManager.UpdateState(state)

	return nil
}

// GetSize returns current dimensions
// Moved from: view.go
func (v *WebView) GetSize() (int, int) {
	v.mu.RLock()
	defer v.mu.RUnlock()

	return v.width, v.height
}

// HandleInput reads and returns user input
// Moved from: view.go
func (v *WebView) HandleInput() ([]byte, error) {
	select {
	case input := <-v.inputChan:
		return input, nil
	default:
		return nil, io.EOF
	}
}

// Close cleans up resources
// Moved from: view.go
func (v *WebView) Close() error {
	close(v.inputChan)
	close(v.updateNotify)
	return nil
}

// SendInput queues input from web client
// Moved from: view.go
func (v *WebView) SendInput(data []byte) {
	select {
	case v.inputChan <- data:
	default:
		// Input buffer full, drop input
	}
}

// GetCurrentState returns the current game state
// Moved from: view.go
func (v *WebView) GetCurrentState() *GameState {
	v.mu.RLock()
	defer v.mu.RUnlock()

	return v.getCurrentState()
}

// SetTileset updates the tileset configuration
// Moved from: view.go
func (v *WebView) SetTileset(tileset *TilesetConfig) {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.tileset = tileset

	// Re-apply tileset mappings to current buffer
	if tileset != nil {
		for y := 0; y < v.height; y++ {
			for x := 0; x < v.width; x++ {
				cell := &v.buffer[y][x]
				if mapping := tileset.GetMapping(cell.Char); mapping != nil {
					cell.TileX = mapping.X
					cell.TileY = mapping.Y
					cell.Changed = true
				}
			}
		}

		// Update state manager
		state := v.getCurrentState()
		v.stateManager.UpdateState(state)
	}
}

// GetStateManager returns the state manager for this view
// Moved from: view.go
func (v *WebView) GetStateManager() *StateManager {
	return v.stateManager
}

// WaitForUpdate waits for the next screen update
// Moved from: view.go
func (v *WebView) WaitForUpdate(timeout time.Duration) bool {
	select {
	case <-v.updateNotify:
		return true
	case <-time.After(timeout):
		return false
	}
}

// getCurrentState returns current state without locking (internal use)
// Moved from: view.go
func (v *WebView) getCurrentState() *GameState {
	state := &GameState{
		Buffer:    make([][]Cell, v.height),
		Width:     v.width,
		Height:    v.height,
		CursorX:   v.cursorX,
		CursorY:   v.cursorY,
		Timestamp: time.Now().UnixMilli(),
	}

	// Copy buffer
	for y := 0; y < v.height; y++ {
		state.Buffer[y] = make([]Cell, v.width)
		copy(state.Buffer[y], v.buffer[y])
	}

	return state
}

// processTerminalData parses terminal escape sequences and updates buffer
// Moved from: view.go
func (v *WebView) processTerminalData(data []byte) {
	i := 0
	for i < len(data) {
		b := data[i]

		if v.inEscapeSeq {
			v.escapeBuffer = append(v.escapeBuffer, b)
			if v.processEscapeSequence(b) {
				v.inEscapeSeq = false
				v.escapeBuffer = v.escapeBuffer[:0]
			}
			i++
			continue
		}

		switch b {
		case '\x1b': // ESC
			v.inEscapeSeq = true
			v.escapeBuffer = append(v.escapeBuffer[:0], b)
		case '\n':
			v.cursorY++
			v.cursorX = 0
			if v.cursorY >= v.height {
				v.scrollUp()
				v.cursorY = v.height - 1
			}
		case '\r':
			v.cursorX = 0
		case '\b':
			if v.cursorX > 0 {
				v.cursorX--
			}
		case '\t':
			// Tab to next 8-character boundary
			v.cursorX = ((v.cursorX / 8) + 1) * 8
			if v.cursorX >= v.width {
				v.cursorX = 0
				v.cursorY++
				if v.cursorY >= v.height {
					v.scrollUp()
					v.cursorY = v.height - 1
				}
			}
		default:
			if b >= 32 && b < 127 { // Printable ASCII
				v.writeCharacter(rune(b))
			} else if b >= 128 { // UTF-8 continuation or start
				// For simplicity, treat as printable character
				// In production, you'd want proper UTF-8 handling
				v.writeCharacter(rune(b))
			}
		}
		i++
	}
}

// processEscapeSequence processes individual bytes of escape sequences
// Moved from: view.go
func (v *WebView) processEscapeSequence(b byte) bool {
	// Check for buffer overflow protection FIRST before appending
	if len(v.escapeBuffer) >= 32 {
		// Log the potential attack attempt for security monitoring
		fmt.Printf("SECURITY WARNING: Escape sequence buffer overflow attempt detected, resetting\n")
		// Reset escape sequence state and return true to exit
		v.escapeBuffer = v.escapeBuffer[:0]
		v.inEscapeSeq = false
		return true
	}

	// Add the byte to the buffer after safety check
	v.escapeBuffer = append(v.escapeBuffer, b)
	escSeq := string(v.escapeBuffer)

	// Handle CSI sequences (ESC[...)
	if len(escSeq) >= 2 && escSeq[1] == '[' {
		// Check if sequence is complete
		if (b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z') || b == 'm' || b == 'H' || b == 'J' || b == 'K' {
			// Sequence is complete, process it
			v.handleCSISequence(escSeq)
			// Reset buffer after processing
			v.escapeBuffer = v.escapeBuffer[:0]
			v.inEscapeSeq = false
			return true
		}
		// Continue building sequence if not complete
		return false
	}

	// Handle other escape sequences
	if len(escSeq) >= 2 {
		switch escSeq[1] {
		case 'c': // Reset terminal
			v.resetTerminalState()
		case 'D': // Line feed
			v.cursorY++
			if v.cursorY >= v.height {
				v.scrollUp()
				v.cursorY = v.height - 1
			}
		case 'M': // Reverse line feed
			v.cursorY--
			if v.cursorY < 0 {
				v.scrollDown()
				v.cursorY = 0
			}
		default:
			// Unknown sequence, terminate
			v.escapeBuffer = v.escapeBuffer[:0]
			v.inEscapeSeq = false
			return true
		}

		// Reset buffer after processing
		v.escapeBuffer = v.escapeBuffer[:0]
		v.inEscapeSeq = false
		return true
	}

	// Continue building sequence
	return false
}

// handleCSISequence processes complete CSI escape sequences
// Moved from: view.go
func (v *WebView) handleCSISequence(seq string) {
	if strings.HasSuffix(seq, "m") {
		// SGR (Select Graphic Rendition) - color and attributes
		v.handleSGRSequence(seq)
	} else if strings.HasSuffix(seq, "H") || strings.HasSuffix(seq, "f") {
		// Cursor position
		v.handleCursorPosition(seq)
	} else if strings.HasSuffix(seq, "J") {
		// Erase display
		v.handleEraseDisplay(seq)
	} else if strings.HasSuffix(seq, "K") {
		// Erase line
		v.handleEraseLine(seq)
	} else if strings.HasSuffix(seq, "A") {
		// Cursor up
		v.handleCursorMove(seq, 0, -1)
	} else if strings.HasSuffix(seq, "B") {
		// Cursor down
		v.handleCursorMove(seq, 0, 1)
	} else if strings.HasSuffix(seq, "C") {
		// Cursor right
		v.handleCursorMove(seq, 1, 0)
	} else if strings.HasSuffix(seq, "D") {
		// Cursor left
		v.handleCursorMove(seq, -1, 0)
	}
}

// handleSGRSequence processes SGR color and attribute sequences
// Moved from: view.go
func (v *WebView) handleSGRSequence(seq string) {
	// Parse SGR (Select Graphic Rendition) parameters
	paramStr := seq[2 : len(seq)-1] // Remove ESC[ and m
	if paramStr == "" {
		paramStr = "0" // Default reset
	}

	params := strings.Split(paramStr, ";")

	// Use library-based color processing - IMPROVEMENT: Eliminates custom color parsing
	fgColor, bgColor, bold, inverse, blink := v.colorConverter.ProcessSGRParams(params)

	// Update current state
	v.currentFgColor = fgColor
	v.currentBgColor = bgColor
	v.currentBold = bold
	v.currentInverse = inverse
	v.currentBlink = blink
}

// handleCursorPosition processes cursor positioning sequences
// Moved from: view.go
func (v *WebView) handleCursorPosition(seq string) {
	paramStr := seq[2 : len(seq)-1] // Remove ESC[ and H/f
	if paramStr == "" {
		v.cursorX = 0
		v.cursorY = 0
		return
	}

	params := strings.Split(paramStr, ";")
	if len(params) >= 2 {
		row, _ := strconv.Atoi(params[0])
		col, _ := strconv.Atoi(params[1])
		// ANSI coordinates are 1-based
		v.cursorY = row - 1
		v.cursorX = col - 1
	} else if len(params) == 1 {
		row, _ := strconv.Atoi(params[0])
		v.cursorY = row - 1
		v.cursorX = 0
	}

	// Clamp to screen bounds
	if v.cursorX < 0 {
		v.cursorX = 0
	}
	if v.cursorX >= v.width {
		v.cursorX = v.width - 1
	}
	if v.cursorY < 0 {
		v.cursorY = 0
	}
	if v.cursorY >= v.height {
		v.cursorY = v.height - 1
	}
}

// handleEraseDisplay processes display clearing sequences
// Moved from: view.go
func (v *WebView) handleEraseDisplay(seq string) {
	paramStr := seq[2 : len(seq)-1] // Remove ESC[ and J
	param := 0
	if paramStr != "" {
		param, _ = strconv.Atoi(paramStr)
	}

	switch param {
	case 0: // Clear from cursor to end of screen
		v.clearFromCursor()
	case 1: // Clear from beginning of screen to cursor
		v.clearToCursor()
	case 2: // Clear entire screen
		v.clearScreen()
	}
}

// handleEraseLine processes line clearing sequences
// Moved from: view.go
func (v *WebView) handleEraseLine(seq string) {
	paramStr := seq[2 : len(seq)-1] // Remove ESC[ and K
	param := 0
	if paramStr != "" {
		param, _ = strconv.Atoi(paramStr)
	}

	switch param {
	case 0: // Clear from cursor to end of line
		v.clearLineFromCursor()
	case 1: // Clear from beginning of line to cursor
		v.clearLineToCursor()
	case 2: // Clear entire line
		v.clearLine()
	}
}

// handleCursorMove processes cursor movement sequences
// Moved from: view.go
func (v *WebView) handleCursorMove(seq string, dx, dy int) {
	paramStr := seq[2 : len(seq)-1] // Remove ESC[ and direction letter
	count := 1
	if paramStr != "" {
		count, _ = strconv.Atoi(paramStr)
		if count <= 0 {
			count = 1
		}
	}

	v.cursorX += dx * count
	v.cursorY += dy * count

	// Clamp to screen bounds
	if v.cursorX < 0 {
		v.cursorX = 0
	}
	if v.cursorX >= v.width {
		v.cursorX = v.width - 1
	}
	if v.cursorY < 0 {
		v.cursorY = 0
	}
	if v.cursorY >= v.height {
		v.cursorY = v.height - 1
	}
}

// resetAttributes resets text attributes to defaults
// Moved from: view.go
func (v *WebView) resetAttributes() {
	v.currentFgColor = "#FFFFFF"
	v.currentBgColor = "#000000"
	v.currentBold = false
	v.currentInverse = false
	v.currentBlink = false
}

// resetTerminalState resets terminal state to defaults
// Moved from: view.go
func (v *WebView) resetTerminalState() {
	v.resetAttributes()
	v.cursorX = 0
	v.cursorY = 0
}

// writeCharacter writes a character to the current cursor position
// Moved from: view.go
func (v *WebView) writeCharacter(char rune) {
	if v.cursorX < v.width && v.cursorY < v.height {
		cell := &v.buffer[v.cursorY][v.cursorX]
		cell.Char = char
		cell.FgColor = v.currentFgColor
		cell.BgColor = v.currentBgColor
		cell.Bold = v.currentBold
		cell.Inverse = v.currentInverse
		cell.Blink = v.currentBlink
		cell.Changed = true

		// Apply tileset mapping if available
		if v.tileset != nil {
			if mapping := v.tileset.GetMapping(char); mapping != nil {
				cell.TileX = mapping.X
				cell.TileY = mapping.Y
				if mapping.FgColor != "" {
					cell.FgColor = mapping.FgColor
				}
				if mapping.BgColor != "" {
					cell.BgColor = mapping.BgColor
				}
			}
		}
	}

	v.cursorX++
	if v.cursorX >= v.width {
		v.cursorX = 0
		v.cursorY++
		if v.cursorY >= v.height {
			v.scrollUp()
			v.cursorY = v.height - 1
		}
	}
}

// scrollUp scrolls the buffer up by one line
// Moved from: view.go
func (v *WebView) scrollUp() {
	// Move all lines up
	for y := 0; y < v.height-1; y++ {
		copy(v.buffer[y], v.buffer[y+1])
	}

	// Clear last line
	for x := 0; x < v.width; x++ {
		v.buffer[v.height-1][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}

// scrollDown scrolls the buffer down by one line
// Moved from: view.go
func (v *WebView) scrollDown() {
	// Move all lines down
	for y := v.height - 1; y > 0; y-- {
		copy(v.buffer[y], v.buffer[y-1])
	}

	// Clear first line
	for x := 0; x < v.width; x++ {
		v.buffer[0][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}

// clearScreen clears the entire screen buffer
// Moved from: view.go
func (v *WebView) clearScreen() {
	for y := 0; y < v.height; y++ {
		for x := 0; x < v.width; x++ {
			v.buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: v.currentFgColor,
				BgColor: v.currentBgColor,
				Bold:    false,
				Inverse: false,
				Blink:   false,
				Changed: true,
			}
		}
	}
}

// clearFromCursor clears from cursor to end of screen
// Moved from: view.go
func (v *WebView) clearFromCursor() {
	// Clear from cursor to end of current line
	for x := v.cursorX; x < v.width; x++ {
		v.buffer[v.cursorY][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}

	// Clear all lines below current
	for y := v.cursorY + 1; y < v.height; y++ {
		for x := 0; x < v.width; x++ {
			v.buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: v.currentFgColor,
				BgColor: v.currentBgColor,
				Bold:    false,
				Inverse: false,
				Blink:   false,
				Changed: true,
			}
		}
	}
}

// clearToCursor clears from beginning of screen to cursor
// Moved from: view.go
func (v *WebView) clearToCursor() {
	// Clear all lines above current
	for y := 0; y < v.cursorY; y++ {
		for x := 0; x < v.width; x++ {
			v.buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: v.currentFgColor,
				BgColor: v.currentBgColor,
				Bold:    false,
				Inverse: false,
				Blink:   false,
				Changed: true,
			}
		}
	}

	// Clear from beginning of current line to cursor
	for x := 0; x <= v.cursorX && x < v.width; x++ {
		v.buffer[v.cursorY][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}

// clearLine clears the entire current line
// Moved from: view.go
func (v *WebView) clearLine() {
	for x := 0; x < v.width; x++ {
		v.buffer[v.cursorY][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}

// clearLineFromCursor clears from cursor to end of line
// Moved from: view.go
func (v *WebView) clearLineFromCursor() {
	for x := v.cursorX; x < v.width; x++ {
		v.buffer[v.cursorY][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}

// clearLineToCursor clears from beginning of line to cursor
// Moved from: view.go
func (v *WebView) clearLineToCursor() {
	for x := 0; x <= v.cursorX && x < v.width; x++ {
		v.buffer[v.cursorY][x] = Cell{
			Char:    ' ',
			FgColor: v.currentFgColor,
			BgColor: v.currentBgColor,
			Bold:    false,
			Inverse: false,
			Blink:   false,
			Changed: true,
		}
	}
}
