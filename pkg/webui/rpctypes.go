// Package webui provides JSON-RPC request and response data types.
// Moved from: types.go (originally from rpc.go)
package webui

import "encoding/json"

// RPCRequest represents a JSON-RPC request
// Legacy types preserved for compatibility
// Moved from: rpc.go via types.go
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id"`
}

// RPCResponse represents a JSON-RPC response
// Moved from: rpc.go via types.go
type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

// RPCError represents a JSON-RPC error
// Moved from: rpc.go via types.go
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
