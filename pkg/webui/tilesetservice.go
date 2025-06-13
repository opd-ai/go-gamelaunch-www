// Package webui provides TilesetService implementation for tileset-related RPC methods.
// Moved from: rpc.go
package webui

import (
	"encoding/json"
	"net/http"
)

// TilesetService provides tileset-related RPC methods
// Moved from: rpc.go
type TilesetService struct {
	handler *RPCHandler
}

// Fetch retrieves current tileset configuration
// Moved from: rpc.go
func (s *TilesetService) Fetch(r *http.Request, args *Empty, reply *map[string]interface{}) error {
	result, err := s.handler.handleTilesetFetch(r.Context(), nil)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}

// Update updates tileset configuration
// Moved from: rpc.go
func (s *TilesetService) Update(r *http.Request, args *json.RawMessage, reply *map[string]interface{}) error {
	result, err := s.handler.handleTilesetUpdate(r.Context(), *args)
	if err != nil {
		return err
	}
	if result != nil {
		*reply = result.(map[string]interface{})
	}
	return nil
}
