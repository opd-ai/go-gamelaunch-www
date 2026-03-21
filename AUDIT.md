# AUDIT — 2026-03-21

## Project Goals

`go-gamelaunch-www` presents itself as a modern web-based interface for playing terminal-based roguelike games remotely. It targets two audiences:

1. **End-users** — players wanting a browser-based gaming experience with tileset graphics for games like NetHack and Dungeon Crawl Stone Soup.
2. **System administrators** — operators deploying roguelike game servers with a modern web frontend.

### Stated Capabilities (from README + pkg/webui/README)

| # | Claimed Feature |
|---|-----------------|
| 1 | Browser-Based Terminal Emulation with real-time updates |
| 2 | Tileset Graphics Support (PNG/JPEG/GIF, YAML config) |
| 3 | JSON-RPC 2.0 API (`Game.GetState`, `Game.Poll`, `Game.SendInput`, `Session.Info`, `Tileset.Fetch`) |
| 4 | SSH Integration via go-gamelaunch-client |
| 5 | Real-Time Synchronization with differential updates |
| 6 | Configurable CORS support |
| 7 | HTML5 Canvas with WebGL acceleration (pkg/webui/README) |
| 8 | Complete 256-color palette + RGB true-color support |
| 9 | Hot-reload tileset monitoring |
| 10 | Ebitengine WASM migration (ROADMAP) |
| 11 | WebSocket transport to replace JSON-RPC polling (ROADMAP) |
| 12 | `Tileset.Fetch` HTTP endpoint (`GET /tileset/image`) |
| 13 | `tileset.update` RPC method |

---

## Goal-Achievement Summary

| Goal | Status | Evidence |
|------|--------|----------|
| Browser-Based Terminal Emulation | ⚠️ Partial | Terminal pipeline implemented (`pkg/webui/webview.go`), but frontend cannot reach server — see Finding #1 |
| Tileset Graphics Support | ✅ Achieved | `pkg/webui/tilesetconfig.go`: `LoadTilesetConfig`, `GetMapping`, PNG/JPEG/GIF via `loadImage` |
| JSON-RPC 2.0 API | ⚠️ Partial | Server handles `game.getState`/`game.sendInput`/`game.poll`/`tileset.fetch`/`session.info`; `tileset.update` returns error |
| SSH Integration | ✅ Achieved | `cmd/dgconnect-www/commands.go`: `runConnect` uses `go-gamelaunch-client` |
| Real-Time Synchronization (diff-based) | ✅ Achieved | `pkg/webui/statemanager.go`: `generateDiff`, `PollChangesWithContext` |
| Configurable CORS | ✅ Achieved | `pkg/webui/webui.go`: `addCORSHeaders`, `WebUIOptions.AllowOrigins` |
| WebGL Acceleration | ❌ Missing | Canvas 2D is used; no WebGL code exists in the codebase |
| 256-color + RGB true-color | ✅ Achieved | `pkg/webui/colorconverter.go`: `color256ToHex`, `rgbToHex`, full SGR handling |
| Hot-reload tileset monitoring | ⚠️ Partial | `StartHotReload` ticker exists; `getTilesetService()` returns `nil` — hot-reload never starts |
| Ebitengine WASM (`pkg/wasm`) | ⚠️ Partial | Package compiles to WASM; no entry-point `main`, no host page, no integration with server |
| WebSocket transport (`pkg/transport`) | ⚠️ Partial | `pkg/transport/websocket.go` implemented; no HTTP endpoint registered in `pkg/webui/webui.go` |
| `GET /tileset/image` endpoint | ✅ Achieved | `pkg/webui/webui.go:handleTilesetImage` |
| `tileset.update` RPC method | ❌ Missing | `pkg/webui/rpc.go:390`: `return nil, fmt.Errorf("tileset updates not yet implemented")` |

---

## Findings

### CRITICAL

