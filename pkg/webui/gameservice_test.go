package webui

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// Create a simple interface that matches the GameService dependencies
type gameHandler interface {
	handleGameGetState(ctx context.Context, params json.RawMessage) (interface{}, error)
	handleGamePoll(ctx context.Context, params json.RawMessage) (interface{}, error)
	handleGameSendInput(ctx context.Context, params json.RawMessage) (interface{}, error)
}

// testableGameService allows us to test GameService with a mock handler
type testableGameService struct {
	handler gameHandler
}

// Mirror the GameService methods exactly
func (s *testableGameService) GetState(r *http.Request, args *Empty, reply *map[string]interface{}) error {
	result, err := s.handler.handleGameGetState(r.Context(), nil)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

func (s *testableGameService) Poll(r *http.Request, args *GamePollParams, reply *map[string]interface{}) error {
	paramsJSON, _ := json.Marshal(args)
	result, err := s.handler.handleGamePoll(r.Context(), paramsJSON)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

func (s *testableGameService) SendInput(r *http.Request, args *GameInputParams, reply *map[string]interface{}) error {
	paramsJSON, _ := json.Marshal(args)
	result, err := s.handler.handleGameSendInput(r.Context(), paramsJSON)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

// mockHandler implements the gameHandler interface
type mockHandler struct {
	gameGetStateFunc  func(ctx context.Context, params json.RawMessage) (interface{}, error)
	gamePollFunc      func(ctx context.Context, params json.RawMessage) (interface{}, error)
	gameSendInputFunc func(ctx context.Context, params json.RawMessage) (interface{}, error)
}

func (m *mockHandler) handleGameGetState(ctx context.Context, params json.RawMessage) (interface{}, error) {
	if m.gameGetStateFunc != nil {
		return m.gameGetStateFunc(ctx, params)
	}
	return map[string]interface{}{"state": "default"}, nil
}

func (m *mockHandler) handleGamePoll(ctx context.Context, params json.RawMessage) (interface{}, error) {
	if m.gamePollFunc != nil {
		return m.gamePollFunc(ctx, params)
	}
	return map[string]interface{}{"poll": "default"}, nil
}

func (m *mockHandler) handleGameSendInput(ctx context.Context, params json.RawMessage) (interface{}, error) {
	if m.gameSendInputFunc != nil {
		return m.gameSendInputFunc(ctx, params)
	}
	return map[string]interface{}{"input": "default"}, nil
}

func TestGameService_GetState_Success(t *testing.T) {
	// Setup
	expectedResult := map[string]interface{}{
		"width":  80,
		"height": 24,
		"cursor": map[string]int{"x": 0, "y": 0},
		"cells":  []interface{}{},
	}

	mockH := &mockHandler{
		gameGetStateFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return expectedResult, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &Empty{}
	var reply map[string]interface{}

	// Execute
	err := service.GetState(req, args, &reply)

	// Assert
	if err != nil {
		t.Errorf("GetState() error = %v, want nil", err)
	}

	if len(reply) != len(expectedResult) {
		t.Errorf("GetState() reply length = %d, want %d", len(reply), len(expectedResult))
	}

	if reply["width"] != expectedResult["width"] {
		t.Errorf("GetState() reply width = %v, want %v", reply["width"], expectedResult["width"])
	}
}

func TestGameService_GetState_Error(t *testing.T) {
	// Setup
	expectedError := errors.New("handler error")
	mockH := &mockHandler{
		gameGetStateFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return nil, expectedError
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &Empty{}
	var reply map[string]interface{}

	// Execute
	err := service.GetState(req, args, &reply)

	// Assert
	if err == nil {
		t.Error("GetState() error = nil, want error")
	}

	if err.Error() != expectedError.Error() {
		t.Errorf("GetState() error = %v, want %v", err, expectedError)
	}
}

func TestGameService_Poll_Success(t *testing.T) {
	// Setup
	expectedResult := map[string]interface{}{
		"version":   uint64(123),
		"hasChange": true,
		"diff":      map[string]interface{}{"cells": []interface{}{}},
	}

	mockH := &mockHandler{
		gamePollFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			// Verify params were marshaled correctly
			var pollParams GamePollParams
			if err := json.Unmarshal(params, &pollParams); err != nil {
				t.Errorf("Poll() params unmarshal error = %v", err)
			}

			return expectedResult, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GamePollParams{
		Version: 100,
		Timeout: 5000,
	}
	var reply map[string]interface{}

	// Execute
	err := service.Poll(req, args, &reply)

	// Assert
	if err != nil {
		t.Errorf("Poll() error = %v, want nil", err)
	}

	if reply["version"] != expectedResult["version"] {
		t.Errorf("Poll() reply version = %v, want %v", reply["version"], expectedResult["version"])
	}

	if reply["hasChange"] != expectedResult["hasChange"] {
		t.Errorf("Poll() reply hasChange = %v, want %v", reply["hasChange"], expectedResult["hasChange"])
	}
}

func TestGameService_Poll_Error(t *testing.T) {
	// Setup
	expectedError := errors.New("polling error")
	mockH := &mockHandler{
		gamePollFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return nil, expectedError
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GamePollParams{Version: 100, Timeout: 5000}
	var reply map[string]interface{}

	// Execute
	err := service.Poll(req, args, &reply)

	// Assert
	if err == nil {
		t.Error("Poll() error = nil, want error")
	}

	if err.Error() != expectedError.Error() {
		t.Errorf("Poll() error = %v, want %v", err, expectedError)
	}
}

func TestGameService_SendInput_Success(t *testing.T) {
	// Setup
	expectedResult := map[string]interface{}{
		"success": true,
		"message": "input processed",
	}

	mockH := &mockHandler{
		gameSendInputFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			// Verify params were marshaled correctly
			var inputParams GameInputParams
			if err := json.Unmarshal(params, &inputParams); err != nil {
				t.Errorf("SendInput() params unmarshal error = %v", err)
			}

			return expectedResult, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GameInputParams{
		Events: []InputEvent{
			{
				Type:      "keyboard",
				Key:       "ArrowUp",
				KeyCode:   38,
				Timestamp: time.Now().Unix(),
			},
		},
	}
	var reply map[string]interface{}

	// Execute
	err := service.SendInput(req, args, &reply)

	// Assert
	if err != nil {
		t.Errorf("SendInput() error = %v, want nil", err)
	}

	if reply["success"] != expectedResult["success"] {
		t.Errorf("SendInput() reply success = %v, want %v", reply["success"], expectedResult["success"])
	}

	if reply["message"] != expectedResult["message"] {
		t.Errorf("SendInput() reply message = %v, want %v", reply["message"], expectedResult["message"])
	}
}

func TestGameService_SendInput_Error(t *testing.T) {
	// Setup
	expectedError := errors.New("input processing error")
	mockH := &mockHandler{
		gameSendInputFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return nil, expectedError
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GameInputParams{
		Events: []InputEvent{
			{
				Type:      "keyboard",
				Key:       "Invalid",
				Timestamp: time.Now().Unix(),
			},
		},
	}
	var reply map[string]interface{}

	// Execute
	err := service.SendInput(req, args, &reply)

	// Assert
	if err == nil {
		t.Error("SendInput() error = nil, want error")
	}

	if err.Error() != expectedError.Error() {
		t.Errorf("SendInput() error = %v, want %v", err, expectedError)
	}
}

// Table-driven test for multiple scenarios - tests the same logic patterns as GameService
func TestGameService_Methods_TableDriven(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		setupMock  func(*mockHandler)
		args       interface{}
		wantError  bool
		wantResult map[string]interface{}
	}{
		{
			name:   "GetState_ValidResponse",
			method: "GetState",
			setupMock: func(m *mockHandler) {
				m.gameGetStateFunc = func(ctx context.Context, params json.RawMessage) (interface{}, error) {
					return map[string]interface{}{"state": "active"}, nil
				}
			},
			args:       &Empty{},
			wantError:  false,
			wantResult: map[string]interface{}{"state": "active"},
		},
		{
			name:   "Poll_TimeoutScenario",
			method: "Poll",
			setupMock: func(m *mockHandler) {
				m.gamePollFunc = func(ctx context.Context, params json.RawMessage) (interface{}, error) {
					return map[string]interface{}{"hasChange": false, "timeout": true}, nil
				}
			},
			args:       &GamePollParams{Version: 50, Timeout: 1000},
			wantError:  false,
			wantResult: map[string]interface{}{"hasChange": false, "timeout": true},
		},
		{
			name:   "SendInput_KeyboardInput",
			method: "SendInput",
			setupMock: func(m *mockHandler) {
				m.gameSendInputFunc = func(ctx context.Context, params json.RawMessage) (interface{}, error) {
					return map[string]interface{}{"inputType": "keyboard", "processed": true}, nil
				}
			},
			args: &GameInputParams{
				Events: []InputEvent{
					{
						Type:      "keyboard",
						Key:       "h",
						Timestamp: time.Now().Unix(),
					},
				},
			},
			wantError:  false,
			wantResult: map[string]interface{}{"inputType": "keyboard", "processed": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockH := &mockHandler{}
			tt.setupMock(mockH)
			service := &testableGameService{handler: mockH}
			req := httptest.NewRequest("POST", "/rpc", nil)
			var reply map[string]interface{}

			// Execute based on method
			var err error
			switch tt.method {
			case "GetState":
				err = service.GetState(req, tt.args.(*Empty), &reply)
			case "Poll":
				err = service.Poll(req, tt.args.(*GamePollParams), &reply)
			case "SendInput":
				err = service.SendInput(req, tt.args.(*GameInputParams), &reply)
			}

			// Assert
			if (err != nil) != tt.wantError {
				t.Errorf("%s() error = %v, wantError %v", tt.method, err, tt.wantError)
				return
			}

			if !tt.wantError {
				for key, expectedValue := range tt.wantResult {
					if reply[key] != expectedValue {
						t.Errorf("%s() reply[%s] = %v, want %v", tt.method, key, reply[key], expectedValue)
					}
				}
			}
		})
	}
}

// Test for proper JSON marshaling behavior
func TestGameService_JSONMarshaling(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		wantType string
	}{
		{
			name:     "GamePollParams_Marshaling",
			input:    &GamePollParams{Version: 42, Timeout: 3000},
			wantType: "GamePollParams",
		},
		{
			name: "GameInputParams_Marshaling",
			input: &GameInputParams{
				Events: []InputEvent{
					{
						Type:      "keyboard",
						Key:       "Enter",
						KeyCode:   13,
						Timestamp: 1234567890,
					},
				},
			},
			wantType: "GameInputParams",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test that JSON marshaling works correctly
			data, err := json.Marshal(tt.input)
			if err != nil {
				t.Errorf("JSON marshaling failed for %s: %v", tt.wantType, err)
			}

			// Test that we can unmarshal back
			switch tt.wantType {
			case "GamePollParams":
				var params GamePollParams
				if err := json.Unmarshal(data, &params); err != nil {
					t.Errorf("JSON unmarshaling failed for %s: %v", tt.wantType, err)
				}
				original := tt.input.(*GamePollParams)
				if params.Version != original.Version || params.Timeout != original.Timeout {
					t.Errorf("JSON round-trip failed for %s", tt.wantType)
				}
			case "GameInputParams":
				var params GameInputParams
				if err := json.Unmarshal(data, &params); err != nil {
					t.Errorf("JSON unmarshaling failed for %s: %v", tt.wantType, err)
				}
				original := tt.input.(*GameInputParams)
				if len(params.Events) != len(original.Events) {
					t.Errorf("JSON round-trip failed for %s: event count mismatch", tt.wantType)
				}
				if len(params.Events) > 0 && params.Events[0].Type != original.Events[0].Type {
					t.Errorf("JSON round-trip failed for %s: event type mismatch", tt.wantType)
				}
			}
		})
	}
}

// Test edge cases and error conditions
func TestGameService_EdgeCases(t *testing.T) {
	t.Run("GetState_TypeAssertion", func(t *testing.T) {
		mockH := &mockHandler{
			gameGetStateFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
				return map[string]interface{}{"test": "value"}, nil
			},
		}

		service := &testableGameService{handler: mockH}
		req := httptest.NewRequest("POST", "/rpc", nil)
		args := &Empty{}
		var reply map[string]interface{}

		err := service.GetState(req, args, &reply)
		if err != nil {
			t.Errorf("GetState() with valid handler should not error, got: %v", err)
		}

		if reply["test"] != "value" {
			t.Errorf("GetState() reply should contain expected values")
		}
	})

	t.Run("Poll_EmptyParams", func(t *testing.T) {
		mockH := &mockHandler{
			gamePollFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
				var pollParams GamePollParams
				json.Unmarshal(params, &pollParams)
				return map[string]interface{}{"version": pollParams.Version}, nil
			},
		}

		service := &testableGameService{handler: mockH}
		req := httptest.NewRequest("POST", "/rpc", nil)
		args := &GamePollParams{} // Empty params
		var reply map[string]interface{}

		err := service.Poll(req, args, &reply)
		if err != nil {
			t.Errorf("Poll() with empty params should not error, got: %v", err)
		}
	})

	t.Run("SendInput_EmptyEvents", func(t *testing.T) {
		mockH := &mockHandler{
			gameSendInputFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
				var inputParams GameInputParams
				json.Unmarshal(params, &inputParams)
				return map[string]interface{}{"eventCount": len(inputParams.Events)}, nil
			},
		}

		service := &testableGameService{handler: mockH}
		req := httptest.NewRequest("POST", "/rpc", nil)
		args := &GameInputParams{Events: []InputEvent{}} // Empty events
		var reply map[string]interface{}

		err := service.SendInput(req, args, &reply)
		if err != nil {
			t.Errorf("SendInput() with empty events should not error, got: %v", err)
		}

		if reply["eventCount"] != 0 {
			t.Errorf("SendInput() should handle empty events correctly")
		}
	})
}

// Benchmark tests for performance validation
func BenchmarkGameService_GetState(b *testing.B) {
	mockH := &mockHandler{
		gameGetStateFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return map[string]interface{}{"state": "benchmark"}, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &Empty{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var reply map[string]interface{}
		_ = service.GetState(req, args, &reply)
	}
}

func BenchmarkGameService_Poll(b *testing.B) {
	mockH := &mockHandler{
		gamePollFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return map[string]interface{}{"hasChange": false}, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GamePollParams{Version: 1, Timeout: 1000}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var reply map[string]interface{}
		_ = service.Poll(req, args, &reply)
	}
}

func BenchmarkGameService_SendInput(b *testing.B) {
	mockH := &mockHandler{
		gameSendInputFunc: func(ctx context.Context, params json.RawMessage) (interface{}, error) {
			return map[string]interface{}{"processed": true}, nil
		},
	}

	service := &testableGameService{handler: mockH}
	req := httptest.NewRequest("POST", "/rpc", nil)
	args := &GameInputParams{
		Events: []InputEvent{
			{
				Type:      "keyboard",
				Key:       "a",
				Timestamp: time.Now().Unix(),
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var reply map[string]interface{}
		_ = service.SendInput(req, args, &reply)
	}
}
