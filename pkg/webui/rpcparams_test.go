// Package webui provides unit tests for RPC parameter and input event data types.
package webui

import (
	"encoding/json"
	"testing"
	"time"
)

// TestGamePollParams_JSONMarshalUnmarshal tests GamePollParams JSON serialization
func TestGamePollParams_JSONMarshalUnmarshal(t *testing.T) {
	tests := []struct {
		name     string
		params   GamePollParams
		expected string
	}{
		{
			name:     "WithTimeout",
			params:   GamePollParams{Version: 123, Timeout: 30},
			expected: `{"version":123,"timeout":30}`,
		},
		{
			name:     "WithoutTimeout",
			params:   GamePollParams{Version: 456, Timeout: 0},
			expected: `{"version":456}`,
		},
		{
			name:     "ZeroValues",
			params:   GamePollParams{Version: 0, Timeout: 0},
			expected: `{"version":0}`,
		},
		{
			name:     "MaxValues",
			params:   GamePollParams{Version: 18446744073709551615, Timeout: 2147483647},
			expected: `{"version":18446744073709551615,"timeout":2147483647}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test marshaling
			data, err := json.Marshal(tt.params)
			if err != nil {
				t.Fatalf("Failed to marshal GamePollParams: %v", err)
			}

			if string(data) != tt.expected {
				t.Errorf("Marshal mismatch:\nGot:      %s\nExpected: %s", string(data), tt.expected)
			}

			// Test unmarshaling
			var unmarshaled GamePollParams
			err = json.Unmarshal(data, &unmarshaled)
			if err != nil {
				t.Fatalf("Failed to unmarshal GamePollParams: %v", err)
			}

			if unmarshaled.Version != tt.params.Version {
				t.Errorf("Version mismatch: got %d, expected %d", unmarshaled.Version, tt.params.Version)
			}

			if unmarshaled.Timeout != tt.params.Timeout {
				t.Errorf("Timeout mismatch: got %d, expected %d", unmarshaled.Timeout, tt.params.Timeout)
			}
		})
	}
}

// TestGameInputParams_JSONMarshalUnmarshal tests GameInputParams JSON serialization
func TestGameInputParams_JSONMarshalUnmarshal(t *testing.T) {
	timestamp := time.Now().UnixMilli()

	tests := []struct {
		name   string
		params GameInputParams
	}{
		{
			name: "EmptyEvents",
			params: GameInputParams{
				Events: []InputEvent{},
			},
		},
		{
			name: "SingleEvent",
			params: GameInputParams{
				Events: []InputEvent{
					{Type: "keydown", Key: "a", KeyCode: 65, Timestamp: timestamp},
				},
			},
		},
		{
			name: "MultipleEvents",
			params: GameInputParams{
				Events: []InputEvent{
					{Type: "keydown", Key: "Enter", KeyCode: 13, Timestamp: timestamp},
					{Type: "keyup", Key: "Enter", KeyCode: 13, Timestamp: timestamp + 100},
				},
			},
		},
		{
			name: "EventWithData",
			params: GameInputParams{
				Events: []InputEvent{
					{Type: "paste", Data: "hello world", Timestamp: timestamp},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test marshaling
			data, err := json.Marshal(tt.params)
			if err != nil {
				t.Fatalf("Failed to marshal GameInputParams: %v", err)
			}

			// Test unmarshaling
			var unmarshaled GameInputParams
			err = json.Unmarshal(data, &unmarshaled)
			if err != nil {
				t.Fatalf("Failed to unmarshal GameInputParams: %v", err)
			}

			if len(unmarshaled.Events) != len(tt.params.Events) {
				t.Errorf("Events length mismatch: got %d, expected %d",
					len(unmarshaled.Events), len(tt.params.Events))
			}

			for i, event := range unmarshaled.Events {
				expected := tt.params.Events[i]
				if event.Type != expected.Type {
					t.Errorf("Event[%d].Type mismatch: got %s, expected %s", i, event.Type, expected.Type)
				}
				if event.Key != expected.Key {
					t.Errorf("Event[%d].Key mismatch: got %s, expected %s", i, event.Key, expected.Key)
				}
				if event.KeyCode != expected.KeyCode {
					t.Errorf("Event[%d].KeyCode mismatch: got %d, expected %d", i, event.KeyCode, expected.KeyCode)
				}
				if event.Data != expected.Data {
					t.Errorf("Event[%d].Data mismatch: got %s, expected %s", i, event.Data, expected.Data)
				}
				if event.Timestamp != expected.Timestamp {
					t.Errorf("Event[%d].Timestamp mismatch: got %d, expected %d", i, event.Timestamp, expected.Timestamp)
				}
			}
		})
	}
}

// TestInputEvent_JSONMarshalUnmarshal tests InputEvent JSON serialization
func TestInputEvent_JSONMarshalUnmarshal(t *testing.T) {
	tests := []struct {
		name     string
		event    InputEvent
		expected string
	}{
		{
			name:     "KeydownEvent",
			event:    InputEvent{Type: "keydown", Key: "a", KeyCode: 65, Timestamp: 1234567890},
			expected: `{"type":"keydown","key":"a","keyCode":65,"timestamp":1234567890}`,
		},
		{
			name:     "KeyupEvent",
			event:    InputEvent{Type: "keyup", Key: "Enter", KeyCode: 13, Timestamp: 1234567891},
			expected: `{"type":"keyup","key":"Enter","keyCode":13,"timestamp":1234567891}`,
		},
		{
			name:     "PasteEvent",
			event:    InputEvent{Type: "paste", Data: "hello", Timestamp: 1234567892},
			expected: `{"type":"paste","data":"hello","timestamp":1234567892}`,
		},
		{
			name:     "MinimalEvent",
			event:    InputEvent{Type: "click", Timestamp: 1234567893},
			expected: `{"type":"click","timestamp":1234567893}`,
		},
		{
			name:     "EventWithSpecialChars",
			event:    InputEvent{Type: "keydown", Key: "\\", KeyCode: 92, Data: "\"test\"", Timestamp: 1234567894},
			expected: `{"type":"keydown","key":"\\","keyCode":92,"data":"\"test\"","timestamp":1234567894}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test marshaling
			data, err := json.Marshal(tt.event)
			if err != nil {
				t.Fatalf("Failed to marshal InputEvent: %v", err)
			}

			if string(data) != tt.expected {
				t.Errorf("Marshal mismatch:\nGot:      %s\nExpected: %s", string(data), tt.expected)
			}

			// Test unmarshaling
			var unmarshaled InputEvent
			err = json.Unmarshal(data, &unmarshaled)
			if err != nil {
				t.Fatalf("Failed to unmarshal InputEvent: %v", err)
			}

			if unmarshaled.Type != tt.event.Type {
				t.Errorf("Type mismatch: got %s, expected %s", unmarshaled.Type, tt.event.Type)
			}
			if unmarshaled.Key != tt.event.Key {
				t.Errorf("Key mismatch: got %s, expected %s", unmarshaled.Key, tt.event.Key)
			}
			if unmarshaled.KeyCode != tt.event.KeyCode {
				t.Errorf("KeyCode mismatch: got %d, expected %d", unmarshaled.KeyCode, tt.event.KeyCode)
			}
			if unmarshaled.Data != tt.event.Data {
				t.Errorf("Data mismatch: got %s, expected %s", unmarshaled.Data, tt.event.Data)
			}
			if unmarshaled.Timestamp != tt.event.Timestamp {
				t.Errorf("Timestamp mismatch: got %d, expected %d", unmarshaled.Timestamp, tt.event.Timestamp)
			}
		})
	}
}

