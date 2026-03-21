package webui

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// RPCHandler handles JSON-RPC requests via a manual dispatch switch.
type RPCHandler struct {
	webui *WebUI
}

// NewRPCHandler creates a new RPC handler.
func NewRPCHandler(webui *WebUI) *RPCHandler {
	return &RPCHandler{webui: webui}
}

// HandleRequest preserves the original signature for compatibility
func (h *RPCHandler) HandleRequest(ctx context.Context, req *RPCRequest) *RPCResponse {
	log.Printf("[RPC] Handling request: method=%s, id=%v", req.Method, req.ID)

	response := &RPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "tileset.fetch":
		log.Printf("[RPC] Processing tileset.fetch request")
		result, err := h.handleTilesetFetch(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] tileset.fetch error: %v", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			log.Printf("[RPC] tileset.fetch completed successfully")
			response.Result = result
		}

	case "game.getState":
		log.Printf("[RPC] Processing game.getState request")
		result, err := h.handleGameGetState(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] game.getState error: %v", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			log.Printf("[RPC] game.getState completed successfully")
			response.Result = result
		}

	case "game.sendInput":
		log.Printf("[RPC] Processing game.sendInput request")
		result, err := h.handleGameSendInput(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] game.sendInput error: %v", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			log.Printf("[RPC] game.sendInput completed successfully")
			response.Result = result
		}

	case "game.poll":
		log.Printf("[RPC] Processing game.poll request")
		result, err := h.handleGamePoll(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] game.poll error: %v", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			log.Printf("[RPC] game.poll completed successfully")
			response.Result = result
		}

	case "tileset.update":
		log.Printf("[RPC] Processing tileset.update request")
		result, err := h.handleTilesetUpdate(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] tileset.update error: %v", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			log.Printf("[RPC] tileset.update completed successfully")
			response.Result = result
		}

	case "session.info":
		log.Printf("[RPC] Processing session.info request")
		result, err := h.handleSessionInfo(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] session.info error: %v", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			log.Printf("[RPC] session.info completed successfully")
			response.Result = result
		}

	case "game.disconnect":
		log.Printf("[RPC] Processing game.disconnect request")
		response.Result = map[string]interface{}{"disconnected": true}

	case "game.resize":
		log.Printf("[RPC] Processing game.resize request")
		result, err := h.handleGameResize(ctx, req.Params)
		if err != nil {
			log.Printf("[RPC] game.resize error: %v", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			log.Printf("[RPC] game.resize completed successfully")
			response.Result = result
		}

	default:
		log.Printf("[RPC] Unknown method requested: %s", req.Method)
		response.Error = h.makeError(MethodNotFound, fmt.Sprintf("method '%s' not found", req.Method))
	}

	log.Printf("[RPC] Request completed: method=%s, id=%v, success=%t", req.Method, req.ID, response.Error == nil)
	return response
}

// Original handler methods preserved with all logging
func (h *RPCHandler) handleTilesetFetch(ctx context.Context, params json.RawMessage) (interface{}, error) {
	log.Printf("[RPC] handleTilesetFetch: Starting tileset fetch")

	tileset := h.webui.GetTileset()
	if tileset == nil {
		log.Printf("[RPC] handleTilesetFetch: No tileset available, returning empty response")
		return map[string]interface{}{
			"tileset":         nil,
			"image_available": false,
		}, nil
	}

	log.Printf("[RPC] handleTilesetFetch: Tileset found, converting to JSON")
	tilesetJSON := tileset.ToJSON()

	imageData := tileset.GetImageData()
	imageAvailable := imageData != nil
	log.Printf("[RPC] handleTilesetFetch: Image data available: %t", imageAvailable)

	result := map[string]interface{}{
		"tileset":         tilesetJSON,
		"image_available": imageAvailable,
	}

	log.Printf("[RPC] handleTilesetFetch: Successfully prepared response with image_available=%t", imageAvailable)
	return result, nil
}

func (h *RPCHandler) handleGameGetState(ctx context.Context, params json.RawMessage) (interface{}, error) {
	log.Printf("[RPC] handleGameGetState: Starting game state retrieval")

	if h.webui.view == nil {
		log.Printf("[RPC] handleGameGetState: No view available, returning disconnected state")
		return map[string]interface{}{
			"state":     nil,
			"connected": false,
		}, nil
	}

	log.Printf("[RPC] handleGameGetState: View available, retrieving current state")
	state := h.webui.view.GetCurrentState()

	log.Printf("[RPC] handleGameGetState: Successfully retrieved game state, connected=true")
	return map[string]interface{}{
		"state":     state,
		"connected": true,
	}, nil
}

