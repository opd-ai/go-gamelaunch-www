# Implementation Plan: Ebitengine WASM Migration

## Project Context
- **What it does**: A modern web-based interface for playing terminal-based roguelike games remotely, transforming ASCII terminal output into rich visual experiences using configurable tilesets.
- **Current goal**: Replace the HTML5/CSS3/JavaScript frontend and JSON-RPC polling layer with an Ebitengine WASM application.
- **Estimated Scope**: Large

## Goal-Achievement Status
| Stated Goal | Current Status | This Plan Addresses |
|-------------|---------------|---------------------|
| Replace Web UI with Ebitengine WASM | ❌ Not started | Yes |
| Fix color processing critical bugs | ⚠️ Known issues (AUDIT.md) | Yes (prerequisite) |
| Improve code quality (reduce complexity) | ⚠️ 27 functions above threshold | Partially |
| Eliminate code duplication | ⚠️ 0.95% duplication ratio | Partially |
| Complete documentation coverage | ✅ 87.2% overall coverage | No (maintenance) |

## Metrics Summary
- **Complexity hotspots on goal-critical paths**: 27 functions above threshold (complexity > 9.0)
  - Color processing: `colorToHex` (13.2), `ProcessSGRParams` (12.4), `rgbToHex` (10.1)
  - Terminal processing: `processTerminalData` (17.6), `handleCSISequence` (15.7), `writeCharacter` (12.4)
  - State management: `generateDiff` (15.0), `notifyWaiters` (12.9)
  - Tileset processing: `validate` (28.8), `loadImage` (17.1)
- **Duplication ratio**: 0.95% (2 clone pairs, 42 duplicated lines)
  - `pkg/webui/statemanager.go:83-106` ↔ `pkg/webui/statemanager.go:143-165` (24 lines)
  - `pkg/webui/tilesetservice.go:402-419` ↔ `pkg/webui/tilesetservice.go:459-476` (18 lines)
- **Doc coverage**: 87.2% overall (functions: 87.5%, types: 83.8%, methods: 90.2%)
- **Package coupling**: `webui` depends on `gorilla/rpc`, `fatih/color`, `go-gamelaunch-client`

## Research Findings

### Ebitengine WASM Best Practices (2025)
- Use Go 1.21+ for optimal WASM binary size and performance
- Build with `GOOS=js GOARCH=wasm go build -o game.wasm`
- Implement `Scene` interface pattern for game state management
- Use `embed` directive for bundling assets (not `os.Open`)
- Handle browser audio autoplay restrictions (require user gesture)
- Test with `wasmserve` during development

### Gorilla/RPC Alternatives
- `gorilla/rpc` is no longer actively maintained
- Recommended replacement: WebSocket-based communication for real-time game state
- `nhooyr.io/websocket` or `gorilla/websocket` for Go WebSocket servers
- WASM client can use JavaScript WebSocket API via `syscall/js`

## Implementation Steps

### ~~Step 1: Fix Critical Color Processing Bugs~~ ✅ COMPLETED
- **Deliverable**: Refactored `pkg/webui/colorconverter.go` with correct 256-color and RGB handling
- **Dependencies**: None
- **Goal Impact**: Prerequisite for accurate tileset rendering in new WASM client
- **Acceptance**: All color conversion tests pass; `colorToHex` complexity reduced below 10.0
- **Validation**: 
  ```bash
  go test ./pkg/webui -run Color -v
  go-stats-generator analyze ./pkg/webui --skip-tests --format json 2>/dev/null | jq '[.functions[] | select(.name == "colorToHex") | .complexity.overall]'
  ```

### ~~Step 2: Consolidate Duplicated State Management Code~~ ✅ COMPLETED
- **Deliverable**: Extract shared logic from `pkg/webui/statemanager.go` lines 83-106 and 143-165 into a helper function
- **Dependencies**: None
- **Goal Impact**: Cleaner codebase for WASM migration; reduced maintenance burden
- **Acceptance**: Duplication ratio drops to <0.5%; no regression in state management tests
- **Validation**: 
  ```bash
  go test ./pkg/webui -run State -v
  go-stats-generator analyze ./pkg/webui --skip-tests --format json 2>/dev/null | jq '.duplication.duplication_ratio'
  ```

### ~~Step 3: Create Ebitengine Game Interface~~ ✅ COMPLETED
- **Deliverable**: New package `pkg/wasm/` with `ebiten.Game` implementation
  - `pkg/wasm/game.go` - Main game loop implementing `Update()`, `Draw()`, `Layout()`
  - `pkg/wasm/scene.go` - Scene interface and state machine
  - `pkg/wasm/input.go` - Keyboard/mouse input handling
- **Dependencies**: Step 1 (color processing must work correctly)
- **Goal Impact**: Core Ebitengine game structure for browser rendering
- **Acceptance**: `GOOS=js GOARCH=wasm go build ./pkg/wasm` succeeds; basic game loop runs in browser
- **Validation**: 
  ```bash
  GOOS=js GOARCH=wasm go build -o /tmp/test.wasm ./pkg/wasm
  test -f /tmp/test.wasm && echo "WASM build succeeded"
  ```

### ~~Step 4: Implement Tileset Renderer in Ebitengine~~ ✅ COMPLETED
- **Deliverable**: 
  - `pkg/wasm/tileset.go` - Load and render tilesets using `ebiten.Image`
  - `pkg/wasm/renderer.go` - Terminal-to-tile rendering logic
