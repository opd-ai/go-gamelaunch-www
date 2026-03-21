# go-gamelaunch-www

A modern web-based interface for playing terminal-based roguelike games remotely. This project transforms ASCII terminal output into rich visual experiences using configurable tilesets, supporting games like NetHack, Dungeon Crawl Stone Soup, and other terminal-based roguelikes through a browser-based interface.

## Features

- **Ebitengine WASM Client** - Native-speed browser rendering via WebAssembly; no plugin required
- **WebSocket Transport** - Real-time bidirectional communication replacing JSON-RPC polling
- **Browser-Based Terminal Emulation** - Full terminal rendering in web browsers with real-time updates
- **Tileset Graphics Support** - Configurable YAML-based tileset system with PNG/JPEG/GIF support
- **SSH Integration** - Seamless connectivity to dgamelaunch-style servers via go-gamelaunch-client
- **Real-Time Synchronization** - Efficient state management with differential updates
- **CORS Support** - Configurable cross-origin resource sharing for flexible deployment

## Installation

```bash
go get github.com/opd-ai/go-gamelaunch-www
```

### Requirements

- Go 1.23.2 or later
- Compatible dgamelaunch server (for SSH connectivity)

## Quick Start

```go
package main

import (
    "context"
    "log"
    
    "github.com/opd-ai/go-gamelaunch-www/pkg/webui"
    "github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

func main() {
    // Create a WebView
    view, err := webui.NewWebView(dgclient.ViewOptions{
        Width:  80,
        Height: 24,
    })
    if err != nil {
        log.Fatal(err)
    }

    // Create WebUI with configuration
    webUI, err := webui.NewWebUI(webui.WebUIOptions{
        View:        view,
        ListenAddr:  ":8080",
        TilesetPath: "tileset.yaml", // Optional
    })
    if err != nil {
        log.Fatal(err)
    }

    // Start the web server
    log.Println("Starting web server on :8080")
    if err := webUI.Start(":8080"); err != nil {
        log.Fatal(err)
    }
}
```

## WASM Deployment (Recommended)

The recommended deployment uses the Ebitengine WebAssembly client:

### 1. Build the WASM binary

```bash
make wasm
# Produces static/gamelaunch.wasm and static/wasm_exec.js
```

### 2. Serve the game server with WebSocket support

```go
package main

import (
    "log"
    "github.com/opd-ai/go-gamelaunch-www/pkg/webui"
    "github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

func main() {
    view, err := webui.NewWebView(dgclient.ViewOptions{Width: 80, Height: 24})
    if err != nil {
        log.Fatal(err)
    }
    ui, err := webui.NewWebUI(webui.WebUIOptions{
        View:       view,
        StaticPath: "static", // serve the WASM build artifacts
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Fatal(ui.Start(":8080"))
}
```

The WASM client connects to the `/ws` WebSocket endpoint for real-time game state updates.

> **Migrating from JSON-RPC?** See [docs/MIGRATION.md](docs/MIGRATION.md).

## Tileset Configuration

Create a `tileset.yaml` file to configure graphics:

```yaml
name: "My Tileset"
version: "1.0"
tile_width: 16
tile_height: 16
source_image: "tiles.png"
mappings:
  - char: "@"
    x: 0
    y: 0
  - char: "#"
    x: 1
    y: 0
```

## API Endpoints

### JSON-RPC Methods

- `game.getState` - Retrieve current game state
- `game.poll` - Long-poll for state changes
- `game.sendInput` - Send user input to game
- `game.resize` - Resize the terminal window
- `game.disconnect` - Disconnect from the game session
- `session.info` - Get session information
- `tileset.fetch` - Retrieve tileset configuration
- `tileset.update` - Update the active tileset

### HTTP Endpoints

- `GET /` - Main web interface
- `POST /rpc` - JSON-RPC API endpoint
- `GET /tileset/image` - Tileset image serving

## Architecture

The project uses a layered architecture:

- **WASM Client Layer** (`pkg/wasm`) - Ebitengine game loop running in the browser via WebAssembly
- **WebSocket Transport** (`pkg/transport`) - Real-time bidirectional server↔client communication
- **Static Server** (`pkg/server`) - Minimal file server for WASM deployment artifacts
- **WebView Layer** (`pkg/webui`) - Implements dgclient.View interface for terminal-to-web conversion
- **State Management** - Version-controlled state synchronization with change detection
- **Tileset System** - YAML-configured graphics with runtime image processing

## Dependencies

- [go-gamelaunch-client](https://github.com/opd-ai/go-gamelaunch-client) - SSH client library
- [ebiten/v2](https://github.com/hajimehoshi/ebiten) - Ebitengine 2D game engine (WASM client)
- [nhooyr.io/websocket](https://github.com/nhooyr/websocket) - WebSocket server/client
- [fatih/color](https://github.com/fatih/color) - Terminal color processing
- [gopkg.in/yaml.v3](https://gopkg.in/yaml.v3) - YAML configuration

## Documentation

For detailed API documentation and advanced usage, see the [webui package documentation](pkg/webui/README.md).

## License

[Add your license information here]
