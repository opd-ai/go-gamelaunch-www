package webui

import (
	"sync"
	"testing"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// TestWebViewCloseRaceCondition tests the race condition between Close() and WaitForUpdate()
func TestWebViewCloseRaceCondition(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Start multiple goroutines that call WaitForUpdate
	var wg sync.WaitGroup
	panicCh := make(chan interface{}, 5) // Buffer for potential panics

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					t.Logf("Goroutine %d panicked: %v", id, r)
					panicCh <- r
				}
			}()

			// Try to wait for updates with short timeout
			for j := 0; j < 10; j++ {
				view.WaitForUpdate(100 * time.Millisecond)
				time.Sleep(10 * time.Millisecond) // Small delay between calls
			}
		}(i)
	}

	// Give goroutines time to start waiting
	time.Sleep(50 * time.Millisecond)

	// Now close the view while goroutines are potentially reading from the channel
	if err := view.Close(); err != nil {
		t.Fatalf("Failed to close view: %v", err)
	}

	// Wait for all goroutines to complete
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Good, all goroutines completed
	case <-time.After(5 * time.Second):
		t.Fatal("Test timed out waiting for goroutines to complete")
	}

	// Check if any goroutines panicked
	select {
	case panic := <-panicCh:
		t.Fatalf("Race condition detected - goroutine panicked: %v", panic)
	default:
		// No panic, but the race condition might still exist
	}
}

// TestWebViewRenderAfterClose tests rendering after close
func TestWebViewRenderAfterClose(t *testing.T) {
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

	// Try to render data after close - this should not panic
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Render after close caused panic: %v", r)
		}
	}()

	err = view.Render([]byte("Hello World"))
	if err != nil {
		t.Logf("Render after close returned error (expected): %v", err)
	}
}

// TestWebViewConcurrentAccess tests concurrent access patterns
func TestWebViewConcurrentAccess(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}
	defer view.Close()

	var wg sync.WaitGroup

	// Renderer goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			data := []byte("test data ")
			view.Render(data)
			time.Sleep(1 * time.Millisecond)
		}
	}()

	// Multiple reader goroutines
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				view.GetCurrentState()
				view.WaitForUpdate(10 * time.Millisecond)
			}
		}()
	}

	wg.Wait()
}