- **Dependencies**: Step 3 (game interface must exist)
- **Goal Impact**: Visual game rendering in browser without HTTP tileset serving
- **Acceptance**: Can render a 80x24 terminal screen with tileset graphics; uses embedded assets
- **Validation**: 
  ```bash
  go test ./pkg/wasm -run Tileset -v
  go test ./pkg/wasm -run Renderer -v
  ```

### ~~Step 5: Implement WebSocket Transport~~ ✅ COMPLETED
- **Deliverable**: 
  - `pkg/transport/websocket.go` - Server-side WebSocket handler replacing JSON-RPC
  - `pkg/wasm/transport.go` - WASM client WebSocket connection via `syscall/js`
- **Dependencies**: Step 3 (game interface must exist)
- **Goal Impact**: Real-time bidirectional communication replacing long-polling
- **Acceptance**: Game state updates flow from server to WASM client; input flows back
- **Validation**: 
  ```bash
  go test ./pkg/transport -run WebSocket -v
  ```

### ~~Step 6: Integrate Terminal Data Processing~~ ✅ COMPLETED
- **Deliverable**: Port terminal processing logic to WASM-compatible format
  - Refactor `processTerminalData` (complexity 17.6) for use in WASM client
  - Move color conversion to WASM client side
- **Dependencies**: Steps 1, 4, 5
- **Goal Impact**: Complete terminal-to-visual pipeline in WASM
- **Acceptance**: `processTerminalData` complexity reduced below 12.0; WASM renders terminal output correctly
- **Validation**: 
  ```bash
  go-stats-generator analyze ./pkg/wasm --skip-tests --format json 2>/dev/null | jq '[.functions[] | select(.name | contains("Terminal")) | {name: .name, complexity: .complexity.overall}]'
  ```

### ~~Step 7: Create Minimal Static Host~~ ✅ COMPLETED
- **Deliverable**: 
  - `static/index.html` - Minimal HTML to load WASM
  - `static/wasm_exec.js` - Go WASM runtime (from `$(go env GOROOT)/lib/wasm/`)
  - `pkg/server/static.go` - Simple file server for WASM deployment
- **Dependencies**: Steps 3, 4, 5, 6
- **Goal Impact**: Deployable browser-based game client
- **Acceptance**: Browser loads WASM, connects to server, renders game
- **Validation**: 
  ```bash
  curl -s http://localhost:8080/ | grep -q "wasm_exec.js" && echo "Static host serves WASM"
  ```

### ~~Step 8: Deprecate Legacy Web UI~~ ✅ COMPLETED
- **Deliverable**: 
  - Add deprecation notices to `pkg/webui/rpc.go`, embedded HTML/JS/CSS
  - Update README.md with new WASM deployment instructions
  - Create migration guide in `docs/MIGRATION.md`
- **Dependencies**: Steps 3-7 (new system must be functional)
- **Goal Impact**: Clear transition path for users; legacy code marked for removal
- **Acceptance**: Documentation updated; deprecation warnings logged when legacy endpoints used
- **Validation**: 
  ```bash
  grep -l "DEPRECATED" pkg/webui/*.go | wc -l  # Should find deprecated files
  test -f docs/MIGRATION.md && echo "Migration guide exists"
  ```

### Step 9: Remove Legacy Code (Do immediately after completing WASM client)
- **Deliverable**: Remove after migration period
  - `pkg/webui/rpc.go` - Gorilla JSON-RPC handler
  - `pkg/webui/static/` - Embedded HTML/JS/CSS assets
  - `pkg/webui/webui.go` - HTTP server components (retain WebSocket server)
- **Dependencies**: Step 8 complete; user feedback period
- **Goal Impact**: Complete ROADMAP objective; simpler codebase
- **Acceptance**: `go list ./...` shows no `gorilla/rpc` imports; codebase compiles
- **Validation**: 
  ```bash
  go mod tidy
  go build ./...
  grep -r "gorilla/rpc" --include="*.go" && echo "FAIL: gorilla/rpc still imported" || echo "PASS: No gorilla/rpc imports"
  ```

## Validation Commands Summary

```bash
# Full test suite
go test ./... -v

# Complexity check for all packages
go-stats-generator analyze . --skip-tests --format json 2>/dev/null | jq '[.functions[] | select(.complexity.overall > 9.0) | {name: .name, complexity: .complexity.overall}] | length'

# Duplication ratio
go-stats-generator analyze . --skip-tests --format json 2>/dev/null | jq '.duplication.duplication_ratio'

# WASM build verification
GOOS=js GOARCH=wasm go build -o /tmp/gamelaunch.wasm ./pkg/wasm

# Documentation coverage
go-stats-generator analyze . --skip-tests --format json 2>/dev/null | jq '.documentation.coverage.overall'
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ebitengine WASM binary size | Medium | Use build flags: `-ldflags="-s -w"`, consider TinyGo if needed |
| Browser compatibility | Medium | Test on Chrome, Firefox, Safari; use feature detection |
| SSH connectivity in WASM | High | SSH must remain server-side; only UI moves to WASM |
| Color accuracy after migration | High | Comprehensive visual regression tests; fix bugs in Step 1 first |
| User migration friction | Medium | Parallel deployment period; clear documentation |

## Notes

- The `gorilla/rpc` dependency will be replaced by WebSocket communication, addressing the library's deprecated status
- Color processing bugs identified in AUDIT.md must be fixed before WASM migration to ensure visual accuracy
- The project's cohesion score (1.64 for webui) suggests good internal consistency; architecture changes should preserve this
- Package coupling to `fatih/color` may be reduced since color conversion will happen client-side in WASM
