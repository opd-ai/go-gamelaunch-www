package webui

import (
	"sync"
	"testing"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// TestActualRaceCondition tests the specific race condition in the codebase
func TestActualRaceCondition(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	var wg sync.WaitGroup
	panicCh := make(chan interface{}, 10)

	// Goroutine 1: Continuously render data (triggers notifications)
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				panicCh <- r
			}
		}()

		for i := 0; i < 1000; i++ {
			if err := view.Render([]byte("test")); err != nil {
				// Expected after close
				return
			}
			if i%10 == 0 {
				time.Sleep(1 * time.Millisecond) // Small delay
			}
		}
	}()

	// Goroutine 2: Wait for updates
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				panicCh <- r
			}
		}()

		for i := 0; i < 100; i++ {
			view.WaitForUpdate(50 * time.Millisecond)
		}
	}()

	// Let goroutines run briefly
	time.Sleep(10 * time.Millisecond)

	// Close the view while operations are happening
	if err := view.Close(); err != nil {
		t.Fatalf("Failed to close view: %v", err)
	}

	// Wait for goroutines to complete
	wg.Wait()

	// Check for panics
	close(panicCh)
	panics := make([]interface{}, 0)
	for panic := range panicCh {
		panics = append(panics, panic)
	}

	if len(panics) > 0 {
		t.Fatalf("Race condition caused %d panics: %v", len(panics), panics)
	}
}

// TestSendThroughClosedChannel tests the specific scenario
func TestSendThroughClosedChannel(t *testing.T) {
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

	// Now try to render data - this will try to send to a closed channel
	defer func() {
		if r := recover(); r != nil {
			t.Logf("Panic occurred as expected: %v", r)
			// This is the bug we're looking for!
			if panicStr, ok := r.(string); ok && panicStr == "send on closed channel" {
				t.Fatal("CRITICAL BUG FOUND: send on closed channel panic")
			}
		}
	}()

	err = view.Render([]byte("test data"))
	if err != nil {
		t.Logf("Render returned error (acceptable): %v", err)
	}
}
