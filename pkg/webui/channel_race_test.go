package webui

import (
	"sync"
	"testing"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
)

// TestChannelCloseRace demonstrates the race condition between channel close and read
func TestChannelCloseRace(t *testing.T) {
	view, err := NewWebView(dgclient.ViewOptions{
		InitialWidth:  80,
		InitialHeight: 24,
	})
	if err != nil {
		t.Fatalf("Failed to create WebView: %v", err)
	}

	// Create many goroutines that will try to read from updateNotify
	var wg sync.WaitGroup
	panicChan := make(chan interface{}, 100)

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					panicChan <- r
				}
			}()

			// Force a blocked read on the channel
			select {
			case <-view.updateNotify:
				// Got notification
			case <-time.After(2 * time.Second):
				// Timeout
			}
		}(i)
	}

	// Let the goroutines start and get blocked
	time.Sleep(100 * time.Millisecond)

	// Now close the view - this closes the channel
	view.Close()

	// Wait for all goroutines to finish
	wg.Wait()

	// Check for panics
	close(panicChan)
	panicCount := 0
	for panic := range panicChan {
		t.Logf("Panic detected: %v", panic)
		panicCount++
	}

	if panicCount > 0 {
		t.Fatalf("Detected %d panics from race condition", panicCount)
	}
}

// TestManualChannelBehavior demonstrates the core issue
func TestManualChannelBehavior(t *testing.T) {
	ch := make(chan struct{}, 10)
	
	// Start a goroutine that will try to read from the channel
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		
		// This will block indefinitely if the channel is never closed
		// But when the channel is closed, it will return immediately with zero value
		select {
		case <-ch:
			t.Log("Received from channel (could be zero value from closed channel)")
		case <-time.After(1 * time.Second):
			t.Log("Timeout waiting for channel")
		}
	}()
	
	// Give goroutine time to start
	time.Sleep(100 * time.Millisecond)
	
	// Close the channel
	close(ch)
	
	// Wait for goroutine to finish
	wg.Wait()
	
	// Now demonstrate the issue - reading from closed channel returns immediately
	// This is the core of the race condition
	start := time.Now()
	select {
	case <-ch:
		duration := time.Since(start)
		t.Logf("Reading from closed channel took %v (should be immediate)", duration)
		if duration > 10*time.Millisecond {
			t.Error("Reading from closed channel took too long")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Reading from closed channel should return immediately")
	}
}
