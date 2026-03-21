# Migration Guide: JSON-RPC → Ebitengine WASM Client

## Overview

The original `pkg/webui` JSON-RPC polling interface has been superseded by:

- **`pkg/wasm`** — Ebitengine-based WebAssembly game client
- **`pkg/transport`** — WebSocket server replacing long-polling
- **`pkg/server`** — Minimal static file server for WASM deployment

This guide explains how to migrate from the legacy polling stack to the new WASM stack.

---

## Legacy Architecture (deprecated)

```
Browser  ←HTTP long-poll→  /rpc (pkg/webui/rpc.go)  →  WebView  →  SSH/dgamelaunch
```

The browser polled `/rpc` (JSON-RPC) for state diffs. Static HTML/JS/CSS were embedded in the `pkg/webui/static/` directory.

---

## New Architecture

```
Browser (WASM/Ebitengine)  ←WebSocket→  /ws (pkg/transport)  →  WebView  →  SSH/dgamelaunch
```

The browser loads a WebAssembly binary compiled from `pkg/wasm` via `cmd/gamelaunch-wasm`. State updates flow over a persistent WebSocket connection, eliminating polling latency.

---

## Migration Steps

### 1. Build the WASM binary

```bash
make wasm
# Produces: static/gamelaunch.wasm, static/wasm_exec.js
```

### 2. Deploy the static files

Use the new `pkg/server` package instead of relying on the WebUI's embedded assets:

```go
package main

import (
    "log"
    "github.com/opd-ai/go-gamelaunch-www/pkg/server"
)

func main() {
    s := server.New(server.Config{
        Addr:      ":8080",
        StaticDir: "static", // contains index.html, wasm_exec.js, gamelaunch.wasm
    })
    if err := s.Start(); err != nil {
        log.Fatal(err)
    }
}
```

Or, if you want the WebSocket game backend alongside static file serving, continue to use `pkg/webui.WebUI`, which already exposes `/ws` via `pkg/transport.Handler`. The WASM client connects to that endpoint automatically.

### 3. WebSocket game backend

The `WebUI` struct in `pkg/webui` now registers a `/ws` WebSocket endpoint (via `pkg/transport.Handler`) automatically. No change is needed to your server setup code.

```go
webui, err := webui.NewWebUI(webui.WebUIOptions{
    View:       view,
    ListenAddr: ":8080",
})
// /ws is now available for the WASM client
```

### 4. Remove legacy JSON-RPC client code

If you have custom JavaScript that calls `/rpc`, replace it with the WASM binary:

| Old (JavaScript polling) | New (WASM + WebSocket) |
|--------------------------|------------------------|
| `POST /rpc` (game.getState) | WebSocket `/ws` push |
| `POST /rpc` (game.poll) | WebSocket `/ws` push |
| `POST /rpc` (game.sendInput) | WebSocket `/ws` send |

---

## Removal Timeline

The following will be removed in a future release:

- `pkg/webui/rpc.go` — JSON-RPC handler
- `pkg/webui/static/` — Legacy embedded HTML/JS/CSS
- `pkg/webui/webui.go` HTTP static-file routes (the `/rpc` endpoint)

The `WebSocket`, `WebView`, `StateManager`, `TilesetConfig`, and `TilesetService` types in `pkg/webui` will be retained.

---

## Frequently Asked Questions

**Q: Do I need to change my server setup?**  
A: No. `WebUI.Start()` already exposes `/ws`. Just build the WASM binary with `make wasm` and serve `static/` to browsers.

**Q: Can I run the old and new UIs side-by-side?**  
A: Yes. The `/rpc` endpoint remains functional until removed. You can serve both during a transition period.

**Q: What about SSH connectivity?**  
A: SSH remains server-side. Only the browser UI has moved to WASM.
