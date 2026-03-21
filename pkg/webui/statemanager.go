// Package webui provides StateManager implementation for game state version tracking.
// Moved from: state.go
package webui

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// StateManager manages game state versions and change tracking
// Moved from: state.go
type StateManager struct {
	mu           sync.RWMutex
	currentState *GameState
	version      uint64
	waiters      map[string]chan *StateDiff
	waitersMu    sync.Mutex
}

// NewStateManager creates a new state manager
// Moved from: state.go
func NewStateManager() *StateManager {
	return &StateManager{
		waiters: make(map[string]chan *StateDiff),
	}
}

// UpdateState updates the current state and notifies waiters
// Moved from: state.go
func (sm *StateManager) UpdateState(state *GameState) {
	sm.mu.Lock()

	// Increment version
	sm.version++
	state.Version = sm.version

	// Generate diff if we have a previous state
	var diff *StateDiff
	if sm.currentState != nil {
		diff = sm.generateDiff(sm.currentState, state)
	}

	sm.currentState = state
	sm.mu.Unlock()

	// Notify waiters
	if diff != nil {
		sm.notifyWaiters(diff)
	}
}

// GetCurrentState returns the current state
// Moved from: state.go
func (sm *StateManager) GetCurrentState() *GameState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if sm.currentState == nil {
		return nil
	}

	// Return a copy
	stateCopy := *sm.currentState
	return &stateCopy
}

// GetCurrentVersion returns the current version number
// Moved from: state.go
func (sm *StateManager) GetCurrentVersion() uint64 {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return sm.version
}

// waiterRegistration holds the state needed for change polling
type waiterRegistration struct {
	waiterCh  chan *StateDiff
	uniqueKey string
	cleanup   func()
}

// registerWaiter creates and registers a waiter channel, returning nil if client is already behind
func (sm *StateManager) registerWaiter(clientVersion uint64) (*waiterRegistration, *StateDiff) {
	sm.mu.RLock()
	currentVersion := sm.version
	sm.mu.RUnlock()

	// If client is behind, return immediate diff
	if clientVersion < currentVersion {
		diff, _ := sm.generateDiffFromVersion(clientVersion)
		return nil, diff
	}

	// Create and register waiter
	waiterCh := make(chan *StateDiff, 1)
	uniqueKey := fmt.Sprintf("%d-%d", clientVersion, time.Now().UnixNano())

	sm.waitersMu.Lock()
	sm.waiters[uniqueKey] = waiterCh
	sm.waitersMu.Unlock()

	cleanup := func() {
		sm.waitersMu.Lock()
		delete(sm.waiters, uniqueKey)
		sm.waitersMu.Unlock()
	}

	return &waiterRegistration{
		waiterCh:  waiterCh,
		uniqueKey: uniqueKey,
		cleanup:   cleanup,
	}, nil
}

// PollChanges waits for changes since the given client version
// Moved from: state.go
func (sm *StateManager) PollChanges(clientVersion uint64, timeout time.Duration) (*StateDiff, error) {
	reg, immediateDiff := sm.registerWaiter(clientVersion)
	if immediateDiff != nil {
		return immediateDiff, nil
	}
	defer reg.cleanup()

	select {
	case diff := <-reg.waiterCh:
		return diff, nil
	case <-time.After(timeout):
		return nil, nil // Timeout
	}
}

// notifyWaiters notifies all waiting clients of state changes
// Moved from: state.go
func (sm *StateManager) notifyWaiters(diff *StateDiff) {
	sm.waitersMu.Lock()
	defer sm.waitersMu.Unlock()

	for key, waiterCh := range sm.waiters {
		if version, ok := parseWaiterVersion(key); ok && version < diff.Version {
			sendToWaiter(waiterCh, diff)
		}
	}
}

// parseWaiterVersion extracts the version number from a waiter key.
func parseWaiterVersion(key string) (uint64, bool) {
	parts := strings.Split(key, "-")
	if len(parts) < 1 {
		return 0, false
	}
	version, err := strconv.ParseUint(parts[0], 10, 64)
	return version, err == nil
}