// TestEmpty_JSONMarshalUnmarshal tests Empty struct JSON serialization
func TestEmpty_JSONMarshalUnmarshal(t *testing.T) {
	t.Run("EmptyStruct", func(t *testing.T) {
		empty := Empty{}

		// Test marshaling
		data, err := json.Marshal(empty)
		if err != nil {
			t.Fatalf("Failed to marshal Empty: %v", err)
		}

		expected := `{}`
		if string(data) != expected {
			t.Errorf("Marshal mismatch:\nGot:      %s\nExpected: %s", string(data), expected)
		}

		// Test unmarshaling
		var unmarshaled Empty
		err = json.Unmarshal(data, &unmarshaled)
		if err != nil {
			t.Fatalf("Failed to unmarshal Empty: %v", err)
		}

		// Empty struct should remain empty after round-trip
		if unmarshaled != empty {
			t.Errorf("Empty struct changed after round-trip")
		}
	})
}

// TestInputEvent_ValidationScenarios tests various validation scenarios for InputEvent
func TestInputEvent_ValidationScenarios(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		expectError bool
		description string
	}{
		{
			name:        "ValidCompleteEvent",
			jsonInput:   `{"type":"keydown","key":"a","keyCode":65,"data":"test","timestamp":1234567890}`,
			expectError: false,
			description: "Complete valid event should parse successfully",
		},
		{
			name:        "ValidMinimalEvent",
			jsonInput:   `{"type":"click","timestamp":1234567890}`,
			expectError: false,
			description: "Minimal event with only required fields should parse successfully",
		},
		{
			name:        "EmptyJSON",
			jsonInput:   `{}`,
			expectError: false,
			description: "Empty JSON should create zero-value InputEvent",
		},
		{
			name:        "NegativeTimestamp",
			jsonInput:   `{"type":"keydown","timestamp":-1}`,
			expectError: false,
			description: "Negative timestamp should be allowed (historical events)",
		},
		{
			name:        "ZeroKeyCode",
			jsonInput:   `{"type":"keydown","keyCode":0,"timestamp":1234567890}`,
			expectError: false,
			description: "Zero key code should be allowed",
		},
		{
			name:        "LargeKeyCode",
			jsonInput:   `{"type":"keydown","keyCode":2147483647,"timestamp":1234567890}`,
			expectError: false,
			description: "Large key code should be allowed",
		},
		{
			name:        "UnicodeKey",
			jsonInput:   `{"type":"keydown","key":"€","timestamp":1234567890}`,
			expectError: false,
			description: "Unicode characters in key should be allowed",
		},
		{
			name:        "InvalidJSON",
			jsonInput:   `{"type":"keydown","key":}`,
			expectError: true,
			description: "Invalid JSON should cause parse error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var event InputEvent
			err := json.Unmarshal([]byte(tt.jsonInput), &event)

			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none: %s", tt.description)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v - %s", err, tt.description)
			}
		})
	}
}

