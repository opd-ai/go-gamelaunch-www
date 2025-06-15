# JavaScript Coding Instructions for go-gamelaunch-www

## Project Context

This file contains JavaScript-specific coding guidelines for the go-gamelaunch-www web frontend. The project provides a web-based interface for terminal-based roguelike games, transforming ASCII terminal output into rich visual experiences using configurable tilesets.

## Core Frontend Architecture

- **Communication**: JSON-RPC 2.0 API with long-polling for real-time updates
- **Rendering**: Canvas-based tileset rendering with HTML5 Canvas API
- **State Management**: Client-side state synchronization with server-side game state
- **Input Handling**: Keyboard event capture and translation to terminal input sequences
- **Asset Loading**: Dynamic tileset image loading with proper error handling

## JavaScript Implementation Guidelines

### 1. WebSocket-like Polling Implementation

```javascript
// Implement long-polling for real-time game state updates
class GameStatePoller {
    constructor(rpcUrl, pollInterval = 100) {
        this.rpcUrl = rpcUrl;
        this.pollInterval = pollInterval;
        this.running = false;
        this.lastVersion = 0;
    }
    
    async startPolling() {
        this.running = true;
        while (this.running) {
            try {
                const response = await this.fetchGameState();
                if (response.version > this.lastVersion) {
                    this.onStateUpdate(response);
                    this.lastVersion = response.version;
                }
                await this.sleep(this.pollInterval);
            } catch (error) {
                this.onError(error);
                await this.sleep(this.pollInterval * 2); // Backoff on error
            }
        }
    }
}
```

### 2. Canvas-Based Tileset Rendering

```javascript
// Implement efficient tileset rendering with proper tile mapping
class TilesetRenderer {
    constructor(canvasElement, tilesetConfig) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.tileset = null;
        this.tileWidth = tilesetConfig.tileWidth;
        this.tileHeight = tilesetConfig.tileHeight;
        this.charMap = tilesetConfig.charMap;
    }
    
    async loadTileset(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.tileset = img;
                resolve();
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    }
    
    renderTile(char, x, y, fgColor = '#ffffff', bgColor = '#000000') {
        const tileIndex = this.charMap[char] || this.charMap[' '];
        const srcX = (tileIndex % this.tilesPerRow) * this.tileWidth;
        const srcY = Math.floor(tileIndex / this.tilesPerRow) * this.tileHeight;
        
        // Render background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight);
        
        // Render tile with color overlay
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(
            this.tileset,
            srcX, srcY, this.tileWidth, this.tileHeight,
            x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight
        );
        
        // Apply foreground color if needed
        if (fgColor !== '#ffffff') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = fgColor;
            this.ctx.fillRect(x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight);
        }
    }
}
```

### 3. JSON-RPC Client Implementation

```javascript
// Implement JSON-RPC 2.0 client with proper error handling
class JSONRPCClient {
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.requestId = 0;
    }
    
    async call(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: ++this.requestId
        };
        
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);
            }
            
            return data.result;
        } catch (error) {
            console.error('JSON-RPC call failed:', error);
            throw error;
        }
    }
}
```

### 4. Terminal Input Handling

```javascript
// Handle keyboard input and translate to terminal sequences
class TerminalInputHandler {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.keyMap = {
            'ArrowUp': '\x1b[A',
            'ArrowDown': '\x1b[B',
            'ArrowRight': '\x1b[C',
            'ArrowLeft': '\x1b[D',
            'Enter': '\r',
            'Escape': '\x1b',
            'Backspace': '\x08',
            'Tab': '\t'
        };
    }
    
    handleKeyDown(event) {
        event.preventDefault();
        
        let input;
        if (this.keyMap[event.key]) {
            input = this.keyMap[event.key];
        } else if (event.key.length === 1) {
            input = event.key;
        } else {
            return; // Ignore unknown keys
        }
        
        // Handle modifier keys
        if (event.ctrlKey && event.key.length === 1) {
            const code = event.key.toLowerCase().charCodeAt(0) - 96;
            input = String.fromCharCode(code);
        }
        
        this.gameClient.sendInput(input);
    }
}
```

## Code Quality Standards

### Error Handling
- Always use try-catch blocks for async operations
- Implement exponential backoff for network retries
- Provide meaningful error messages to users
- Log errors for debugging while avoiding sensitive data exposure

### Performance Optimization
- Use requestAnimationFrame for smooth rendering
- Implement efficient canvas dirty region updates
- Cache tileset images and reuse canvas contexts
- Debounce input events to prevent spam

### Memory Management
- Clean up event listeners on component destruction
- Dispose of large objects (images, canvases) when no longer needed
- Use WeakMap/WeakSet for object references where appropriate
- Monitor and prevent memory leaks in long-running applications

### Browser Compatibility
- Support modern browsers (ES2017+)
- Use feature detection for optional APIs
- Provide fallbacks for canvas rendering issues
- Test across different screen resolutions and DPI settings

## Integration with Go Backend

### State Synchronization
- Poll for game state changes using version numbers
- Handle partial updates to minimize bandwidth
- Implement client-side prediction for input responsiveness
- Gracefully handle server disconnections and reconnections

### Configuration Loading
- Load tileset configurations from server endpoints
- Support hot-reloading of tileset changes during development
- Validate configuration data before use
- Provide sensible defaults for missing configuration values

### Asset Management
- Load tileset images from configurable URLs
- Support multiple image formats (PNG, JPEG, GIF)
- Implement proper caching strategies
- Handle missing or corrupted image assets gracefully

## Testing Guidelines

- Write unit tests for core rendering and input handling logic
- Mock JSON-RPC responses for integration testing
- Test canvas rendering with different tileset configurations
- Validate input handling across different keyboard layouts
- Performance test with large terminal screens and frequent updates

## Documentation Requirements

- Document all public class methods with JSDoc comments
- Include usage examples for complex components
- Maintain README sections for JavaScript build/deployment
- Keep API documentation synchronized with Go backend changes