// sendToWaiter delivers a diff to a waiter channel without blocking.
func sendToWaiter(ch chan *StateDiff, diff *StateDiff) {
	select {
	case ch <- diff:
	default:
		// Channel full, skip
	}
}

// PollChangesWithContext waits for changes with a context
// It is a context-aware version of PollChanges
// Moved from: state.go
func (sm *StateManager) PollChangesWithContext(pollCtx context.Context, version uint64) (*StateDiff, error) {
	reg, immediateDiff := sm.registerWaiter(version)
	if immediateDiff != nil {
		return immediateDiff, nil
	}
	defer reg.cleanup()

	select {
	case diff := <-reg.waiterCh:
		return diff, nil
	case <-pollCtx.Done():
		return nil, pollCtx.Err() // Context cancelled or deadline exceeded
	}
}

// generateDiff creates a diff between two states
// Moved from: state.go
func (sm *StateManager) generateDiff(oldState, newState *GameState) *StateDiff {
	diff := &StateDiff{
		Version:   newState.Version,
		CursorX:   newState.CursorX,
		CursorY:   newState.CursorY,
		Timestamp: newState.Timestamp,
		Changes:   make([]CellDiff, 0),
	}

	// Compare cells in the overlapping region.
	maxY := min(oldState.Height, newState.Height)
	for y := 0; y < maxY; y++ {
		maxX := min(oldState.Width, newState.Width)
		for x := 0; x < maxX; x++ {
			if sm.cellsDiffer(oldState.Buffer[y][x], newState.Buffer[y][x]) {
				diff.Changes = append(diff.Changes, CellDiff{X: x, Y: y, Cell: newState.Buffer[y][x]})
			}
		}
	}

	// Append cells from any expanded region.
	appendExpandedCells(diff, oldState, newState)

	return diff
}

// appendExpandedCells adds all cells from rows/columns that exist only in newState.
func appendExpandedCells(diff *StateDiff, oldState, newState *GameState) {
	if newState.Height <= oldState.Height && newState.Width <= oldState.Width {
		return
	}
	for y := 0; y < newState.Height; y++ {
		for x := 0; x < newState.Width; x++ {
			if y >= oldState.Height || x >= oldState.Width {
				diff.Changes = append(diff.Changes, CellDiff{X: x, Y: y, Cell: newState.Buffer[y][x]})
			}
		}
	}
}

// generateDiffFromVersion generates diff from a specific version to current
// Moved from: state.go
func (sm *StateManager) generateDiffFromVersion(fromVersion uint64) (*StateDiff, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if sm.currentState == nil {
		return nil, nil
	}

	// For simplicity, return full state as diff if version is old
	// In production, you'd want to store historical states or deltas
	diff := &StateDiff{
		Version:   sm.currentState.Version,
		CursorX:   sm.currentState.CursorX,
		CursorY:   sm.currentState.CursorY,
		Timestamp: sm.currentState.Timestamp,
		Changes:   make([]CellDiff, 0),
	}

	// Add all cells as changes
	for y := 0; y < sm.currentState.Height; y++ {
		for x := 0; x < sm.currentState.Width; x++ {
			diff.Changes = append(diff.Changes, CellDiff{
				X:    x,
				Y:    y,
				Cell: sm.currentState.Buffer[y][x],
			})
		}
	}

	return diff, nil
}

// cellsDiffer compares two cells for differences
// Moved from: state.go
func (sm *StateManager) cellsDiffer(a, b Cell) bool {
	return a.Char != b.Char ||
		a.FgColor != b.FgColor ||
		a.BgColor != b.BgColor ||
		a.Bold != b.Bold ||
		a.Inverse != b.Inverse ||
		a.Blink != b.Blink ||
		a.TileX != b.TileX ||
		a.TileY != b.TileY
}