// TestGamePollParams_EdgeCases tests edge cases for GamePollParams
func TestGamePollParams_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		jsonInput string
		expected  GamePollParams
	}{
		{
			name:      "NegativeTimeout",
			jsonInput: `{"version":1,"timeout":-1}`,
			expected:  GamePollParams{Version: 1, Timeout: -1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var params GamePollParams
			err := json.Unmarshal([]byte(tt.jsonInput), &params)
			if err != nil {
				t.Fatalf("Failed to unmarshal: %v", err)
			}

			if params.Version != tt.expected.Version {
				t.Errorf("Version mismatch: got %d, expected %d", params.Version, tt.expected.Version)
			}
			if params.Timeout != tt.expected.Timeout {
				t.Errorf("Timeout mismatch: got %d, expected %d", params.Timeout, tt.expected.Timeout)
			}
		})
	}
}

// TestStructFieldTags tests that JSON tags are properly defined
func TestStructFieldTags(t *testing.T) {
	t.Run("GamePollParamsStructure", func(t *testing.T) {
		params := GamePollParams{Version: 123, Timeout: 30}
		data, _ := json.Marshal(params)

		// Verify timeout is omitted when zero
		paramsZero := GamePollParams{Version: 123, Timeout: 0}
		dataZero, _ := json.Marshal(paramsZero)

		if string(dataZero) != `{"version":123}` {
			t.Errorf("Expected timeout to be omitted when zero, got: %s", string(dataZero))
		}

		if string(data) != `{"version":123,"timeout":30}` {
			t.Errorf("Expected timeout to be included when non-zero, got: %s", string(data))
		}
	})

	t.Run("InputEventStructure", func(t *testing.T) {
		// Test that omitempty works for optional fields
		event := InputEvent{Type: "click", Timestamp: 123}
		data, _ := json.Marshal(event)

		// Key, KeyCode, and Data should be omitted when empty
		expected := `{"type":"click","timestamp":123}`
		if string(data) != expected {
			t.Errorf("Expected omitted empty fields, got: %s", string(data))
		}
	})
}