- [ ] **Frontend/Backend API Contract Mismatch** — `pkg/webui/static/services/game-client.js:36-41` vs `pkg/webui/rpc.go:53-115` — The embedded JavaScript frontend calls RPC methods `GameClient.Connect`, `GameClient.Disconnect`, `GameClient.GetState`, `GameClient.SendInput`, `GameClient.Resize`, and `GameClient.Ping`. The Go server routes only `game.getState`, `game.sendInput`, `game.poll`, `tileset.fetch`, `tileset.update`, and `session.info`. None of the six methods the frontend calls are handled by the server; all will receive a JSON-RPC `MethodNotFound` error. The web interface is non-functional for all users. — **Remediation:** Align method names in one direction. The simplest fix is to update `game-client.js` to use the server's method names: replace `GameClient.Connect` with `session.info` (for initial state), `GameClient.GetState` with `game.getState`, `GameClient.SendInput` with `game.sendInput`, and `GameClient.Ping` with `session.info`. A long-poll loop against `game.poll` should replace the `GET_STATE` interval poll. Validate with: `curl -s -X POST http://localhost:8080/rpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"game.getState","id":1}' | jq .`

- [ ] **`gorilla/rpc` Server Initialized but Never Used** — `pkg/webui/rpc.go:21-40` — `NewRPCHandler` creates a Gorilla RPC server (`rpc.NewServer()`), registers three services (`GameService`, `TilesetService`, `SessionService`), and stores it in `handler.rpcServer`. `GetRPCServer()` is defined to expose it, but is never called anywhere in the codebase. All requests are routed through a manual `switch` in `HandleRequest`. The Gorilla RPC server and its registered services are dead code. The `gorilla/rpc` import adds a build-time dependency that is known to be unmaintained (archived) while providing zero runtime value. — **Remediation:** Either (a) delete the Gorilla RPC initialization block (lines 26–37 of `rpc.go`) and remove the `gorilla/rpc` import and `go.mod` entry, keeping only the manual switch, or (b) wire `GetRPCServer()` into the HTTP mux as the `/rpc` handler and delete the manual switch. Option (a) is consistent with the ROADMAP's intent to remove Gorilla RPC. Validate with: `go build ./... && grep -r "gorilla/rpc" --include="*.go" .`

### HIGH

- [ ] **`pkg/wasm` Tests Panic at Init Due to GLFW/X11 Dependency** — `pkg/wasm/game.go` (Ebitengine import) — Running `go test ./...` causes `pkg/wasm` to panic: `glfw: X11: The DISPLAY environment variable is missing`. Ebitengine initializes a platform display at package `init()` time, even in test builds. This makes CI and headless environments unable to run the wasm package's tests, breaking the CI test suite. — **Remediation:** Add a build constraint to `renderer_test.go`, `tileset_test.go`, and any test file importing `ebiten` to exclude them from non-WASM/non-GUI builds (e.g., `//go:build !ci`), or restructure rendering logic so the non-Ebitengine portions can be unit-tested without a GPU context. Validate with: `go test ./pkg/wasm/... 2>&1 | grep -v FAIL`

- [ ] **Hot-Reload Never Starts: `getTilesetService()` Returns nil** — `pkg/webui/webui.go:432` — `StartWithContext` calls `getTilesetService()` to launch hot-reload monitoring. The method is hardcoded to return `nil`, so the hot-reload goroutine is never started regardless of configuration. The `TilesetService` is instantiated inside `NewRPCHandler` but no reference is retained on `WebUI`. — **Remediation:** Add a `tilesetService *TilesetService` field to `WebUI`. Assign it in `NewRPCHandler` (or `NewWebUI`), and return it from `getTilesetService()`. Validate with: `go test ./pkg/webui -run TestHotReload -v` (after adding a test).

- [ ] **`tileset.update` RPC Method Always Returns Error** — `pkg/webui/rpc.go:388-390` — The method is routed and acknowledged in the `HandleRequest` switch, but its handler unconditionally returns `fmt.Errorf("tileset updates not yet implemented")`. Any client call to `tileset.update` receives an `InternalError` response, making dynamic tileset switching non-functional. — **Remediation:** Implement the handler by forwarding to `TilesetService.Update`, which already has a partial implementation at `pkg/webui/tilesetservice.go:163`. Wire the tileset update result back to `webui.UpdateTileset`. Validate with: `go test ./pkg/webui -run TestTilesetUpdate -v`

- [ ] **`processImage` Discards Result: Tileset Not Updated** — `pkg/webui/tilesetservice.go:387` — The `processImage` method applies color optimization, contrast adjustment, sharpening, and transparency removal to a local `*image.RGBA` copy, but never writes the processed image back to the `TilesetConfig`. The comment at line 387 acknowledges this: "This is a simplified approach — in reality, we'd need to properly update the TilesetConfig." Any call to `TilesetService.ProcessImage` returns `nil` error but silently discards all applied transformations. — **Remediation:** After the processing loop, call `tileset.imageData = processedImg` (or expose a `SetImageData` setter on `TilesetConfig`) before returning. Validate with: `go test ./pkg/webui -run TestProcessImage -v`

