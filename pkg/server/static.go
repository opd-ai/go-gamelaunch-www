// Package server provides a minimal static file server for WASM game client deployment.
// It serves the pre-built WASM binary, wasm_exec.js runtime, and index.html from a
// configurable directory, enabling standalone deployment without the full WebUI stack.
package server

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Config holds configuration for the static server.
type Config struct {
	// Addr is the listen address (e.g., ":8080").
	Addr string

	// StaticDir is the filesystem path to serve files from.
	// It must contain index.html, wasm_exec.js, and gamelaunch.wasm.
	StaticDir string

	// ReadTimeout is the maximum duration for reading the request body.
	ReadTimeout time.Duration

	// WriteTimeout is the maximum duration for writing the response.
	WriteTimeout time.Duration

	// IdleTimeout is the maximum amount of time to wait for the next request.
	IdleTimeout time.Duration
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() Config {
	return Config{
		Addr:         ":8080",
		StaticDir:    "static",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
}

// StaticServer serves static files for the WASM game client.
type StaticServer struct {
	config Config
	server *http.Server
}

// New creates a new StaticServer with the given configuration.
func New(cfg Config) *StaticServer {
	if cfg.Addr == "" {
		cfg.Addr = ":8080"
	}
	if cfg.StaticDir == "" {
		cfg.StaticDir = "static"
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 30 * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = 30 * time.Second
	}
	if cfg.IdleTimeout == 0 {
		cfg.IdleTimeout = 120 * time.Second
	}
	return &StaticServer{config: cfg}
}

// Handler returns the http.Handler for the static server.
// It serves files from StaticDir and sets WASM-appropriate content types.
func (s *StaticServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/", wasmAwareFileServer(http.Dir(s.config.StaticDir)))
	return mux
}

// wasmAwareFileServer wraps http.FileServer and adds correct MIME types for WASM files.
func wasmAwareFileServer(root http.FileSystem) http.Handler {
	base := http.FileServer(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/gamelaunch.wasm" || len(r.URL.Path) >= 5 && r.URL.Path[len(r.URL.Path)-5:] == ".wasm" {
			w.Header().Set("Content-Type", "application/wasm")
		}
		base.ServeHTTP(w, r)
	})
}

// Start starts the static file server and blocks until the server exits.
func (s *StaticServer) Start() error {
	s.server = &http.Server{
		Addr:         s.config.Addr,
		Handler:      s.Handler(),
		ReadTimeout:  s.config.ReadTimeout,
		WriteTimeout: s.config.WriteTimeout,
		IdleTimeout:  s.config.IdleTimeout,
	}

	fmt.Printf("Static WASM server starting on %s (serving %s)\n", s.config.Addr, s.config.StaticDir)
	return s.server.ListenAndServe()
}

// StartWithContext starts the static file server and shuts down gracefully when ctx is cancelled.
func (s *StaticServer) StartWithContext(ctx context.Context) error {
	s.server = &http.Server{
		Addr:         s.config.Addr,
		Handler:      s.Handler(),
		ReadTimeout:  s.config.ReadTimeout,
		WriteTimeout: s.config.WriteTimeout,
		IdleTimeout:  s.config.IdleTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		fmt.Printf("Static WASM server starting on %s (serving %s)\n", s.config.Addr, s.config.StaticDir)
		errCh <- s.server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return s.server.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}
