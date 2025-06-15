package webui

import (
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// TestBugFix_RenderAfterClose verifies the race condition fix
func TestBugFix_RenderAfterClose(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Close the view first
	if err := view.Close(); err != nil {
		t.Fatalf("Failed to close view: %v", err)
	}

	// Now try to render data - should return error, not panic
	err = view.Render([]byte("test data"))
	if err == nil {
		t.Fatal("Expected error when rendering to closed view")
	}

	if !strings.Contains(err.Error(), "cannot render to closed view") {
		t.Fatalf("Expected specific error message, got: %v", err)
	}

	t.Log("Success: Render after close returns error instead of panicking")
}

// TestBugFix_ConcurrentRenderClose verifies concurrent safety
func TestBugFix_ConcurrentRenderClose(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	var wg sync.WaitGroup
	panicCh := make(chan interface{}, 10)

	// Start rendering goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				panicCh <- r
			}
		}()

		for i := 0; i < 1000; i++ {
			err := view.Render([]byte("test"))
			if err != nil {
				// Expected after close
				t.Logf("Render returned error (expected): %v", err)
				return
			}
			if i%100 == 0 {
				time.Sleep(1 * time.Millisecond)
			}
		}
	}()

	// Let rendering start
	time.Sleep(5 * time.Millisecond)

	// Close the view
	if err := view.Close(); err != nil {
		t.Fatalf("Failed to close view: %v", err)
	}

	// Wait for goroutine to complete
	wg.Wait()

	// Check for panics
	close(panicCh)
	panics := make([]interface{}, 0)
	for panic := range panicCh {
		panics = append(panics, panic)
	}

	if len(panics) > 0 {
		t.Fatalf("Fix failed: %d panics occurred: %v", len(panics), panics)
	}

	t.Log("Success: No panics during concurrent render/close operations")
}

// TestBugFix_DoubleClose verifies double close safety
func TestBugFix_DoubleClose(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Close once
	if err := view.Close(); err != nil {
		t.Fatalf("First close failed: %v", err)
	}

	// Close again - should not panic
	if err := view.Close(); err != nil {
		t.Fatalf("Second close failed: %v", err)
	}

	t.Log("Success: Double close handled safely")
}

// TestBugFix_SendInputAfterClose verifies SendInput safety
func TestBugFix_SendInputAfterClose(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Close the view
	if err := view.Close(); err != nil {
		t.Fatalf("Failed to close view: %v", err)
	}

	// SendInput should not panic after close
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("SendInput panicked after close: %v", r)
		}
	}()

	view.SendInput([]byte("test input"))
	t.Log("Success: SendInput handled safely after close")
}