- [ ] **High Cyclomatic Complexity on Critical Paths** — `pkg/webui/tilesetconfig.go:125` (`validate`, complexity 28.8), `pkg/webui/statemanager.go` (`generateDiff`, 15.0; `notifyWaiters`, 12.9), `pkg/webui/rpc.go:79` (`handleGamePoll`, 12.7) — These functions exceed the project's own stated threshold of complexity > 9.0 (from PLAN.md) and carry the highest bug risk. `validate` at 88 lines and cyclomatic 21 is particularly difficult to reason about. — **Remediation:** Extract sub-validators from `validate` (one per field group: dimensions, mappings, image path). Extract `waitForChange` and `broadcastDiff` from `notifyWaiters`. Measure improvement with: `go-stats-generator analyze ./pkg/webui --skip-tests --format json | jq '[.functions[] | select(.complexity.overall > 12) | {name, complexity: .complexity.overall}]'`

### MEDIUM

- [ ] **README Documents Wrong RPC Method Names (Case/Format)** — `README.md:89-93` — The README lists API methods as `Game.GetState`, `Game.Poll`, `Game.SendInput`, `Session.Info`, `Tileset.Fetch` (PascalCase dot-notation). The server actually routes `game.getState`, `game.poll`, `game.sendInput`, `session.info`, `tileset.fetch` (camelCase). Third-party integrators using the documented names will receive `MethodNotFound` errors. — **Remediation:** Update `README.md` lines 89–93 to use the exact method strings handled in `pkg/webui/rpc.go:53–115`.

- [ ] **WebGL Claim in pkg/webui/README Is False** — `pkg/webui/README.md:18` — States "Full terminal rendering in web browsers using HTML5 Canvas with WebGL acceleration." The frontend uses Canvas 2D only (`game-display.js:91–101`); no WebGL context is created anywhere. — **Remediation:** Replace "with WebGL acceleration" with "using HTML5 Canvas 2D rendering" in `pkg/webui/README.md:18`.

- [ ] **pkg/wasm Has No WASM Entry Point** — `pkg/wasm/` — The ROADMAP requires a deployable WASM binary (`GOOS=js GOARCH=wasm go build`), but there is no `main()` function or `cmd/` entry point for the WASM package. Building `./pkg/wasm` produces a library, not an executable. The ROADMAP step 7 static host (`static/index.html` + `wasm_exec.js`) does not exist. — **Remediation:** Create `cmd/gamelaunch-wasm/main.go` with a `func main()` that calls `ebiten.RunGame(wasm.NewGame(...))` and registers it for WASM. Create `static/index.html` and copy `$(go env GOROOT)/lib/wasm/wasm_exec.js`. Validate with: `GOOS=js GOARCH=wasm go build -o gamelaunch.wasm ./cmd/gamelaunch-wasm && ls -lh gamelaunch.wasm`

- [ ] **`pkg/transport` WebSocket Handler Not Exposed** — `pkg/transport/websocket.go` — The transport package implements a full WebSocket server (`Handler`) but no HTTP route registers it. `pkg/webui/webui.go:setupRoutes` only registers `/rpc` and `/tileset/image`. The WASM client's `WebSocketTransport` (`pkg/wasm/transport_js.go`) would connect to `/ws` or similar, which doesn't exist. — **Remediation:** In `setupRoutes`, add `w.mux.HandleFunc("/ws", transport.NewHandler(...).ServeHTTP)` and wire state updates from `WebView` into the transport's broadcast. Validate with: `curl -i -N -H "Upgrade: websocket" http://localhost:8080/ws`

- [ ] **Documentation Coverage Below 80% in Two Packages** — `go-stats-generator` output — `main` package (cmd): 0% doc coverage (0 of 3 files have package comments; `ValidateConfig` has 0 doc lines). `transport` package: 0% doc coverage. Overall project is at 77.7% vs. the 87.2% reported in PLAN.md (the earlier baseline included test files). — **Remediation:** Add `// Package main …` godoc to `cmd/dgconnect-www/main.go` and a package comment to `pkg/transport/websocket.go`. Add function-level doc comments to all exported symbols in these packages. Validate with: `go-stats-generator analyze . --skip-tests --format json | jq '.documentation.coverage.overall'`

