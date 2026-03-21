package webui

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"image/png"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	_ "embed"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
	"github.com/opd-ai/go-gamelaunch-www/pkg/transport"
)

// WebUIOptions contains configuration for WebUI
// Moved from: webui.go
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

// WebUI provides a web-based interface for dgclient
// Moved from: webui.go
type WebUI struct {
	view           *WebView
	tileset        *TilesetConfig
	rpcHandler     *RPCHandler
	tilesetService *TilesetService
	wsHandler      *transport.Handler
	mux            *http.ServeMux
	options        WebUIOptions
}

//go:embed static/index.html
var staticIndexHTML string

//go:embed static/*
var staticIndexJS embed.FS

//go:embed static/style.css
var staticIndexCSS string

// NewWebUI creates a new WebUI instance
func NewWebUI(opts WebUIOptions) (*WebUI, error) {
	// Validate required View parameter
	if opts.View == nil {
		return nil, fmt.Errorf("view is required in WebUIOptions")
	}

	// Set default PollTimeout if not specified
	if opts.PollTimeout == 0 {
		opts.PollTimeout = 30 * time.Second
	}

	webui := &WebUI{
		view:    opts.View,
		options: opts,
		mux:     http.NewServeMux(),
	}

	// Load tileset if specified
	if opts.Tileset != nil {
		webui.tileset = opts.Tileset
	} else if opts.TilesetPath != "" {
		tileset, err := LoadTilesetConfig(opts.TilesetPath)
		if err != nil {
			return nil, fmt.Errorf("failed to load tileset: %w", err)
		}
		webui.tileset = tileset
	}

	// Set tileset on view if available
	if webui.view != nil && webui.tileset != nil {
		webui.view.SetTileset(webui.tileset)
	}

	// Create RPC handler
	webui.rpcHandler = NewRPCHandler(webui)

	// Create tileset service for hot-reload support
	webui.tilesetService = NewTilesetService(webui.rpcHandler)

	// Create WebSocket handler
	webui.wsHandler = transport.NewHandler()

	// Set up routes
	webui.setupRoutes()

	return webui, nil
}

// setupRoutes configures HTTP routes
func (w *WebUI) setupRoutes() {
	// RPC endpoint
	w.mux.HandleFunc("/rpc", w.handleRPC)

	// Tileset image endpoint
	w.mux.HandleFunc("/tileset/image", w.handleTilesetImage)

	// WebSocket endpoint for real-time state updates
	w.mux.HandleFunc("/ws", w.wsHandler.ServeHTTP)

	// Static files
	if w.options.StaticPath != "" {
		// Serve from filesystem
		w.mux.Handle("/", http.FileServer(http.Dir(w.options.StaticPath)))
		// w.mux.Handle("/", http.StripPrefix("/static/", http.FileServer(http.Dir(w.options.StaticPath))))
	} else {
		// Serve embedded files
		w.mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, ".js") {
				rw.Header().Set("Content-Type", "application/javascript; charset=utf-8")
				data, err := staticIndexJS.ReadFile(filepath.Join("static", r.URL.Path))
				if err != nil {
					http.Error(rw, "Failed to read static file", http.StatusInternalServerError)
					return
				}
				rw.Write(data)
			} else {
				switch r.URL.Path {
				case "/":
					rw.Header().Set("Content-Type", "text/html; charset=utf-8")
					rw.Write([]byte(staticIndexHTML))
				case "/style.css":
					rw.Header().Set("Content-Type", "text/css; charset=utf-8")
					rw.Write([]byte(staticIndexCSS))
				case "/static/style.css":
					rw.Header().Set("Content-Type", "text/css; charset=utf-8")
					rw.Write([]byte(staticIndexCSS))
				default:
					rw.Header().Set("Content-Type", "text/html; charset=utf-8")
					rw.Write([]byte(staticIndexHTML))
				}
			}
		})
	}
}

// ServeHTTP implements http.Handler
func (w *WebUI) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.addCORSHeaders(rw, r)

	// Handle preflight requests
	if r.Method == "OPTIONS" {
		rw.WriteHeader(http.StatusNoContent)
		return
	}

	// Route request
	w.mux.ServeHTTP(rw, r)
}

// addCORSHeaders adds CORS headers to response
func (w *WebUI) addCORSHeaders(rw http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")

	// Check if origin is allowed
	if w.isOriginAllowed(origin) {
		rw.Header().Set("Access-Control-Allow-Origin", origin)
	} else if len(w.options.AllowOrigins) == 0 {
		// If no origins specified, allow all
		rw.Header().Set("Access-Control-Allow-Origin", "*")
	}

	rw.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	rw.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	rw.Header().Set("Access-Control-Max-Age", "86400")

	// Prevent caching of dynamic content
	rw.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	rw.Header().Set("Pragma", "no-cache")
	rw.Header().Set("Expires", "0")
}

// isOriginAllowed checks if an origin is in the allowed list
func (w *WebUI) isOriginAllowed(origin string) bool {
	for _, allowed := range w.options.AllowOrigins {
		if allowed == origin {
			return true
		}
	}
	return false
}

