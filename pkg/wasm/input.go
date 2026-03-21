// Package wasm provides input handling for keyboard and mouse events.
package wasm

import (
	"sync"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
)

// InputHandler manages keyboard and mouse input
type InputHandler struct {
	mu          sync.Mutex
	pressedKeys []ebiten.Key
	keyMap      map[ebiten.Key]string
}

// NewInputHandler creates a new input handler
func NewInputHandler() *InputHandler {
	ih := &InputHandler{
		pressedKeys: make([]ebiten.Key, 0),
		keyMap:      make(map[ebiten.Key]string),
	}
	ih.initKeyMap()
	return ih
}

// initKeyMap initializes the key to character mapping
func (ih *InputHandler) initKeyMap() {
	// Letters
	for i := ebiten.KeyA; i <= ebiten.KeyZ; i++ {
		ih.keyMap[i] = string(rune('a' + (i - ebiten.KeyA)))
	}

	// Numbers
	for i := ebiten.Key0; i <= ebiten.Key9; i++ {
		ih.keyMap[i] = string(rune('0' + (i - ebiten.Key0)))
	}

	// Special keys
	ih.keyMap[ebiten.KeySpace] = " "
	ih.keyMap[ebiten.KeyEnter] = "\r"
	ih.keyMap[ebiten.KeyBackspace] = "\x7f"
	ih.keyMap[ebiten.KeyEscape] = "\x1b"
	ih.keyMap[ebiten.KeyTab] = "\t"

	// Arrow keys (ANSI escape sequences)
	ih.keyMap[ebiten.KeyArrowUp] = "\x1b[A"
	ih.keyMap[ebiten.KeyArrowDown] = "\x1b[B"
	ih.keyMap[ebiten.KeyArrowRight] = "\x1b[C"
	ih.keyMap[ebiten.KeyArrowLeft] = "\x1b[D"

	// Function keys
	ih.keyMap[ebiten.KeyF1] = "\x1bOP"
	ih.keyMap[ebiten.KeyF2] = "\x1bOQ"
	ih.keyMap[ebiten.KeyF3] = "\x1bOR"
	ih.keyMap[ebiten.KeyF4] = "\x1bOS"
	ih.keyMap[ebiten.KeyF5] = "\x1b[15~"
	ih.keyMap[ebiten.KeyF6] = "\x1b[17~"
	ih.keyMap[ebiten.KeyF7] = "\x1b[18~"
	ih.keyMap[ebiten.KeyF8] = "\x1b[19~"
	ih.keyMap[ebiten.KeyF9] = "\x1b[20~"
	ih.keyMap[ebiten.KeyF10] = "\x1b[21~"
	ih.keyMap[ebiten.KeyF11] = "\x1b[23~"
	ih.keyMap[ebiten.KeyF12] = "\x1b[24~"

	// Navigation keys
	ih.keyMap[ebiten.KeyHome] = "\x1b[H"
	ih.keyMap[ebiten.KeyEnd] = "\x1b[F"
	ih.keyMap[ebiten.KeyPageUp] = "\x1b[5~"
	ih.keyMap[ebiten.KeyPageDown] = "\x1b[6~"
	ih.keyMap[ebiten.KeyInsert] = "\x1b[2~"
	ih.keyMap[ebiten.KeyDelete] = "\x1b[3~"

	// Punctuation
	ih.keyMap[ebiten.KeyPeriod] = "."
	ih.keyMap[ebiten.KeyComma] = ","
	ih.keyMap[ebiten.KeySemicolon] = ";"
	ih.keyMap[ebiten.KeySlash] = "/"
	ih.keyMap[ebiten.KeyBackslash] = "\\"
	ih.keyMap[ebiten.KeyMinus] = "-"
	ih.keyMap[ebiten.KeyEqual] = "="
	ih.keyMap[ebiten.KeyBracketLeft] = "["
	ih.keyMap[ebiten.KeyBracketRight] = "]"
	ih.keyMap[ebiten.KeyQuote] = "'"
	ih.keyMap[ebiten.KeyBackquote] = "`"
}

// applyShiftModifier applies shift modifier to letter keys, converting to uppercase
func (ih *InputHandler) applyShiftModifier(key ebiten.Key, char string) string {
	if key >= ebiten.KeyA && key <= ebiten.KeyZ && ebiten.IsKeyPressed(ebiten.KeyShift) {
		return string(rune(char[0] - 32))
	}
	return char
}

// Update processes input events
func (ih *InputHandler) Update() {
	ih.mu.Lock()
	defer ih.mu.Unlock()

	// Collect newly pressed keys
	for key := ebiten.KeyA; key <= ebiten.KeyMax; key++ {
		if inpututil.IsKeyJustPressed(key) {
			if _, ok := ih.keyMap[key]; ok {
				ih.pressedKeys = append(ih.pressedKeys, key)
			}
		}
	}
}

// PopPressedKeys returns and clears the list of pressed keys
func (ih *InputHandler) PopPressedKeys() []string {
	ih.mu.Lock()
	defer ih.mu.Unlock()

	result := make([]string, 0, len(ih.pressedKeys))
	for _, key := range ih.pressedKeys {
		if char, ok := ih.keyMap[key]; ok {
			result = append(result, ih.applyShiftModifier(key, char))
		}
	}
	ih.pressedKeys = ih.pressedKeys[:0]
	return result
}

// IsKeyPressed checks if a specific key is currently pressed
func (ih *InputHandler) IsKeyPressed(key ebiten.Key) bool {
	return ebiten.IsKeyPressed(key)
}

// GetMousePosition returns the current mouse position
func (ih *InputHandler) GetMousePosition() (x, y int) {
	return ebiten.CursorPosition()
}

// IsMouseButtonPressed checks if a mouse button is pressed
func (ih *InputHandler) IsMouseButtonPressed(button ebiten.MouseButton) bool {
	return ebiten.IsMouseButtonPressed(button)
}
