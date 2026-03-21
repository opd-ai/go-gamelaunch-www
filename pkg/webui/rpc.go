// Package webui provides the legacy JSON-RPC and polling web interface.
//
// Deprecated: The JSON-RPC polling interface is superseded by the Ebitengine
// WASM client (pkg/wasm) and WebSocket transport (pkg/transport). New
// deployments should use the WASM client; see docs/MIGRATION.md.
package webui

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// RPCHandler handles JSON-RPC requests via a manual dispatch switch.
//
// Deprecated: Use the WebSocket-based transport in pkg/transport together with
// the Ebitengine WASM client in pkg/wasm. This handler will be removed in a
// future release.
type RPCHandler struct {
	webui *WebUI
}

// NewRPCHandler creates a new RPC handler.
//
// Deprecated: See RPCHandler for migration guidance.
func NewRPCHandler(webui *WebUI) *RPCHandler {
	slog.Warn("webui: JSON-RPC handler is deprecated; migrate to the WebSocket/WASM transport")
	return &RPCHandler{webui: webui}
}

// HandleRequest preserves the original signature for compatibility
func (h *RPCHandler) HandleRequest(ctx context.Context, req *RPCRequest) *RPCResponse {
	slog.Debug("rpc.HandleRequest", "method", req.Method, "id", req.ID)

	response := &RPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "tileset.fetch":
		result, err := h.handleTilesetFetch(ctx, req.Params)
		if err != nil {
			slog.Error("tileset.fetch failed", "error", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			response.Result = result
		}

	case "game.getState":
		result, err := h.handleGameGetState(ctx, req.Params)
		if err != nil {
			slog.Error("game.getState failed", "error", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			response.Result = result
		}

	case "game.sendInput":
		result, err := h.handleGameSendInput(ctx, req.Params)
		if err != nil {
			slog.Error("game.sendInput failed", "error", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			response.Result = result
		}

	case "game.poll":
		result, err := h.handleGamePoll(ctx, req.Params)
		if err != nil {
			slog.Error("game.poll failed", "error", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			response.Result = result
		}

	case "tileset.update":
		result, err := h.handleTilesetUpdate(ctx, req.Params)
		if err != nil {
			slog.Error("tileset.update failed", "error", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			response.Result = result
		}

	case "session.info":
		result, err := h.handleSessionInfo(ctx, req.Params)
		if err != nil {
			slog.Error("session.info failed", "error", err)
			response.Error = h.makeError(InternalError, err.Error())
		} else {
			response.Result = result
		}

	case "game.disconnect":
		response.Result = map[string]interface{}{"disconnected": true}

	case "game.resize":
		result, err := h.handleGameResize(ctx, req.Params)
		if err != nil {
			slog.Error("game.resize failed", "error", err)
			response.Error = h.makeError(InvalidParams, err.Error())
		} else {
			response.Result = result
		}

	default:
		slog.Warn("rpc.HandleRequest: unknown method", "method", req.Method)
		response.Error = h.makeError(MethodNotFound, fmt.Sprintf("method '%s' not found", req.Method))
	}

	slog.Debug("rpc.HandleRequest done", "method", req.Method, "id", req.ID, "success", response.Error == nil)
	return response
}

// Original handler methods preserved with all logging
func (h *RPCHandler) handleTilesetFetch(ctx context.Context, params json.RawMessage) (interface{}, error) {
	slog.Debug("rpc.handleTilesetFetch")

	tileset := h.webui.GetTileset()
	if tileset == nil {
		return map[string]interface{}{
			"tileset":         nil,
			"image_available": false,
		}, nil
	}

	tilesetJSON := tileset.ToJSON()
	imageAvailable := tileset.GetImageData() != nil

	return map[string]interface{}{
		"tileset":         tilesetJSON,
		"image_available": imageAvailable,
	}, nil
}

func (h *RPCHandler) handleGameGetState(ctx context.Context, params json.RawMessage) (interface{}, error) {
	slog.Debug("rpc.handleGameGetState")

	if h.webui.view == nil {
		return map[string]interface{}{
			"state":     nil,
			"connected": false,
		}, nil
	}

	state := h.webui.view.GetCurrentState()
	return map[string]interface{}{
		"state":     state,
		"connected": true,
	}, nil
}

func (h *RPCHandler) handleGamePoll(ctx context.Context, params json.RawMessage) (interface{}, error) {
	slog.Debug("rpc.handleGamePoll")

	var pollParams GamePollParams
	if err := json.Unmarshal(params, &pollParams); err != nil {
		slog.Error("rpc.handleGamePoll: invalid params", "error", err)
		return nil, fmt.Errorf("invalid poll parameters: %w", err)
	}

	if h.webui.view == nil {
		return pollTimeoutResponse(0), nil
	}

	timeout := clampPollTimeout(pollParams.Timeout)

	pollCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	stateManager := h.webui.view.stateManager
	diff, err := stateManager.PollChangesWithContext(pollCtx, pollParams.Version)
	if err != nil {
		if ctx.Err() == context.Canceled || ctx.Err() == context.DeadlineExceeded {
			return pollTimeoutResponse(stateManager.GetCurrentVersion()), nil
		}
		slog.Error("rpc.handleGamePoll: polling error", "error", err)
		return nil, err
	}

	if diff == nil {
		return pollTimeoutResponse(stateManager.GetCurrentVersion()), nil
	}

	slog.Debug("rpc.handleGamePoll done", "version", diff.Version)
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
	slog.Debug("rpc.handleGameSendInput")

	var inputParams GameInputParams
	if err := json.Unmarshal(params, &inputParams); err != nil {
		slog.Error("rpc.handleGameSendInput: invalid params", "error", err)
		return nil, fmt.Errorf("invalid input parameters: %w", err)
	}

	if h.webui.view == nil {
		return nil, fmt.Errorf("no view available")
	}

	// Process each input event
	processedCount := 0
	for _, event := range inputParams.Events {
		data := h.convertInputEvent(event)
		if len(data) > 0 {
			h.webui.view.SendInput(data)
			processedCount++
		}
	}

	slog.Debug("rpc.handleGameSendInput done", "processed", processedCount, "total", len(inputParams.Events))
	return map[string]interface{}{
		"processed": processedCount,
	}, nil
}

func (h *RPCHandler) convertInputEvent(event InputEvent) []byte {
	switch event.Type {
	case "keydown":
		return h.convertKeyEvent(event)
	case "paste":
		return []byte(event.Data)
	default:
		return nil
	}
}

func (h *RPCHandler) convertKeyEvent(event InputEvent) []byte {
	switch event.Key {
	case "Enter":
		return []byte("\r")
	case "Backspace":
		return []byte("\b")
	case "Tab":
		return []byte("\t")
	case "Escape":
		return []byte("\x1b")
	case "ArrowUp":
		return []byte("\x1b[A")
	case "ArrowDown":
		return []byte("\x1b[B")
	case "ArrowRight":
		return []byte("\x1b[C")
	case "ArrowLeft":
		return []byte("\x1b[D")
	case "Home":
		return []byte("\x1b[H")
	case "End":
		return []byte("\x1b[F")
	case "PageUp":
		return []byte("\x1b[5~")
	case "PageDown":
		return []byte("\x1b[6~")
	case "Delete":
		return []byte("\x1b[3~")
	case "Insert":
		return []byte("\x1b[2~")
	default:
		// Regular character
		if len(event.Key) == 1 {
			return []byte(event.Key)
		}
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
