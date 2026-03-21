# Implementation Gaps — 2026-03-21

## Frontend/Backend API Contract Broken

- **Stated Goal**: "Browser-Based Terminal Emulation — Full terminal rendering in web browsers with real-time updates" (README); users can open the web interface and play games in a browser.
- **Current State**: The embedded JavaScript frontend (`pkg/webui/static/services/game-client.js:36-41`) calls RPC methods `GameClient.Connect`, `GameClient.GetState`, `GameClient.SendInput`, `GameClient.Resize`, and `GameClient.Ping`. The Go server's `HandleRequest` switch (`pkg/webui/rpc.go:53-115`) routes only `game.getState`, `game.sendInput`, `game.poll`, `tileset.fetch`, `tileset.update`, and `session.info`. Every method call from the frontend returns a JSON-RPC `-32601 MethodNotFound` error. No game state is ever delivered to the browser and no input is ever accepted.
- **Impact**: The core product claim — playing roguelike games in a web browser — is completely non-functional. A user launching the binary and opening `http://localhost:8080` will see the UI shell load but every connection attempt will silently fail with RPC errors. This affects 100% of end users.
- **Closing the Gap**: Update `game-client.js` to use the server's method vocabulary: replace `GameClient.Connect` with a `session.info` call for initial handshake, `GameClient.GetState` with `game.getState`, `GameClient.SendInput` with `game.sendInput`, and replace the polling interval with a call to `game.poll` (passing the last known `version`). Alternatively, add server-side handlers for the frontend's method names as aliases pointing to the existing handler functions. The former approach is preferred since it removes the mismatch at the source.

---

## Gorilla RPC Infrastructure Is Dead Code

- **Stated Goal**: "JSON-RPC 2.0 API — Standard RPC communication for game state management" (README); the `gorilla/rpc` dependency is listed as a core dependency.
- **Current State**: `NewRPCHandler` instantiates a `gorilla/rpc` server, registers three service objects (`GameService`, `TilesetService`, `SessionService`), and stores the server in `handler.rpcServer`. `GetRPCServer()` exists to expose it. However, `GetRPCServer()` is never called anywhere, and `webui.go` never wires the Gorilla server into the HTTP mux. All actual request routing is done by a manual `switch` in `HandleRequest` (`pkg/webui/rpc.go:44-120`). The Gorilla services run no requests, the `gorilla/rpc` import is an unused (archived, unmaintained) dependency.
- **Impact**: Unnecessary build dependency on an archived library. Any future contributor adding Gorilla-style service methods will see them silently ignored. The ROADMAP explicitly plans to remove `gorilla/rpc`.
- **Closing the Gap**: Remove the Gorilla RPC initialization block from `NewRPCHandler` (lines 26–37), delete the `gorilla/rpc` import and the `github.com/gorilla/rpc` entry from `go.mod`/`go.sum`. The manual switch-based dispatch already handles all methods correctly and should be retained until the WebSocket migration completes.

---

## Ebitengine WASM Client Has No Deployment Path

- **Stated Goal**: ROADMAP: "Remove the current HTML5/CSS3/JavaScript frontend… Rebuild the user-facing interface as an Ebitengine application compiled to WebAssembly." PLAN.md Step 3: deliverable is a WASM binary; Step 7: deliverable is `static/index.html` + `wasm_exec.js` + a static file server.
- **Current State**: `pkg/wasm/` contains the Ebitengine game loop, renderer, input handler, scene interface, and a WASM-conditional transport. The package compiles successfully with `GOOS=js GOARCH=wasm go build ./pkg/wasm`. However: (a) there is no `func main()` or `cmd/` entry point for the WASM binary — `go build` produces nothing because there is no package `main` to link; (b) there is no `static/index.html` page to load the WASM; (c) there is no `wasm_exec.js` runtime; (d) the `pkg/wasm/transport_js.go` WebSocket transport targets `/ws` or a URL to be configured, but the server exposes no WebSocket endpoint.
- **Impact**: The WASM migration — the project's primary ROADMAP objective — cannot be tested end-to-end. No user can run the Ebitengine client.
- **Closing the Gap**: (1) Create `cmd/gamelaunch-wasm/main.go` as a `package main` with `func main() { ebiten.RunGame(wasm.NewGame(wasm.DefaultGameConfig())) }`. (2) Copy `$(go env GOROOT)/lib/wasm/wasm_exec.js` to `static/`. (3) Create `static/index.html` that loads `wasm_exec.js` and `gamelaunch.wasm`. (4) Register a `/ws` WebSocket endpoint in `webui.go:setupRoutes` using `pkg/transport`. (5) Wire state updates from `WebView.Render` to the transport's broadcast channel.