func (h *RPCHandler) handleGamePoll(ctx context.Context, params json.RawMessage) (interface{}, error) {
	log.Printf("[RPC] handleGamePoll: Starting poll request processing")

	var pollParams GamePollParams
	if err := json.Unmarshal(params, &pollParams); err != nil {
		log.Printf("[RPC] handleGamePoll: Failed to unmarshal poll parameters: %v", err)
		return nil, fmt.Errorf("invalid poll parameters: %w", err)
	}

	log.Printf("[RPC] handleGamePoll: Poll parameters - version=%d, timeout=%d", pollParams.Version, pollParams.Timeout)

	if h.webui.view == nil {
		log.Printf("[RPC] handleGamePoll: No view available, returning timeout response")
		return pollTimeoutResponse(0), nil
	}

	timeout := clampPollTimeout(pollParams.Timeout)
	log.Printf("[RPC] handleGamePoll: Using timeout duration: %v", timeout)

	pollCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	stateManager := h.webui.view.stateManager
	log.Printf("[RPC] handleGamePoll: Starting PollChangesWithContext for version %d", pollParams.Version)
	diff, err := stateManager.PollChangesWithContext(pollCtx, pollParams.Version)
	if err != nil {
		if ctx.Err() == context.Canceled || ctx.Err() == context.DeadlineExceeded {
			log.Printf("[RPC] handleGamePoll: Context done, returning timeout response")
			return pollTimeoutResponse(stateManager.GetCurrentVersion()), nil
		}
		log.Printf("[RPC] handleGamePoll: Error during polling: %v", err)
		return nil, err
	}

	if diff == nil {
		currentVersion := stateManager.GetCurrentVersion()
		log.Printf("[RPC] handleGamePoll: No changes detected. Current version: %d", currentVersion)
		return pollTimeoutResponse(currentVersion), nil
	}

	log.Printf("[RPC] handleGamePoll: Changes detected, returning diff for version %d", diff.Version)
	return map[string]interface{}{
		"changes": diff,
		"version": diff.Version,
		"timeout": false,
	}, nil
}

// clampPollTimeout converts a millisecond value to a bounded Duration (1ms–30s).
func clampPollTimeout(ms int) time.Duration {
	d := time.Duration(ms) * time.Millisecond
	if d <= 0 {
		return 25 * time.Second
	}
	if d > 30*time.Second {
		return 30 * time.Second
	}
	return d
}

// pollTimeoutResponse builds the standard "no changes / timeout" poll response.
func pollTimeoutResponse(version uint64) map[string]interface{} {
	return map[string]interface{}{
		"changes": nil,
		"version": version,
		"timeout": true,
	}
}

func (h *RPCHandler) handleGameSendInput(ctx context.Context, params json.RawMessage) (interface{}, error) {
	log.Printf("[RPC] handleGameSendInput: Starting input processing")

	var inputParams GameInputParams
	if err := json.Unmarshal(params, &inputParams); err != nil {
		log.Printf("[RPC] handleGameSendInput: Failed to unmarshal input parameters: %v", err)
		return nil, fmt.Errorf("invalid input parameters: %w", err)
	}

	log.Printf("[RPC] handleGameSendInput: Received %d input events", len(inputParams.Events))

	if h.webui.view == nil {
		log.Printf("[RPC] handleGameSendInput: No view available")
		return nil, fmt.Errorf("no view available")
	}

	log.Printf("[RPC] handleGameSendInput: View available, processing events")

	// Process each input event
	processedCount := 0
	for i, event := range inputParams.Events {
		log.Printf("[RPC] handleGameSendInput: Processing event %d/%d - type=%s, key=%s, timestamp=%d",
			i+1, len(inputParams.Events), event.Type, event.Key, event.Timestamp)

		data := h.convertInputEvent(event)
		if len(data) > 0 {
			log.Printf("[RPC] handleGameSendInput: Sending input data for event %d: %q", i+1, string(data))
			h.webui.view.SendInput(data)
			processedCount++
		} else {
			log.Printf("[RPC] handleGameSendInput: Event %d produced no input data, skipping", i+1)
		}
	}

	log.Printf("[RPC] handleGameSendInput: Successfully processed %d/%d events", processedCount, len(inputParams.Events))

	return map[string]interface{}{
		"processed": processedCount,
	}, nil
}

func (h *RPCHandler) convertInputEvent(event InputEvent) []byte {
	log.Printf("[RPC] convertInputEvent: Processing input event - type=%s, key=%s, data=%q",
		event.Type, event.Key, event.Data)

	switch event.Type {
	case "keydown":
		log.Printf("[RPC] convertInputEvent: Processing keydown event for key=%s", event.Key)
		result := h.convertKeyEvent(event)
		if result != nil {
			log.Printf("[RPC] convertInputEvent: Keydown converted to %d bytes: %q", len(result), string(result))
		} else {
			log.Printf("[RPC] convertInputEvent: Keydown event produced no output")
		}
		return result
	case "paste":
		log.Printf("[RPC] convertInputEvent: Processing paste event with %d bytes of data", len(event.Data))
		result := []byte(event.Data)
		log.Printf("[RPC] convertInputEvent: Paste event converted to %d bytes", len(result))
		return result
	default:
		log.Printf("[RPC] convertInputEvent: Unknown event type '%s', returning nil", event.Type)
		return nil
	}
}