- [ ] **Code Duplication in `pkg/wasm/input.go`** — `pkg/wasm/input.go:41-84` — `go-stats-generator` reports 10 clone pairs, 230 duplicated lines (4.01% ratio), with the largest cluster in `input.go` (3 instances of a 14-16 line block at lines 41-84). The blocks handle keyboard mapping for different input categories with near-identical structure. — **Remediation:** Extract a `mapKey(key ebiten.Key, mapping map[ebiten.Key]string) string` helper and replace the three repeated blocks. Validate with: `go-stats-generator analyze ./pkg/wasm --skip-tests --format json | jq '.duplication.duplication_ratio'`

- [ ] **Cache Hit/Miss Tracking Stubs** — `pkg/webui/tilesetservice.go:347-348` — `getCacheStatus()` returns hardcoded `0` for both `cache_hits` and `cache_misses` with TODO comments. Cache metrics are exposed via `Tileset.Fetch` response, so downstream clients receive perpetually zeroed telemetry. — **Remediation:** Add `cacheHits uint64` and `cacheMisses uint64` fields to `TilesetService`. Increment them in `getCachedImage` (hit) and `cacheProcessedImage` (miss). Use `sync/atomic` for thread-safety. Validate with: `go test ./pkg/webui -run TestCacheTracking -v`

### LOW

- [ ] **`pkg/webui/view.go` and `pkg/webui/tileset.go` Are Empty Stubs** — `pkg/webui/view.go`, `pkg/webui/tileset.go` — Both files contain only a package declaration and a comment saying code was "moved." They add no value and can confuse contributors navigating the package. — **Remediation:** Delete both files. Confirm nothing is lost: `go build ./pkg/webui/... && go test ./pkg/webui/...`

- [ ] **`createTilesetFromConfig` Returns Error Immediately** — `pkg/webui/tilesetservice.go:671` — `createTilesetFromConfig` unconditionally returns an error. It is called from `TilesetService.Update` when a config map is provided. Callers receive an opaque failure with no workaround. — **Remediation:** Implement basic deserialization of the `config map[string]interface{}` into a `TilesetConfig` using `yaml.Marshal` → `yaml.Unmarshal`, or add a `FromMap(*TilesetConfig, map[string]interface{}) error` method. Validate with: `go test ./pkg/webui -run TestCreateTilesetFromConfig -v`

- [ ] **Excessive `log.Printf` in Request-Critical Paths** — `pkg/webui/rpc.go`, `pkg/webui/webui.go` — Every RPC handler emits 5–10 `log.Printf` calls per request (including after every header write). In `handleRPC` alone there are 13 log statements. Under load, logging contention will become a bottleneck, and logs become noise that obscures real errors. — **Remediation:** Replace per-step logging with structured leveled logging using `log/slog` (stdlib, Go 1.21+). Emit one `DEBUG` log at entry and one at exit. Gate debug-level logs behind the `--debug` flag that already exists in `cmd/dgconnect-www/main.go`. Validate with: `go vet ./... && go build ./...`

---

## Metrics Snapshot

| Metric | Value |
|--------|-------|
| Total Lines of Code | 3,064 |
| Total Functions + Methods | 234 (46 funcs + 188 methods) |
| Total Packages | 4 |
| Average Function Complexity | 4.6 |
| High Complexity (>10) | 6 functions |
| Highest Complexity | `validate` — 28.8 (pkg/webui/tilesetconfig.go:125) |
| Documentation Coverage (overall) | 77.7% |
| Documentation Coverage (main pkg) | 0% |
| Documentation Coverage (transport pkg) | 0% |
| Duplication Ratio | 4.01% (10 clone pairs, 230 lines) |
| Circular Dependencies | None |
| Test Results | `transport` ✅, `webui` ✅, `wasm` ❌ (GLFW panic), `cmd` (no tests) |
| WASM Build (`GOOS=js GOARCH=wasm`) | ✅ Succeeds (`pkg/wasm` as library) |
| `go vet ./...` | ✅ Clean |
| Race Detector | ✅ Pass (transport + webui) |
