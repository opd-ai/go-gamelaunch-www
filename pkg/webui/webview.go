// Package webui provides WebView implementation for web browser rendering.
// Moved from: view.go
package webui

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// WebView implements dgclient.View for web browser rendering
// Moved from: view.go
type WebView struct {
	mu           sync.RWMutex
	buffer       [][]Cell
	width        int
	height       int
	cursorX      int
	cursorY      int
	inputChan    chan []byte
	updateNotify chan struct{}
	stateManager *StateManager
	tileset      *TilesetConfig
	closed       bool // Track if view has been closed to prevent race conditions

	// ANSI parsing state - simplified with library integration
	currentFgColor string
	currentBgColor string
	currentBold    bool
	currentInverse bool
	currentBlink   bool
	escapeBuffer   []byte
	inEscapeSeq    bool

	// Color converter using fatih/color library
	colorConverter *ColorConverter
}

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
		closed:       false, // Initialize closed state

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

	// Check if view is closed to prevent race condition
	if v.closed {
		return fmt.Errorf("cannot render to closed view")
	}

	// Process the terminal data to update buffer
	v.processTerminalData(data)

	// Update state manager with new version
	state := v.getCurrentState()
	v.stateManager.UpdateState(state)

	// Notify polling clients of updates - safe channel send
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
	v.mu.Lock()
	defer v.mu.Unlock()

	// Prevent double close
	if v.closed {
		return nil
	}

	v.closed = true
	close(v.inputChan)
	close(v.updateNotify)
	return nil
}

// SendInput queues input from web client
// Moved from: view.go
func (v *WebView) SendInput(data []byte) {
	v.mu.RLock()
	if v.closed {
		v.mu.RUnlock()
		return // Silently ignore input to closed view
	}
	v.mu.RUnlock()

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
	for i := 0; i < len(data); i++ {
		b := data[i]

		if v.inEscapeSeq {
			if !v.processEscapeByte(b) {
				continue
			}
			i-- // Reprocess byte if escape overflow
			continue
		}

		v.processControlChar(b)
	}
}

// processEscapeByte handles a byte during escape sequence processing
// Returns true if escape sequence was reset due to overflow
func (v *WebView) processEscapeByte(b byte) bool {
	// Check for buffer overflow protection
	if len(v.escapeBuffer) >= 32 {
		fmt.Printf("SECURITY WARNING: Escape sequence buffer overflow attempt detected, resetting\n")
		v.escapeBuffer = v.escapeBuffer[:0]
		v.inEscapeSeq = false
		return true
	}
	v.escapeBuffer = append(v.escapeBuffer, b)
	if v.processEscapeSequence(b) {
		v.inEscapeSeq = false
		v.escapeBuffer = v.escapeBuffer[:0]
	}
	return false
}

// processControlChar handles control characters and printable characters
func (v *WebView) processControlChar(b byte) {
	switch b {
	case '\x1b': // ESC
		v.startEscapeSequence()
	case '\n':
		v.handleNewline()
	case '\r':
		v.cursorX = 0
	case '\b':
		v.handleBackspace()
	case '\t':
		v.handleTab()
	default:
		v.handlePrintableChar(b)
	}
}

// startEscapeSequence begins an escape sequence
func (v *WebView) startEscapeSequence() {
	v.inEscapeSeq = true
	v.escapeBuffer = append(v.escapeBuffer[:0], '\x1b')
}

// handleNewline processes newline character
func (v *WebView) handleNewline() {
	v.cursorY++
	v.cursorX = 0
	if v.cursorY >= v.height {
		v.scrollUp()
		v.cursorY = v.height - 1
	}
}

// handleBackspace processes backspace character
func (v *WebView) handleBackspace() {
	if v.cursorX > 0 {
		v.cursorX--
	}
}

// handleTab processes tab character
func (v *WebView) handleTab() {
	v.cursorX = ((v.cursorX / 8) + 1) * 8
	if v.cursorX >= v.width {
		v.cursorX = 0
		v.cursorY++
		if v.cursorY >= v.height {
			v.scrollUp()
			v.cursorY = v.height - 1
		}
	}
}

// handlePrintableChar processes printable characters
func (v *WebView) handlePrintableChar(b byte) {
	if b >= 32 && b < 127 { // Printable ASCII
		v.writeCharacter(rune(b))
	} else if b >= 128 { // UTF-8 continuation or start
		v.writeCharacter(rune(b))
	}
}

// processEscapeSequence processes individual bytes of escape sequences
// Moved from: view.go
func (v *WebView) processEscapeSequence(b byte) bool {
	// Safety check is now handled in processTerminalData before this function is called
	// This function assumes the byte has already been added to the buffer safely
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
	if len(seq) == 0 {
		return
	}

	lastChar := seq[len(seq)-1]
	switch lastChar {
	case 'm':
		v.handleSGRSequence(seq)
	case 'H', 'f':
		v.handleCursorPosition(seq)
	case 'J':
		v.handleEraseDisplay(seq)
	case 'K':
		v.handleEraseLine(seq)
	case 'A':
		v.handleCursorMove(seq, 0, -1)
	case 'B':
		v.handleCursorMove(seq, 0, 1)
	case 'C':
		v.handleCursorMove(seq, 1, 0)
	case 'D':
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
		v.setCellChar(v.cursorX, v.cursorY, char)
	}

	v.advanceCursor()
}

// setCellChar sets a character at the given position with current attributes
func (v *WebView) setCellChar(x, y int, char rune) {
	cell := &v.buffer[y][x]
	cell.Char = char
	cell.FgColor = v.currentFgColor
	cell.BgColor = v.currentBgColor
	cell.Bold = v.currentBold
	cell.Inverse = v.currentInverse
	cell.Blink = v.currentBlink
	cell.Changed = true

	v.applyTilesetMapping(cell, char)
}

// applyTilesetMapping applies tileset mapping to a cell if available
func (v *WebView) applyTilesetMapping(cell *Cell, char rune) {
	if v.tileset == nil {
		return
	}

	mapping := v.tileset.GetMapping(char)
	if mapping == nil {
		return
	}

	cell.TileX = mapping.X
	cell.TileY = mapping.Y
	if mapping.FgColor != "" {
		cell.FgColor = mapping.FgColor
	}
	if mapping.BgColor != "" {
		cell.BgColor = mapping.BgColor
	}
}

// advanceCursor moves the cursor forward, wrapping as needed
func (v *WebView) advanceCursor() {
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
