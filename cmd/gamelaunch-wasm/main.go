//go:build js

// Package main is the WebAssembly entry point for go-gamelaunch-www.
// It initialises the Ebitengine game loop and connects to the JSON-RPC
// server over WebSocket at /ws for real-time terminal state updates.
package main

import (
	"github.com/opd-ai/go-gamelaunch-www/pkg/wasm"
)

func main() {
	cfg := wasm.DefaultGameConfig()
	g := wasm.NewGame(cfg)
	if err := g.Run(); err != nil {
		panic(err)
	}
}
