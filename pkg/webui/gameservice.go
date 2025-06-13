// Package webui provides GameService implementation for game-related RPC methods.
// Moved from: rpc.go
package webui

import (
	"encoding/json"
	"net/http"
)

// GameService provides game-related RPC methods
// Service structs for Gorilla RPC
// Moved from: rpc.go
type GameService struct {
	handler *RPCHandler
}

// GetState retrieves current game state
// Moved from: rpc.go
func (s *GameService) GetState(r *http.Request, args *Empty, reply *map[string]interface{}) error {
	result, err := s.handler.handleGameGetState(r.Context(), nil)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

// Poll performs long-polling for state changes
// Moved from: rpc.go
func (s *GameService) Poll(r *http.Request, args *GamePollParams, reply *map[string]interface{}) error {
	paramsJSON, _ := json.Marshal(args)
	result, err := s.handler.handleGamePoll(r.Context(), paramsJSON)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

// SendInput sends user input to the game
// Moved from: rpc.go
func (s *GameService) SendInput(r *http.Request, args *GameInputParams, reply *map[string]interface{}) error {
	paramsJSON, _ := json.Marshal(args)
	result, err := s.handler.handleGameSendInput(r.Context(), paramsJSON)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}
