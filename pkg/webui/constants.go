// Package webui provides constants for the webui package.
// Moved from: rpc.go
package webui

// Standard JSON-RPC error codes
// These constants define the standard error codes used in JSON-RPC 2.0 protocol.
const (
	ParseError     = -32700 // Parse error occurred on the server
	InvalidRequest = -32600 // The JSON sent is not a valid Request object
	MethodNotFound = -32601 // The method does not exist / is not available
	InvalidParams  = -32602 // Invalid method parameter(s)
	InternalError  = -32603 // Internal JSON-RPC error
)
