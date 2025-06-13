# go-gamelaunch-www

A modern web-based interface for playing terminal-based roguelike games remotely. This project transforms ASCII terminal output into rich visual experiences using configurable tilesets, supporting games like NetHack, Dungeon Crawl Stone Soup, and other terminal-based roguelikes through a browser-based interface.

## Features

- **Browser-Based Terminal Emulation** - Full terminal rendering in web browsers with real-time updates
- **Tileset Graphics Support** - Configurable YAML-based tileset system with PNG/JPEG/GIF support
- **JSON-RPC 2.0 API** - Standard RPC communication for game state management and input handling
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

- `Game.GetState` - Retrieve current game state
- `Game.Poll` - Long-poll for state changes
- `Game.SendInput` - Send user input to game
- `Session.Info` - Get session information
- `Tileset.Fetch` - Retrieve tileset configuration

### HTTP Endpoints

- `GET /` - Main web interface
- `POST /rpc` - JSON-RPC API endpoint
- `GET /tileset/image` - Tileset image serving

## Architecture

The project uses a layered architecture:

- **WebView Layer** - Implements dgclient.View interface for terminal-to-web conversion
- **WebUI Layer** - HTTP server with embedded static assets and JSON-RPC endpoints
- **State Management** - Version-controlled state synchronization with change detection
- **Tileset System** - YAML-configured graphics with runtime image processing

## Dependencies

- [go-gamelaunch-client](https://github.com/opd-ai/go-gamelaunch-client) - SSH client library
- [gorilla/rpc](https://github.com/gorilla/rpc) - JSON-RPC server
- [fatih/color](https://github.com/fatih/color) - Terminal color processing
- [gopkg.in/yaml.v3](https://gopkg.in/yaml.v3) - YAML configuration

## Documentation

For detailed API documentation and advanced usage, see the [webui package documentation](pkg/webui/README.md).

## License

[Add your license information here]
