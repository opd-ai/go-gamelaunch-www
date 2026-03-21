//go:build js

// Package wasm provides input handling for keyboard and mouse events.
package wasm

import (
	"sync"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
)

// specialKeyMappings maps Ebitengine special keys to their terminal string representations.
var specialKeyMappings = map[ebiten.Key]string{
	// Special keys
	ebiten.KeySpace:     " ",
	ebiten.KeyEnter:     "\r",
	ebiten.KeyBackspace: "\x7f",
	ebiten.KeyEscape:    "\x1b",
	ebiten.KeyTab:       "\t",
	// Arrow keys (ANSI escape sequences)
	ebiten.KeyArrowUp:    "\x1b[A",
	ebiten.KeyArrowDown:  "\x1b[B",
	ebiten.KeyArrowRight: "\x1b[C",
	ebiten.KeyArrowLeft:  "\x1b[D",
	// Function keys
	ebiten.KeyF1:  "\x1bOP",
	ebiten.KeyF2:  "\x1bOQ",
	ebiten.KeyF3:  "\x1bOR",
	ebiten.KeyF4:  "\x1bOS",
	ebiten.KeyF5:  "\x1b[15~",
	ebiten.KeyF6:  "\x1b[17~",
	ebiten.KeyF7:  "\x1b[18~",
	ebiten.KeyF8:  "\x1b[19~",
	ebiten.KeyF9:  "\x1b[20~",
	ebiten.KeyF10: "\x1b[21~",
	ebiten.KeyF11: "\x1b[23~",
	ebiten.KeyF12: "\x1b[24~",
	// Navigation keys
	ebiten.KeyHome:     "\x1b[H",
	ebiten.KeyEnd:      "\x1b[F",
	ebiten.KeyPageUp:   "\x1b[5~",
	ebiten.KeyPageDown: "\x1b[6~",
	ebiten.KeyInsert:   "\x1b[2~",
	ebiten.KeyDelete:   "\x1b[3~",
	// Punctuation
	ebiten.KeyPeriod:       ".",
	ebiten.KeyComma:        ",",
	ebiten.KeySemicolon:    ";",
	ebiten.KeySlash:        "/",
	ebiten.KeyBackslash:    "\\",
	ebiten.KeyMinus:        "-",
	ebiten.KeyEqual:        "=",
	ebiten.KeyBracketLeft:  "[",
	ebiten.KeyBracketRight: "]",
	ebiten.KeyQuote:        "'",
	ebiten.KeyBackquote:    "`",
}

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
	for i := ebiten.KeyA; i <= ebiten.KeyZ; i++ {
		ih.keyMap[i] = string(rune('a' + (i - ebiten.KeyA)))
	}
	for i := ebiten.Key0; i <= ebiten.Key9; i++ {
		ih.keyMap[i] = string(rune('0' + (i - ebiten.Key0)))
	}
	for k, v := range specialKeyMappings {
		ih.keyMap[k] = v
	}
}

// mapKey resolves a key to its terminal string using the given mapping.
// Returns the empty string when the key has no mapping.
// For letter keys, shift is applied automatically.
func mapKey(key ebiten.Key, mapping map[ebiten.Key]string) string {
	char, ok := mapping[key]
	if !ok {
		return ""
	}
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
		if char := mapKey(key, ih.keyMap); char != "" {
			result = append(result, char)
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
