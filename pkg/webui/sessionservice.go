// Package webui provides SessionService implementation for session-related RPC methods.
// Moved from: rpc.go
package webui

import "net/http"

// SessionService provides session-related RPC methods
// Moved from: rpc.go
type SessionService struct {
	handler *RPCHandler
}

// Info retrieves session information
// Moved from: rpc.go
func (s *SessionService) Info(r *http.Request, args *Empty, reply *map[string]interface{}) error {
	result, err := s.handler.handleSessionInfo(r.Context(), nil)
	if err != nil {
		return err
	}
	*reply = result.(map[string]interface{})
	return nil
}
