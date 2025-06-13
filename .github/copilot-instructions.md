# Project Overview

go-gamelaunch-www is a web-based interface for playing terminal-based roguelike games remotely. It consumes the go-gamelaunch-client library to provide SSH connectivity to dgamelaunch-style servers, but presents games through a modern web interface with tileset graphics instead of raw terminal output. The project targets both end-users who want an accessible browser-based gaming experience and system administrators who need to deploy roguelike game servers with modern web frontends.

The web interface transforms ASCII terminal output into rich visual experiences using configurable tilesets, supporting games like NetHack, Dungeon Crawl Stone Soup, and other terminal-based roguelikes. It provides real-time game state synchronization, responsive input handling, and customizable graphics while maintaining full compatibility with traditional dgamelaunch servers.

## Technical Stack

- **Primary Language**: Go 1.23.2
- **Core Dependencies**:
  - github.com/opd-ai/go-gamelaunch-client (SSH client library)
  - github.com/gorilla/rpc v1.2.1 (JSON-RPC server)
  - github.com/fatih/color v1.18.0 (terminal color processing)
- **Image Processing**: Go standard library (image/png, image/jpeg, image/gif)
- **Web Technologies**: Embedded HTML5/CSS3/JavaScript frontend with WebSocket-like polling
- **Configuration**: YAML-based tileset and server configuration
- **Testing**: Go built-in testing package

## Code Assistance Guidelines

1. **WebView Integration**: When implementing new view features, extend the [`WebView`](pkg/webui/view.go) struct which implements the go-gamelaunch-client [`View`](https://pkg.go.dev/github.com/opd-ai/go-gamelaunch-client/pkg/dgclient#View) interface. Focus on terminal-to-web state conversion and real-time browser updates via the state management system.

2. **Tileset Configuration**: Follow the established pattern in [`tileset.go`](pkg/webui/tileset.go) for tileset management. Use YAML configuration with proper validation, support multiple image formats (PNG, JPEG, GIF), and implement character-to-tile mappings with color overrides and special tile support.

3. **JSON-RPC API**: Extend the RPC interface in [`rpc.go`](pkg/webui/rpc.go) following the established patterns. Use Gorilla RPC for proper JSON-RPC 2.0 compliance, implement long-polling for real-time updates, and ensure proper error handling with standard JSON-RPC error codes.

4. **State Management**: Utilize the state management system for efficient client-server synchronization. Implement change detection and differential updates to minimize bandwidth usage. Handle version management and provide graceful degradation for network issues.

5. **Web Asset Handling**: Follow the embedded asset pattern using Go's `embed` directive. Support both embedded assets for distribution and filesystem overrides for development. Implement proper CORS headers and caching strategies for static assets.

6. **Color Processing**: Leverage the `fatih/color` library integration in the color converter for ANSI escape sequence processing. Convert terminal colors to web-compatible hex values and support both 16-color and 256-color terminal modes.

7. **Error Handling**: Implement comprehensive error handling with proper HTTP status codes for web endpoints and JSON-RPC error responses. Provide meaningful error messages for both API consumers and end users, with graceful degradation for connection issues.

## Project Context

- **Domain**: Web-based roguelike gaming interface with focus on tileset rendering and modern browser compatibility. Key concepts include terminal-to-web conversion, real-time state synchronization, and visual game presentation through configurable tilesets.

- **Architecture**: Web application that consumes the go-gamelaunch-client library to provide SSH connectivity while presenting games through a browser-based interface. The [`WebView`](pkg/webui/view.go) implements the go-gamelaunch-client [`View`](https://pkg.go.dev/github.com/opd-ai/go-gamelaunch-client/pkg/dgclient#View) interface to bridge terminal output to web presentation.

- **Key Directories**: 
  - [`pkg/webui/`](pkg/webui/) - Core web interface components including view, RPC handler, and state management
  - [`pkg/webui/tileset.go`](pkg/webui/tileset.go) - Tileset configuration and image processing
  - [`pkg/webui/view.go`](pkg/webui/view.go) - WebView implementation of dgclient.View interface
  - [`pkg/webui/rpc.go`](pkg/webui/rpc.go) - JSON-RPC API for client-server communication
  - [`pkg/webui/webui.go`](pkg/webui/webui.go) - HTTP server and static asset handling

- **Configuration**: YAML-based tileset configuration with support for character-to-tile mappings, color overrides, and special tile definitions. Web server configuration through WebUIOptions including CORS settings and static file serving.

## Quality Standards

- **Testing Requirements**: Maintain comprehensive test coverage using Go's built-in testing package. Write unit tests for all public interfaces and integration tests for web functionality. Include table-driven tests for tileset configuration validation and terminal-to-web conversion functions.

- **Code Review Criteria**: Ensure proper error handling with wrapped errors, resource cleanup (especially HTTP connections and goroutines), and adherence to Go formatting standards. Validate that new features include appropriate documentation and examples. Follow web security best practices including CORS handling and input validation.

- **Documentation Standards**: Update README.md for user-facing changes, maintain godoc comments for all public functions, and include usage examples in code comments. Keep tileset configuration schema documentation current with any struct changes. Document WebUI API endpoints and their expected parameters.