---

## WebSocket Transport Package Is Disconnected

- **Stated Goal**: ROADMAP: "WebSocket (or equivalent) transport between browser WASM client and Go server." PLAN.md Step 5: "Server-side WebSocket handler replacing JSON-RPC."
- **Current State**: `pkg/transport/websocket.go` contains a complete `Handler` with ping/pong keepalive, client management, broadcast, and per-client write pumps. It defines `MsgTypeState`, `MsgTypeStateDiff`, `MsgTypeInput`, etc. The `pkg/wasm/transport_js.go` WASM client implements `Transport` using the browser's `WebSocket` API. However, `webui.go:setupRoutes` registers only `/rpc` and `/tileset/image` — no `/ws` endpoint. Neither `WebView` nor `StateManager` publish state updates to the transport's broadcast channel.
- **Impact**: The Ebitengine WASM client has no live data feed. Even if a WASM binary and host page were deployed, the client would connect to a non-existent WebSocket endpoint, fail immediately, and display a blank screen. Real-time state synchronization for the new architecture is unavailable.
- **Closing the Gap**: In `webui.go`, add a `wsHandler *transport.Handler` field. In `NewWebUI`, call `transport.NewHandler()` and store it. In `setupRoutes`, register `w.mux.HandleFunc("/ws", w.wsHandler.ServeHTTP)`. In `WebView.Render` (after `stateManager.UpdateState`), marshal the new `GameState` and call `w.wsHandler.Broadcast(marshaledState)`.

---

## `tileset.update` RPC Method Non-Functional

- **Stated Goal**: README: `Tileset.Fetch` is listed as an implemented API method. `tileset.update` is routed in `HandleRequest`, implying it is an available method. The project's tileset hot-reload feature depends on dynamic updates.
- **Current State**: `handleTilesetUpdate` (`pkg/webui/rpc.go:388-390`) unconditionally returns `fmt.Errorf("tileset updates not yet implemented")`. `createTilesetFromConfig` (`pkg/webui/tilesetservice.go:671`) also returns an error immediately. The `TilesetService.Update` method has partial logic (`pkg/webui/tilesetservice.go:163-224`) but cannot reach its tileset-rebuild step because `createTilesetFromConfig` blocks it.
- **Impact**: Dynamic tileset switching at runtime is impossible. Administrators who want to push a new tileset to connected clients without a server restart cannot do so.
- **Closing the Gap**: Implement `createTilesetFromConfig` by marshaling the input `map[string]interface{}` to YAML bytes and unmarshaling into a `TilesetConfig`, then calling `tc.validate()` and `tc.loadImage()`. Once this is functional, remove the stub in `handleTilesetUpdate` and wire it to call `TilesetService.Update`.

---

## Hot-Reload Monitoring Never Activates