// handleRPC processes JSON-RPC requests
func (w *WebUI) handleRPC(rw http.ResponseWriter, r *http.Request) {
	slog.Debug("webui.handleRPC", "method", r.Method, "path", r.URL.Path, "remote", r.RemoteAddr)

	if r.Method != "POST" {
		slog.Warn("webui.handleRPC: method not allowed", "method", r.Method)
		http.Error(rw, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse JSON-RPC request
	var rpcReq RPCRequest
	if err := json.NewDecoder(r.Body).Decode(&rpcReq); err != nil {
		slog.Error("webui.handleRPC: parse error", "error", err)
		w.sendRPCError(rw, nil, ParseError, "Parse error")
		return
	}

	// Validate JSON-RPC version
	if rpcReq.JSONRPC != "2.0" {
		slog.Warn("webui.handleRPC: invalid JSON-RPC version", "version", rpcReq.JSONRPC)
		w.sendRPCError(rw, rpcReq.ID, InvalidRequest, "Invalid Request")
		return
	}

	// Process request
	ctx := r.Context()
	response := w.rpcHandler.HandleRequest(ctx, &rpcReq)

	// Ensure response is properly formed
	if response == nil {
		slog.Error("webui.handleRPC: nil response from handler", "method", rpcReq.Method)
		response = &RPCResponse{
			JSONRPC: "2.0",
			Error: &RPCError{
				Code:    InternalError,
				Message: "Internal server error",
			},
			ID: rpcReq.ID,
		}
	}

	// Send response
	var responseBuffer bytes.Buffer
	if err := json.NewEncoder(&responseBuffer).Encode(response); err != nil {
		slog.Error("webui.handleRPC: encode error", "method", rpcReq.Method, "error", err)
		w.sendRPCError(rw, rpcReq.ID, InternalError, "Failed to encode response")
		return
	}

	// Only set headers and write after successful encoding
	rw.Header().Set("Content-Type", "application/json")
	if _, err := responseBuffer.WriteTo(rw); err != nil {
		slog.Error("webui.handleRPC: write error", "method", rpcReq.Method, "error", err)
		// Cannot send error response here as headers are already written
		return
	}

	slog.Debug("webui.handleRPC done", "method", rpcReq.Method, "id", rpcReq.ID)
}

// sendRPCError sends a JSON-RPC error response
func (w *WebUI) sendRPCError(rw http.ResponseWriter, id interface{}, code int, message string) {
	response := &RPCResponse{
		JSONRPC: "2.0",
		Error: &RPCError{
			Code:    code,
			Message: message,
		},
		ID: id,
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK) // JSON-RPC errors still return 200

	if err := json.NewEncoder(rw).Encode(response); err != nil {
		slog.Error("webui.sendRPCError: encode failed", "error", err)
		return
	}
}

// handleTilesetImage serves the tileset image
func (w *WebUI) handleTilesetImage(rw http.ResponseWriter, r *http.Request) {
	slog.Debug("webui.handleTilesetImage", "remote", r.RemoteAddr)

	if w.tileset == nil || w.tileset.GetImageData() == nil {
		http.NotFound(rw, r)
		return
	}

	// Check for If-None-Match header for caching
	etag := fmt.Sprintf(`"%s-%s"`, w.tileset.Name, w.tileset.Version)
	if r.Header.Get("If-None-Match") == etag {
		rw.WriteHeader(http.StatusNotModified)
		return
	}

	// Set caching headers
	rw.Header().Set("ETag", etag)
	rw.Header().Set("Cache-Control", "public, max-age=3600")
	rw.Header().Set("Content-Type", "image/png")

	// Encode image as PNG
	if err := png.Encode(rw, w.tileset.GetImageData()); err != nil {
		slog.Error("webui.handleTilesetImage: encode failed", "error", err)
		http.Error(rw, "Failed to encode image", http.StatusInternalServerError)
		return
	}
}

// GetTileset returns the current tileset configuration
func (w *WebUI) GetTileset() *TilesetConfig {
	return w.tileset
}

// UpdateTileset updates the tileset configuration
func (w *WebUI) UpdateTileset(tileset *TilesetConfig) error {
	w.tileset = tileset

	if w.view != nil {
		w.view.SetTileset(tileset)
	}

	return nil
}

// SetView sets the view for the WebUI
func (w *WebUI) SetView(view *WebView) {
	w.view = view

	if w.tileset != nil {
		view.SetTileset(w.tileset)
	}
}

// GetView returns the current view
func (w *WebUI) GetView() *WebView {
	return w.view
}

// Start starts the WebUI server
func (w *WebUI) Start(addr string) error {
	if addr == "" {
		addr = ":8080"
	}

	server := &http.Server{
		Addr:         addr,
		Handler:      w,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	fmt.Printf("WebUI server starting on %s\n", addr)
	return server.ListenAndServe()
}

// StartWithContext starts the WebUI server with context for graceful shutdown
func (w *WebUI) StartWithContext(ctx context.Context, addr string) error {
	if addr == "" {
		addr = ":8080"
	}

	server := &http.Server{
		Addr:         addr,
		Handler:      w,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start tileset hot-reload monitoring if we have a tileset service
	if tilesetService := w.getTilesetService(); tilesetService != nil {
		go func() {
			if err := tilesetService.StartHotReload(ctx); err != nil && err != context.Canceled {
				slog.Error("webui: tileset hot-reload stopped", "error", err)
			}
		}()
	}

	// Start server in goroutine
	errCh := make(chan error, 1)
	go func() {
		fmt.Printf("WebUI server starting on %s\n", addr)
		errCh <- server.ListenAndServe()
	}()

	// Wait for context cancellation or server error
	select {
	case <-ctx.Done():
		// Graceful shutdown
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

// getTilesetService returns the tileset service for hot-reload monitoring.
func (w *WebUI) getTilesetService() *TilesetService {
	return w.tilesetService
}

// CreateWebView creates a new WebView that implements dgclient.View
func CreateWebView(opts dgclient.ViewOptions) (dgclient.View, error) {
	return NewWebView(opts)
}
