# webui
--
    import "github.com/opd-ai/go-gamelaunch-client/pkg/webui"


## Usage

```go
const (
	ParseError     = -32700
	InvalidRequest = -32600
	MethodNotFound = -32601
	InvalidParams  = -32602
	InternalError  = -32603
)
```
Standard JSON-RPC error codes

#### func  Color256

```go
func Color256(u uint8) *color.Color
```
Color256 converts a 256-color index to a hex color string

#### func  CreateWebView

```go
func CreateWebView(opts dgclient.ViewOptions) (dgclient.View, error)
```
CreateWebView creates a new WebView that implements dgclient.View

#### func  SaveTilesetConfig

```go
func SaveTilesetConfig(tileset *TilesetConfig, path string) error
```
SaveTilesetConfig saves a tileset configuration to a YAML file

#### type Cell

```go
type Cell struct {
	Char    rune   `json:"char"`
	FgColor string `json:"fg_color"`
	BgColor string `json:"bg_color"`
	Bold    bool   `json:"bold"`
	Inverse bool   `json:"inverse"`
	Blink   bool   `json:"blink"`
	TileX   int    `json:"tile_x,omitempty"`
	TileY   int    `json:"tile_y,omitempty"`
	Changed bool   `json:"-"`
}
```

Cell represents a single character cell with rendering attributes

#### type CellDiff

```go
type CellDiff struct {
	X    int  `json:"x"`
	Y    int  `json:"y"`
	Cell Cell `json:"cell"`
}
```

CellDiff represents a change to a specific cell

#### type ColorConverter

```go
type ColorConverter struct{}
```

ColorConverter handles ANSI color parsing and conversion using fatih/color
library

#### func  NewColorConverter

```go
func NewColorConverter() *ColorConverter
```
NewColorConverter creates a new color converter with ANSI256 profile
NewColorConverter creates a new color converter

#### func (*ColorConverter) ProcessSGRParams

```go
func (cc *ColorConverter) ProcessSGRParams(params []string) (fgColor, bgColor string, bold, inverse, blink bool)
```
ProcessSGRParams processes SGR (Select Graphic Rendition) parameters Returns
foreground color, background color, and text attributes

#### type Empty

```go
type Empty struct{}
```


#### type GameInputParams

```go
type GameInputParams struct {
	Events []InputEvent `json:"events"`
}
```


#### type GamePollParams

```go
type GamePollParams struct {
	Version uint64 `json:"version"`
	Timeout int    `json:"timeout,omitempty"`
}
```

Parameter types for RPC methods

#### type GameService

```go
type GameService struct {
}
```

Service structs for Gorilla RPC

#### func (*GameService) GetState

```go
func (s *GameService) GetState(r *http.Request, args *Empty, reply *map[string]interface{}) error
```
Game service methods

#### func (*GameService) Poll

```go
func (s *GameService) Poll(r *http.Request, args *GamePollParams, reply *map[string]interface{}) error
```

#### func (*GameService) SendInput

```go
func (s *GameService) SendInput(r *http.Request, args *GameInputParams, reply *map[string]interface{}) error
```

#### type GameState

```go
type GameState struct {
	Buffer    [][]Cell `json:"buffer"`
	Width     int      `json:"width"`
	Height    int      `json:"height"`
	CursorX   int      `json:"cursor_x"`
	CursorY   int      `json:"cursor_y"`
	Version   uint64   `json:"version"`
	Timestamp int64    `json:"timestamp"`
}
```

GameState represents the current state of the game screen

#### type InputEvent

```go
type InputEvent struct {
	Type      string `json:"type"`
	Key       string `json:"key,omitempty"`
	KeyCode   int    `json:"keyCode,omitempty"`
	Data      string `json:"data,omitempty"`
	Timestamp int64  `json:"timestamp"`
}
```


#### type RPCError

```go
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
```


#### type RPCHandler

```go
type RPCHandler struct {
}
```

RPCHandler maintains compatibility with existing code

#### func  NewRPCHandler

```go
func NewRPCHandler(webui *WebUI) *RPCHandler
```
NewRPCHandler creates a new RPC handler with Gorilla RPC integration

#### func (*RPCHandler) GetRPCServer

```go
func (h *RPCHandler) GetRPCServer() *rpc.Server
```
GetRPCServer returns the underlying Gorilla RPC server for HTTP integration