func (h *RPCHandler) convertKeyEvent(event InputEvent) []byte {
	log.Printf("[RPC] convertKeyEvent: Starting conversion for key=%s", event.Key)

	switch event.Key {
	case "Enter":
		log.Printf("[RPC] convertKeyEvent: Converting Enter key to carriage return")
		return []byte("\r")
	case "Backspace":
		log.Printf("[RPC] convertKeyEvent: Converting Backspace key to backspace sequence")
		return []byte("\b")
	case "Tab":
		log.Printf("[RPC] convertKeyEvent: Converting Tab key to tab sequence")
		return []byte("\t")
	case "Escape":
		log.Printf("[RPC] convertKeyEvent: Converting Escape key to escape sequence")
		return []byte("\x1b")
	case "ArrowUp":
		log.Printf("[RPC] convertKeyEvent: Converting ArrowUp key to ANSI up sequence")
		return []byte("\x1b[A")
	case "ArrowDown":
		log.Printf("[RPC] convertKeyEvent: Converting ArrowDown key to ANSI down sequence")
		return []byte("\x1b[B")
	case "ArrowRight":
		log.Printf("[RPC] convertKeyEvent: Converting ArrowRight key to ANSI right sequence")
		return []byte("\x1b[C")
	case "ArrowLeft":
		log.Printf("[RPC] convertKeyEvent: Converting ArrowLeft key to ANSI left sequence")
		return []byte("\x1b[D")
	case "Home":
		log.Printf("[RPC] convertKeyEvent: Converting Home key to ANSI home sequence")
		return []byte("\x1b[H")
	case "End":
		log.Printf("[RPC] convertKeyEvent: Converting End key to ANSI end sequence")
		return []byte("\x1b[F")
	case "PageUp":
		log.Printf("[RPC] convertKeyEvent: Converting PageUp key to ANSI page up sequence")
		return []byte("\x1b[5~")
	case "PageDown":
		log.Printf("[RPC] convertKeyEvent: Converting PageDown key to ANSI page down sequence")
		return []byte("\x1b[6~")
	case "Delete":
		log.Printf("[RPC] convertKeyEvent: Converting Delete key to ANSI delete sequence")
		return []byte("\x1b[3~")
	case "Insert":
		log.Printf("[RPC] convertKeyEvent: Converting Insert key to ANSI insert sequence")
		return []byte("\x1b[2~")
	default:
		// Regular character
		if len(event.Key) == 1 {
			log.Printf("[RPC] convertKeyEvent: Converting regular character key '%s' to byte", event.Key)
			return []byte(event.Key)
		}
		log.Printf("[RPC] convertKeyEvent: Unknown or multi-character key '%s' - returning nil", event.Key)
		return nil
	}
}

func (h *RPCHandler) handleTilesetUpdate(ctx context.Context, params json.RawMessage) (interface{}, error) {
	var updateParams TilesetUpdateParams
	if err := json.Unmarshal(params, &updateParams); err != nil {
		return nil, fmt.Errorf("invalid tileset update parameters: %w", err)
	}

	ts := h.webui.tilesetService
	if ts == nil {
		return nil, fmt.Errorf("tileset service not available")
	}

	var result map[string]interface{}
	if err := ts.Update(nil, &updateParams, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (h *RPCHandler) handleSessionInfo(ctx context.Context, params json.RawMessage) (interface{}, error) {
	return map[string]interface{}{
		"sessionId":      "session-1",
		"connected":      h.webui.view != nil,
		"timestamp":      time.Now().Unix(),
		"server_version": "1.0.0",
	}, nil
}

// GameResizeParams holds terminal resize dimensions.
type GameResizeParams struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

func (h *RPCHandler) handleGameResize(ctx context.Context, params json.RawMessage) (interface{}, error) {
	var resizeParams GameResizeParams
	if err := json.Unmarshal(params, &resizeParams); err != nil {
		return nil, fmt.Errorf("invalid resize parameters: %w", err)
	}
	return map[string]interface{}{
		"resized": true,
		"width":   resizeParams.Width,
		"height":  resizeParams.Height,
	}, nil
}

func (h *RPCHandler) makeError(code int, message string) *RPCError {
	return &RPCError{
		Code:    code,
		Message: message,
	}
}
