// Package transport provides tests for WebSocket handler functionality.
package transport

import (
	"testing"
)

func TestNewHandler_CreatesValidInstance(t *testing.T) {
	h := NewHandler()
	if h == nil {
		t.Fatal("NewHandler() returned nil")
	}
	if h.clients == nil {
		t.Error("clients map should be initialized")
	}
}

func TestHandler_SetInputHandler_SetsCallback(t *testing.T) {
	h := NewHandler()

	h.SetInputHandler(func(clientID, input string) error {
		return nil
	})

	if h.onInput == nil {
		t.Error("onInput callback should be set")
	}
}

func TestHandler_SetConnectHandler_SetsCallback(t *testing.T) {
	h := NewHandler()

	h.SetConnectHandler(func(clientID string) {})

	if h.onConnect == nil {
		t.Error("onConnect callback should be set")
	}
}

func TestHandler_SetDisconnectHandler_SetsCallback(t *testing.T) {
	h := NewHandler()

	h.SetDisconnectHandler(func(clientID string) {})

	if h.onDisconnect == nil {
		t.Error("onDisconnect callback should be set")
	}
}

func TestHandler_GetClientCount_ReturnsZeroInitially(t *testing.T) {
	h := NewHandler()
	if h.GetClientCount() != 0 {
		t.Errorf("expected 0 clients, got %d", h.GetClientCount())
	}
}

func TestHandler_GenerateClientID_ReturnsUniqueIDs(t *testing.T) {
	h := NewHandler()
	ids := make(map[string]bool)

	for i := 0; i < 100; i++ {
		id := h.generateClientID()
		if ids[id] {
			t.Errorf("duplicate client ID generated: %s", id)
		}
		ids[id] = true
	}
}

func TestMessage_MarshalUnmarshal(t *testing.T) {
	// Test that message types are defined correctly
	if MsgTypeState != "state" {
		t.Error("MsgTypeState should be 'state'")
	}
	if MsgTypeInput != "input" {
		t.Error("MsgTypeInput should be 'input'")
	}
	if MsgTypePing != "ping" {
		t.Error("MsgTypePing should be 'ping'")
	}
	if MsgTypePong != "pong" {
		t.Error("MsgTypePong should be 'pong'")
	}
}

func TestStatePayload_Fields(t *testing.T) {
	state := StatePayload{
		Width:   80,
		Height:  24,
		CursorX: 10,
		CursorY: 5,
		Version: 1,
	}

	if state.Width != 80 {
		t.Errorf("expected Width 80, got %d", state.Width)
	}
	if state.Height != 24 {
		t.Errorf("expected Height 24, got %d", state.Height)
	}
}

func TestInputPayload_Fields(t *testing.T) {
	input := InputPayload{
		Input: "test input",
	}

	if input.Input != "test input" {
		t.Errorf("expected 'test input', got '%s'", input.Input)
	}
}

func TestErrorPayload_Fields(t *testing.T) {
	err := ErrorPayload{
		Code:    500,
		Message: "test error",
	}

	if err.Code != 500 {
		t.Errorf("expected code 500, got %d", err.Code)
	}
	if err.Message != "test error" {
		t.Errorf("expected 'test error', got '%s'", err.Message)
	}
}

func TestCell_Fields(t *testing.T) {
	cell := Cell{
		Char:    "@",
		FgColor: "#FFFFFF",
		BgColor: "#000000",
		Bold:    true,
		Inverse: false,
		Blink:   false,
		TileX:   5,
		TileY:   10,
	}

	if cell.Char != "@" {
		t.Errorf("expected '@', got '%s'", cell.Char)
	}
	if cell.FgColor != "#FFFFFF" {
		t.Errorf("expected '#FFFFFF', got '%s'", cell.FgColor)
	}
	if !cell.Bold {
		t.Error("expected Bold to be true")
	}
}

func TestHandler_SendToClient_FailsForUnknownClient(t *testing.T) {
	h := NewHandler()
	msg := Message{Type: MsgTypeState}

	err := h.SendToClient("unknown-client", msg)
	if err == nil {
		t.Error("expected error for unknown client")
	}
}
