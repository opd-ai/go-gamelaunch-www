# Roadmap

## Replace Existing Web UI with Ebitengine WASM

Remove the current HTML5/CSS3/JavaScript frontend and JSON-RPC polling layer entirely. Rebuild the user-facing interface as an [Ebitengine](https://ebitengine.org/) application compiled to WebAssembly so the game rendering, input handling, and tileset display all run inside a single WASM binary in the browser.

### Why

- **Unified rendering** – Ebitengine provides a proven 2D game engine written in Go. Compiling to WASM lets us share code between server-side logic and the client, eliminating the separate JavaScript layer.
- **Better input handling** – Ebitengine's built-in keyboard/mouse/gamepad support replaces the custom JavaScript key-event bridge and JSON-RPC input path.
- **Consistent tileset pipeline** – Tileset loading and tile-to-screen mapping can be done directly in Go with Ebitengine's image APIs, removing the need to serve tileset images over HTTP and decode them in the browser.
- **Simpler client deployment** – The browser-side deliverable becomes a static `index.html` plus a `.wasm` file, with no dependency on Gorilla RPC, long-polling, or embedded HTML assets. A Go server is still required for SSH connectivity to dgamelaunch servers.

### Scope

| Remove | Add |
|---|---|
| `pkg/webui/` embedded HTML/JS/CSS assets | Ebitengine `ebiten.Game` implementation compiled with `GOOS=js GOARCH=wasm` |
| Gorilla JSON-RPC server and polling endpoints | WebSocket (or equivalent) transport between browser WASM client and Go server |
| Custom JavaScript terminal renderer | Ebitengine-based tile renderer using `ebiten.Image` |
| HTTP tileset image serving | In-WASM tileset loading from bundled assets |
