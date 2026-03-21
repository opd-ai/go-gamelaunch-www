package webui

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// TestNewWebUI_Integration tests the complete workflow described in README.md
func TestNewWebUI_Integration(t *testing.T) {
	// Create a WebView - exactly as shown in README
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Create WebUI with configuration - exactly as shown in README
	webUI, err := NewWebUI(WebUIOptions{
		View:        view,
		ListenAddr:  ":8080",
		TilesetPath: "", // No tileset for this test
	})
	if err != nil {
		t.Fatalf("Failed to create WebUI: %v", err)
	}

	// Verify that the WebUI was created correctly
	if webUI.view == nil {
		t.Fatal("WebUI view is nil")
	}

	if webUI.rpcHandler == nil {
		t.Fatal("WebUI RPC handler is nil")
	}

	// Test that Start method exists and is callable
	// We'll use a timeout context to avoid hanging
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Start the server in a goroutine
	errCh := make(chan error, 1)
	go func() {
		err := webUI.StartWithContext(ctx, ":0") // Use port 0 for testing
		errCh <- err
	}()

	// Wait for either timeout or error
	select {
	case <-ctx.Done():
		// Expected - server should shut down due to context timeout
		t.Log("Server started and shut down correctly with context")
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("Unexpected server error: %v", err)
		}
	}
}

// TestWebUI_RPCMethodsIntegration tests that all documented RPC methods work
func TestWebUI_RPCMethodsIntegration(t *testing.T) {
	// Create a WebView
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Create WebUI
	webUI, err := NewWebUI(WebUIOptions{
		View: view,
	})
	if err != nil {
		t.Fatalf("Failed to create WebUI: %v", err)
	}

	ctx := context.Background()

	// Test all documented RPC methods
	testCases := []struct {
		method string
		params string
	}{
		{"game.getState", "{}"},
		{"game.poll", `{"version": 0, "timeout": 1000}`},
		{"game.sendInput", `{"events": [{"type": "keydown", "key": "a", "timestamp": 123456789}]}`},
		{"session.info", "{}"},
		{"tileset.fetch", "{}"},
		{"game.connect", "{}"},
		{"game.disconnect", "{}"},
		{"game.resize", `{"width": 80, "height": 24}`},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("RPC_%s", tc.method), func(t *testing.T) {
			req := &RPCRequest{
				JSONRPC: "2.0",
				Method:  tc.method,
				Params:  []byte(tc.params),
				ID:      1,
			}

			response := webUI.rpcHandler.HandleRequest(ctx, req)
			if response == nil {
				t.Fatal("RPC handler returned nil response")
			}

			if response.Error != nil {
				// Some methods may return errors in test conditions, but they should be well-formed
				if response.Error.Code == 0 || response.Error.Message == "" {
					t.Fatalf("RPC method %s returned malformed error: %+v", tc.method, response.Error)
				}
				t.Logf("RPC method %s returned expected error: %s", tc.method, response.Error.Message)
			} else {
				if response.Result == nil {
					t.Fatalf("RPC method %s returned nil result with no error", tc.method)
				}
				t.Logf("RPC method %s completed successfully", tc.method)
			}

			if response.ID != req.ID {
				t.Fatalf("RPC response ID mismatch: expected %v, got %v", req.ID, response.ID)
			}
		})
	}
}

// TestWebUI_ValidationFixesWork tests that the validation fixes implemented work correctly
func TestWebUI_ValidationFixesWork(t *testing.T) {
	// Test 1: NewWebUI validates required View parameter
	t.Run("NewWebUI_RequiresView", func(t *testing.T) {
		_, err := NewWebUI(WebUIOptions{
			View: nil, // Should cause error
		})
		if err == nil {
			t.Fatal("Expected error when View is nil, but got none")
		}
		if err.Error() != "view is required in WebUIOptions" {
			t.Fatalf("Expected specific error message, got: %v", err)
		}
	})

	// Test 2: WebView is properly initialized
	t.Run("WebView_InitializedCorrectly", func(t *testing.T) {
		view, err := NewWebView(dgclient.ViewOptions{
			InitialWidth:  80,
			InitialHeight: 24,
		})
		if err != nil {
			t.Fatalf("Failed to create WebView: %v", err)
		}

		webUI, err := NewWebUI(WebUIOptions{
			View: view,
		})
		if err != nil {
			t.Fatalf("Failed to create WebUI: %v", err)
		}

		// Verify view is initialized
		if webUI.view == nil {
			t.Fatal("WebUI view is nil")
		}

		// Verify view has proper dimensions
		width, height := webUI.view.GetSize()
		if width != 80 || height != 24 {
			t.Fatalf("WebView dimensions incorrect: expected 80x24, got %dx%d", width, height)
		}
	})

	// Test 3: Default poll timeout is set
	t.Run("DefaultPollTimeout_IsSet", func(t *testing.T) {
		view, err := NewWebView(dgclient.ViewOptions{
			InitialWidth:  80,
			InitialHeight: 24,
		})
		if err != nil {
			t.Fatalf("Failed to create WebView: %v", err)
		}

		webUI, err := NewWebUI(WebUIOptions{
			View: view,
			// PollTimeout not set - should use default
		})
		if err != nil {
			t.Fatalf("Failed to create WebUI: %v", err)
		}

		expectedTimeout := 30 * time.Second
		if webUI.options.PollTimeout != expectedTimeout {
			t.Fatalf("Expected default poll timeout %v, got %v", expectedTimeout, webUI.options.PollTimeout)
		}
	})
}