- **Stated Goal**: `pkg/webui/README.md` lists "Real-Time Tileset Hot Reload." `StartHotReload` is a defined method that polls watched paths every 2 seconds for changes.
- **Current State**: `WebUI.StartWithContext` calls `getTilesetService()` to obtain a reference to the tileset service; if non-nil, it starts `StartHotReload` in a goroutine. `getTilesetService()` is hardcoded to return `nil` (`pkg/webui/webui.go:432`: `return nil // Simplified for now`). The `TilesetService` instance is created inside `NewRPCHandler` but no reference is stored on `WebUI`. Hot-reload monitoring never starts regardless of deployment configuration.
- **Impact**: The hot-reload feature is entirely inert. No tileset file change will ever be detected or applied while the server is running.
- **Closing the Gap**: Add field `tilesetSvc *TilesetService` to `WebUI`. In `NewWebUI`, after `NewRPCHandler(webui)`, assign `webui.tilesetSvc = webui.rpcHandler.tilesetService` (expose `tilesetService` from `RPCHandler`). Update `getTilesetService()` to return `w.tilesetSvc`.

---

## `processImage` Silently Discards Processing Results

- **Stated Goal**: `TilesetService.ProcessImage` RPC endpoint advertises image optimization (color quantization, contrast adjustment, sharpening, transparency removal).
- **Current State**: `processImage` (`pkg/webui/tilesetservice.go:353-392`) creates a local `*image.RGBA`, applies all transformations to it, but never assigns the result back to the `TilesetConfig`. The comment at line 387 acknowledges: "This is a simplified approach — in reality, we'd need to properly update the TilesetConfig." After calling `ProcessImage`, the tileset's image data is unchanged.
- **Impact**: Any operator using the `ProcessImage` RPC endpoint to optimize tileset graphics for bandwidth or display quality will receive a success response but see no change in the served tileset image.
- **Closing the Gap**: Expose a `SetImageData(img image.Image)` method on `TilesetConfig` (or assign directly to the `imageData` field if within-package). Call it at the end of `processImage` before returning. Alternatively, return the processed `*image.RGBA` and let the caller decide what to do with it.

---

## WebGL Claim Not Backed by Implementation

- **Stated Goal**: `pkg/webui/README.md:18`: "Full terminal rendering in web browsers using HTML5 Canvas with WebGL acceleration."
- **Current State**: The frontend (`game-display.js:91-101`) uses a standard `HTMLCanvasElement` with Canvas 2D rendering context. No `getContext("webgl")` or `getContext("webgl2")` calls exist anywhere in the JavaScript codebase. No WebGL shaders, buffers, or GPU pipelines are implemented.
- **Impact**: Users expecting hardware-accelerated rendering (relevant for large tile grids or high-frequency updates) receive software-rasterized Canvas 2D rendering instead. The claim may mislead users comparing this project against alternatives.
- **Closing the Gap**: Either implement WebGL rendering in `game-display.js` (using WebGL 2D sprite batching for tile rendering), or update `pkg/webui/README.md:18` to remove the WebGL claim and accurately describe Canvas 2D rendering.

---

## `pkg/wasm` Test Suite Broken in Headless Environments

- **Stated Goal**: PLAN.md Step 3 acceptance criterion: WASM build succeeds; basic game loop runs. Quality standards require comprehensive test coverage.
- **Current State**: Ebitengine initializes GLFW at package `init()` time, which requires an X11 display or GPU. Running `go test ./pkg/wasm/...` in any headless CI environment (no `$DISPLAY`) panics immediately: `glfw: X11: The DISPLAY environment variable is missing`. The `pkg/wasm` tests cannot be run outside a graphical environment.
- **Impact**: Any CI pipeline (GitHub Actions, containers) fails. Contributors cannot run the full test suite locally without a display server. The testing quality standard cannot be met for this package.
- **Closing the Gap**: Separate pure-logic tests (buffer manipulation, state application, input mapping) from Ebitengine-dependent tests. Add `//go:build !headless` (or similar) to tests that require a display. Add a `Makefile` target `test-headless` using `go test -tags headless ./...` that excludes those tests. Add the tag to the CI workflow.
