# webui

A web-based interface package for dgamelaunch-style terminal games with real-time rendering, tileset support, and browser-based terminal emulation.

---

## Installation

```bash
go get github.com/opd-ai/go-gamelaunch-client/pkg/webui
```

---

## Features

### Core Web Interface
- **Browser-Based Terminal Emulation** - Full terminal rendering in web browsers using HTML5 Canvas with WebGL acceleration
- **Real-Time Game Updates** - Efficient state synchronization with diff-based polling and minimal bandwidth usage
- **JSON-RPC 2.0 API** - Standard RPC communication protocol for game state management and user input handling
- **Embedded Static Assets** - Self-contained web server with embedded HTML, CSS, and JavaScript resources
- **CORS Support** - Configurable cross-origin resource sharing for flexible deployment scenarios

### Terminal Display Features
- **ANSI Color Processing** - Complete 256-color palette support with true color RGB rendering
- **Text Attribute Rendering** - Bold, inverse, blinking, and underlined text display
- **Cursor Management** - Real-time cursor position tracking with visibility control
- **Screen Buffer Management** - Efficient memory usage with incremental screen updates
- **Terminal Resize Handling** - Dynamic viewport adjustment with proper aspect ratio maintenance

### Tileset and Graphics Support
- **YAML-Based Tileset Configuration** - Flexible tile mapping system with character-to-sprite associations
- **Multi-Format Image Support** - PNG, JPEG, and GIF tileset source images
- **Dynamic Tileset Loading** - Runtime tileset switching without server restart
- **Sprite Caching System** - Optimized tile rendering with memory-efficient caching
- **Special Tile Handling** - Multi-tile entities and animated sprite support

### Input Management
- **Comprehensive Keyboard Support** - Full keyboard event capture including special keys and modifiers
- **Mouse Event Processing** - Click and movement event handling for interactive gameplay
- **Input Event Buffering** - Efficient batching of user inputs to reduce network overhead
- **Focus Management** - Proper keyboard focus handling for seamless gameplay experience

### Connection and State Management
- **WebView Integration** - Implements dgclient.View interface for seamless integration with SSH client
- **State Version Tracking** - Monotonic versioning system for reliable state synchronization
- **Change Detection** - Efficient diff algorithms to minimize data transfer
- **Concurrent Client Support** - Multiple browser sessions with independent state management
- **Connection Status Monitoring** - Real-time connection health indicators and error reporting

### Performance Optimizations
- **Incremental Rendering** - Only updates changed screen regions for optimal performance
- **Viewport Management** - Smart scrolling and clipping for large terminal buffers
- **Memory Management** - Efficient buffer allocation with automatic garbage collection
- **Network Optimization** - Compressed state diffs and smart polling intervals

### Error Handling and Recovery
- **Graceful Degradation** - Fallback rendering modes for limited browser capabilities
- **Connection Recovery** - Automatic reconnection with exponential backoff
- **Client-Side Error Reporting** - Comprehensive error logging and user feedback
- **Resource Cleanup** - Proper resource management and memory leak prevention

### Accessibility Features
- **Screen Reader Support** - ARIA labels and semantic markup for assistive technologies
- **Keyboard Navigation** - Full keyboard accessibility without mouse dependency
- **High Contrast Support** - Configurable color schemes for visual accessibility
- **Responsive Design** - Mobile-friendly interface with touch input support

### Developer Features
- **Modular Architecture** - Cleanly separated concerns with well-defined interfaces
- **Configuration Flexibility** - Extensive customization options for deployment scenarios
- **Debug Support** - Built-in debugging tools and verbose logging capabilities
- **API Documentation** - Comprehensive JSON-RPC method documentation
- **Testing Infrastructure** - Mock implementations and test utilities for development

---

## Architecture

The webui package implements a layered architecture designed for scalability and maintainability:

**View Layer**: WebView implements the dgclient.View interface, providing seamless integration with SSH terminal sessions while managing screen buffer state and terminal emulation.

**Server Layer**: WebUI provides HTTP server functionality with JSON-RPC endpoints, static file serving, and WebSocket-like long polling for real-time communication.

**Client Layer**: Browser-based JavaScript frontend handles canvas rendering, input event management, and RPC communication with automatic reconnection and error recovery.

**State Management**: Centralized state tracking with version control enables efficient synchronization between server terminal state and multiple connected browser clients.

The package integrates seamlessly with the dgclient library's SSH connectivity while providing a modern web-based interface for traditional terminal games, bridging classic roguelike gaming with contemporary web technologies.