#### func (*RPCHandler) HandleRequest

```go
func (h *RPCHandler) HandleRequest(ctx context.Context, req *RPCRequest) *RPCResponse
```
HandleRequest preserves the original signature for compatibility

#### type RPCRequest

```go
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id"`
}
```

Legacy types preserved for compatibility

#### type RPCResponse

```go
type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}
```


#### type SessionService

```go
type SessionService struct {
}
```


#### func (*SessionService) Info

```go
func (s *SessionService) Info(r *http.Request, args *Empty, reply *map[string]interface{}) error
```
Session service methods

#### type SpecialTile

```go
type SpecialTile struct {
	ID    string    `yaml:"id"`
	Tiles []TileRef `yaml:"tiles"`
}
```

SpecialTile represents multi-tile entities

#### type StateDiff

```go
type StateDiff struct {
	Version   uint64     `json:"version"`
	Changes   []CellDiff `json:"changes"`
	CursorX   int        `json:"cursor_x"`
	CursorY   int        `json:"cursor_y"`
	Timestamp int64      `json:"timestamp"`
}
```

StateDiff represents changes between game states

#### type StateManager

```go
type StateManager struct {
}
```

StateManager manages game state versions and change tracking

#### func  NewStateManager

```go
func NewStateManager() *StateManager
```
NewStateManager creates a new state manager

#### func (*StateManager) GetCurrentState

```go
func (sm *StateManager) GetCurrentState() *GameState
```
GetCurrentState returns the current state

#### func (*StateManager) GetCurrentVersion

```go
func (sm *StateManager) GetCurrentVersion() uint64
```
GetCurrentVersion returns the current version number

#### func (*StateManager) PollChanges

```go
func (sm *StateManager) PollChanges(clientVersion uint64, timeout time.Duration) (*StateDiff, error)
```
FIXED: Use unique waiter keys to prevent race conditions between concurrent
clients

#### func (*StateManager) PollChangesWithContext

```go
func (sm *StateManager) PollChangesWithContext(pollCtx context.Context, version uint64) (*StateDiff, error)
```
PollChangesWithContext waits for changes with a context It is a context-aware
version of PollChanges

#### func (*StateManager) UpdateState

```go
func (sm *StateManager) UpdateState(state *GameState)
```
UpdateState updates the current state and notifies waiters

#### type TileMapping

```go
type TileMapping struct {
	Char    string `yaml:"char"`
	X       int    `yaml:"x"`
	Y       int    `yaml:"y"`
	FgColor string `yaml:"fg_color,omitempty"`
	BgColor string `yaml:"bg_color,omitempty"`
}
```

TileMapping maps characters to tile coordinates

#### type TileRef

```go
type TileRef struct {
	X int `yaml:"x"`
	Y int `yaml:"y"`
}
```

TileRef references a specific tile

#### type TilesetConfig

```go
type TilesetConfig struct {
	Name         string        `yaml:"name"`
	Version      string        `yaml:"version"`
	TileWidth    int           `yaml:"tile_width"`
	TileHeight   int           `yaml:"tile_height"`
	SourceImage  string        `yaml:"source_image"`
	Mappings     []TileMapping `yaml:"mappings"`
	SpecialTiles []SpecialTile `yaml:"special_tiles"`
}
```

TilesetConfig represents a tileset configuration

#### func  DefaultTilesetConfig

```go
func DefaultTilesetConfig() *TilesetConfig
```
DefaultTilesetConfig returns a basic ASCII tileset configuration

#### func  LoadTilesetConfig

```go
func LoadTilesetConfig(path string) (*TilesetConfig, error)
```
LoadTilesetConfig loads a tileset from a YAML file

#### func (*TilesetConfig) Clone

```go
func (tc *TilesetConfig) Clone() *TilesetConfig
```
Clone creates a deep copy of the tileset configuration

#### func (*TilesetConfig) GetImageData

```go
func (tc *TilesetConfig) GetImageData() image.Image
```
GetImageData returns the loaded image data

#### func (*TilesetConfig) GetMapping

```go
func (tc *TilesetConfig) GetMapping(char rune) *TileMapping
```
GetMapping returns the tile mapping for a character

#### func (*TilesetConfig) GetTileCount

```go
func (tc *TilesetConfig) GetTileCount() (int, int)
```
GetTileCount returns the number of tiles in the tileset

#### func (*TilesetConfig) ToJSON

```go
func (tc *TilesetConfig) ToJSON() map[string]interface{}
```
ToJSON returns a JSON representation for client-side use

#### type TilesetService

```go
type TilesetService struct {
}
```


#### func (*TilesetService) Fetch

```go
func (s *TilesetService) Fetch(r *http.Request, args *Empty, reply *map[string]interface{}) error
```
Tileset service methods

#### func (*TilesetService) Update

```go
func (s *TilesetService) Update(r *http.Request, args *json.RawMessage, reply *map[string]interface{}) error
```

#### type WebUI

```go
type WebUI struct {
}
```

WebUI provides a web-based interface for dgclient

#### func  NewWebUI

```go
func NewWebUI(opts WebUIOptions) (*WebUI, error)
```
NewWebUI creates a new WebUI instance

#### func (*WebUI) GetTileset

```go
func (w *WebUI) GetTileset() *TilesetConfig
```
GetTileset returns the current tileset configuration

#### func (*WebUI) GetView

```go
func (w *WebUI) GetView() *WebView
```
GetView returns the current view

#### func (*WebUI) ServeHTTP

```go
func (w *WebUI) ServeHTTP(rw http.ResponseWriter, r *http.Request)
```
ServeHTTP implements http.Handler

#### func (*WebUI) SetView

```go
func (w *WebUI) SetView(view *WebView)
```
SetView sets the view for the WebUI

#### func (*WebUI) Start

```go
func (w *WebUI) Start(addr string) error
```
Start starts the WebUI server

#### func (*WebUI) StartWithContext

```go
func (w *WebUI) StartWithContext(ctx context.Context, addr string) error
```
StartWithContext starts the WebUI server with context for graceful shutdown

#### func (*WebUI) UpdateTileset

```go
func (w *WebUI) UpdateTileset(tileset *TilesetConfig) error
```
UpdateTileset updates the tileset configuration

#### type WebUIOptions

```go
type WebUIOptions struct {
	// View to use for rendering
	View *WebView

	// Tileset configuration
	TilesetPath string
	Tileset     *TilesetConfig

	// Server configuration
	ListenAddr  string
	PollTimeout time.Duration

	// CORS settings
	AllowOrigins []string

	// Static file serving
	StaticPath string // Optional: override embedded files
}
```

WebUIOptions contains configuration for WebUI

#### type WebView

```go
type WebView struct {
}
```

WebView implements dgclient.View for web browser rendering

#### func  NewWebView

```go
func NewWebView(opts dgclient.ViewOptions) (*WebView, error)
```
NewWebView creates a new web-based view

#### func (*WebView) Clear

```go
func (v *WebView) Clear() error
```
Clear clears the display

#### func (*WebView) Close

```go
func (v *WebView) Close() error
```
Close cleans up resources

#### func (*WebView) GetCurrentState

```go
func (v *WebView) GetCurrentState() *GameState
```
GetCurrentState returns the current game state

#### func (*WebView) GetSize

```go
func (v *WebView) GetSize() (int, int)
```
GetSize returns current dimensions

#### func (*WebView) GetStateManager

```go
func (v *WebView) GetStateManager() *StateManager
```
GetStateManager returns the state manager for this view

#### func (*WebView) HandleInput

```go
func (v *WebView) HandleInput() ([]byte, error)
```
HandleInput reads and returns user input

#### func (*WebView) Init

```go
func (v *WebView) Init() error
```
Init initializes the web view

#### func (*WebView) Render

```go
func (v *WebView) Render(data []byte) error
```
Render processes terminal data and updates the screen buffer

#### func (*WebView) SendInput

```go
func (v *WebView) SendInput(data []byte)
```
SendInput queues input from web client

#### func (*WebView) SetSize

```go
func (v *WebView) SetSize(width, height int) error
```
SetSize updates the view dimensions

#### func (*WebView) SetTileset

```go
func (v *WebView) SetTileset(tileset *TilesetConfig)
```
SetTileset updates the tileset configuration

#### func (*WebView) WaitForUpdate

```go
func (v *WebView) WaitForUpdate(timeout time.Duration) bool
```
WaitForUpdate waits for the next screen update
