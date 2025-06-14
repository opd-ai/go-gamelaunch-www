// Package webui provides comprehensive unit tests for StateManager functionality.
// This file contains tests for game state version tracking and change detection.
package webui

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

// TestNewStateManager tests the constructor function
func TestNewStateManager_CreatesValidInstance_ReturnsNonNilStateManager(t *testing.T) {
	sm := NewStateManager()

	if sm == nil {
		t.Fatal("NewStateManager() returned nil")
	}

	if sm.waiters == nil {
		t.Error("StateManager waiters map not initialized")
	}

	if sm.GetCurrentVersion() != 0 {
		t.Errorf("Initial version = %d, want 0", sm.GetCurrentVersion())
	}
}

// TestStateManager_GetCurrentState tests state retrieval with various scenarios
func TestStateManager_GetCurrentState_ReturnsExpectedResults(t *testing.T) {
	tests := []struct {
		name           string
		initialState   *GameState
		expectedResult *GameState
	}{
		{
			name:           "NilState_ReturnsNil",
			initialState:   nil,
			expectedResult: nil,
		},
		{
			name: "ValidState_ReturnsCopy",
			initialState: &GameState{
				Width:     80,
				Height:    24,
				CursorX:   10,
				CursorY:   5,
				Version:   1,
				Timestamp: time.Now().Unix(),
				Buffer:    make([][]Cell, 24),
			},
			expectedResult: &GameState{
				Width:     80,
				Height:    24,
				CursorX:   10,
				CursorY:   5,
				Version:   1,
				Timestamp: time.Now().Unix(),
				Buffer:    make([][]Cell, 24),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sm := NewStateManager()
			if tt.initialState != nil {
				sm.UpdateState(tt.initialState)
			}

			result := sm.GetCurrentState()

			if tt.expectedResult == nil {
				if result != nil {
					t.Errorf("GetCurrentState() = %v, want nil", result)
				}
				return
			}

			if result == nil {
				t.Fatal("GetCurrentState() returned nil, expected non-nil")
			}

			// Test that we get a copy, not the original
			if result == tt.initialState {
				t.Error("GetCurrentState() returned same instance, expected copy")
			}

			if result.Width != tt.expectedResult.Width {
				t.Errorf("Width = %d, want %d", result.Width, tt.expectedResult.Width)
			}
			if result.Height != tt.expectedResult.Height {
				t.Errorf("Height = %d, want %d", result.Height, tt.expectedResult.Height)
			}
			if result.CursorX != tt.expectedResult.CursorX {
				t.Errorf("CursorX = %d, want %d", result.CursorX, tt.expectedResult.CursorX)
			}
			if result.CursorY != tt.expectedResult.CursorY {
				t.Errorf("CursorY = %d, want %d", result.CursorY, tt.expectedResult.CursorY)
			}
		})
	}
}

// TestStateManager_UpdateState tests state updates and version increment
func TestStateManager_UpdateState_IncrementsVersionAndNotifiesWaiters(t *testing.T) {
	sm := NewStateManager()

	initialVersion := sm.GetCurrentVersion()

	state1 := &GameState{
		Width:     80,
		Height:    24,
		CursorX:   0,
		CursorY:   0,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(24, 80),
	}

	sm.UpdateState(state1)

	// Check version increment
	if sm.GetCurrentVersion() != initialVersion+1 {
		t.Errorf("Version after first update = %d, want %d", sm.GetCurrentVersion(), initialVersion+1)
	}

	// Check state version was set
	if state1.Version != initialVersion+1 {
		t.Errorf("State version = %d, want %d", state1.Version, initialVersion+1)
	}

	// Update with second state
	state2 := &GameState{
		Width:     80,
		Height:    24,
		CursorX:   5,
		CursorY:   3,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(24, 80),
	}

	sm.UpdateState(state2)

	if sm.GetCurrentVersion() != initialVersion+2 {
		t.Errorf("Version after second update = %d, want %d", sm.GetCurrentVersion(), initialVersion+2)
	}
}

// TestStateManager_PollChanges tests change polling functionality
func TestStateManager_PollChanges_HandlesVariousScenarios(t *testing.T) {
	tests := []struct {
		name            string
		clientVersion   uint64
		setupStates     []*GameState
		timeout         time.Duration
		expectImmediate bool
		expectNil       bool
	}{
		{
			name:            "ClientBehind_ReturnsImmediateDiff",
			clientVersion:   0,
			setupStates:     []*GameState{createTestGameState(1)},
			timeout:         100 * time.Millisecond,
			expectImmediate: true,
			expectNil:       false,
		},
		{
			name:            "ClientCurrent_TimesOut",
			clientVersion:   1,
			setupStates:     []*GameState{createTestGameState(1)},
			timeout:         100 * time.Millisecond,
			expectImmediate: false,
			expectNil:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sm := NewStateManager()

			// Setup initial states
			for _, state := range tt.setupStates {
				sm.UpdateState(state)
			}

			startTime := time.Now()
			diff, err := sm.PollChanges(tt.clientVersion, tt.timeout)
			elapsed := time.Since(startTime)

			if err != nil {
				t.Fatalf("PollChanges() error = %v", err)
			}

			if tt.expectNil {
				if diff != nil {
					t.Errorf("PollChanges() returned diff, expected nil")
				}
				// Should have waited for timeout
				if elapsed < tt.timeout/2 {
					t.Errorf("PollChanges() returned too quickly, elapsed = %v, timeout = %v", elapsed, tt.timeout)
				}
			} else {
				if diff == nil {
					t.Errorf("PollChanges() returned nil, expected diff")
				}
				if tt.expectImmediate && elapsed > 50*time.Millisecond {
					t.Errorf("PollChanges() took too long for immediate response, elapsed = %v", elapsed)
				}
			}
		})
	}
}

// TestStateManager_PollChangesWithContext tests context-aware polling
func TestStateManager_PollChangesWithContext_HandlesContextCancellation(t *testing.T) {
	sm := NewStateManager()
	sm.UpdateState(createTestGameState(1))

	// Test context cancellation
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	startTime := time.Now()
	diff, err := sm.PollChangesWithContext(ctx, 1) // Up to date version
	elapsed := time.Since(startTime)

	if err != context.Canceled {
		t.Errorf("PollChangesWithContext() error = %v, want %v", err, context.Canceled)
	}

	if diff != nil {
		t.Errorf("PollChangesWithContext() returned diff, expected nil on cancellation")
	}

	if elapsed > 100*time.Millisecond {
		t.Errorf("PollChangesWithContext() took too long, elapsed = %v", elapsed)
	}
}

// TestStateManager_PollChangesWithContext_ImmediateReturnForOldVersion tests immediate return behavior
func TestStateManager_PollChangesWithContext_ImmediateReturnForOldVersion_ReturnsDiff(t *testing.T) {
	sm := NewStateManager()
	sm.UpdateState(createTestGameState(1))

	ctx := context.Background()

	startTime := time.Now()
	diff, err := sm.PollChangesWithContext(ctx, 0) // Old version
	elapsed := time.Since(startTime)

	if err != nil {
		t.Errorf("PollChangesWithContext() error = %v, want nil", err)
	}

	if diff == nil {
		t.Error("PollChangesWithContext() returned nil, expected diff for old version")
	}

	if elapsed > 50*time.Millisecond {
		t.Errorf("PollChangesWithContext() took too long for immediate response, elapsed = %v", elapsed)
	}
}

// TestStateManager_ConcurrentAccess tests thread safety
func TestStateManager_ConcurrentAccess_HandlesRaceConditionsCorrectly(t *testing.T) {
	sm := NewStateManager()
	const numGoroutines = 10
	const numOperations = 100

	var wg sync.WaitGroup
	wg.Add(numGoroutines * 2) // readers and writers

	// Start readers
	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				sm.GetCurrentState()
				sm.GetCurrentVersion()
			}
		}()
	}

	// Start writers
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				state := createTestGameState(uint64(id*numOperations + j))
				sm.UpdateState(state)
			}
		}(i)
	}

	// Wait for all goroutines to complete
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(10 * time.Second):
		t.Fatal("Test timed out - possible deadlock")
	}

	// Verify final state
	finalVersion := sm.GetCurrentVersion()
	if finalVersion == 0 {
		t.Error("Final version is 0, expected some updates")
	}
}

// TestStateManager_generateDiff tests diff generation between states
func TestStateManager_generateDiff_CreatesDiffCorrectly(t *testing.T) {
	sm := NewStateManager()

	// Create two different states
	oldState := createTestGameState(1)
	oldState.CursorX = 0
	oldState.CursorY = 0
	oldState.Buffer[0][0] = Cell{Char: 'A', FgColor: "#ffffff"}

	newState := createTestGameState(2)
	newState.CursorX = 5
	newState.CursorY = 3
	newState.Buffer[0][0] = Cell{Char: 'B', FgColor: "#ff0000"}

	diff := sm.generateDiff(oldState, newState)

	if diff == nil {
		t.Fatal("generateDiff() returned nil")
	}

	if diff.Version != newState.Version {
		t.Errorf("Diff version = %d, want %d", diff.Version, newState.Version)
	}

	if diff.CursorX != newState.CursorX {
		t.Errorf("Diff cursor X = %d, want %d", diff.CursorX, newState.CursorX)
	}

	if diff.CursorY != newState.CursorY {
		t.Errorf("Diff cursor Y = %d, want %d", diff.CursorY, newState.CursorY)
	}

	// Should have at least one change (cell 0,0 changed)
	if len(diff.Changes) == 0 {
		t.Error("Diff has no changes, expected at least one")
	}

	// Find the change for cell 0,0
	foundChange := false
	for _, change := range diff.Changes {
		if change.X == 0 && change.Y == 0 {
			foundChange = true
			if change.Cell.Char != 'B' {
				t.Errorf("Changed cell char = %c, want 'B'", change.Cell.Char)
			}
			if change.Cell.FgColor != "#ff0000" {
				t.Errorf("Changed cell color = %s, want '#ff0000'", change.Cell.FgColor)
			}
			break
		}
	}

	if !foundChange {
		t.Error("Expected change for cell (0,0) not found in diff")
	}
}

// TestStateManager_cellsDiffer tests cell comparison logic
func TestStateManager_cellsDiffer_DetectsAllDifferences(t *testing.T) {
	sm := NewStateManager()

	baseCell := Cell{
		Char:    'A',
		FgColor: "#ffffff",
		BgColor: "#000000",
		Bold:    false,
		Inverse: false,
		Blink:   false,
		TileX:   0,
		TileY:   0,
	}

	tests := []struct {
		name     string
		cellB    Cell
		expected bool
	}{
		{
			name:     "IdenticalCells_ReturnsFalse",
			cellB:    baseCell,
			expected: false,
		},
		{
			name:     "DifferentChar_ReturnsTrue",
			cellB:    Cell{Char: 'B', FgColor: "#ffffff", BgColor: "#000000"},
			expected: true,
		},
		{
			name:     "DifferentFgColor_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ff0000", BgColor: "#000000"},
			expected: true,
		},
		{
			name:     "DifferentBgColor_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#ff0000"},
			expected: true,
		},
		{
			name:     "DifferentBold_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#000000", Bold: true},
			expected: true,
		},
		{
			name:     "DifferentInverse_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#000000", Inverse: true},
			expected: true,
		},
		{
			name:     "DifferentBlink_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#000000", Blink: true},
			expected: true,
		},
		{
			name:     "DifferentTileX_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#000000", TileX: 1},
			expected: true,
		},
		{
			name:     "DifferentTileY_ReturnsTrue",
			cellB:    Cell{Char: 'A', FgColor: "#ffffff", BgColor: "#000000", TileY: 1},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sm.cellsDiffer(baseCell, tt.cellB)
			if result != tt.expected {
				t.Errorf("cellsDiffer() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestStateManager_notifyWaiters tests the notification mechanism for waiting clients
func TestStateManager_notifyWaiters_NotifiesCorrectWaiters(t *testing.T) {
	sm := NewStateManager()

	// Setup initial state
	sm.UpdateState(createTestGameState(1))

	// Create a waiter for version 0 (should be notified)
	waiterCh := make(chan *StateDiff, 1)
	sm.waitersMu.Lock()
	sm.waiters["0-123456"] = waiterCh // version 0
	sm.waitersMu.Unlock()

	// Create a waiter for version 2 (should not be notified)
	waiterCh2 := make(chan *StateDiff, 1)
	sm.waitersMu.Lock()
	sm.waiters["2-123457"] = waiterCh2 // version 2
	sm.waitersMu.Unlock()

	// Create diff for version 2
	diff := &StateDiff{
		Version:   2,
		CursorX:   5,
		CursorY:   3,
		Timestamp: time.Now().Unix(),
		Changes:   []CellDiff{},
	}

	// Notify waiters
	sm.notifyWaiters(diff)

	// Check that waiter for version 0 was notified
	select {
	case receivedDiff := <-waiterCh:
		if receivedDiff.Version != 2 {
			t.Errorf("Received diff version = %d, want 2", receivedDiff.Version)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Waiter for version 0 was not notified")
	}

	// Check that waiter for version 2 was not notified
	select {
	case <-waiterCh2:
		t.Error("Waiter for version 2 should not have been notified")
	case <-time.After(50 * time.Millisecond):
		// Expected - waiter should not be notified
	}

	// Cleanup
	sm.waitersMu.Lock()
	delete(sm.waiters, "0-123456")
	delete(sm.waiters, "2-123457")
	sm.waitersMu.Unlock()
}

// TestStateManager_generateDiff_HandlesSizeChanges tests diff generation with size changes
func TestStateManager_generateDiff_HandlesSizeChanges_CreatesCorrectDiff(t *testing.T) {
	sm := NewStateManager()

	// Create old state with smaller dimensions
	oldState := &GameState{
		Width:     3,
		Height:    2,
		CursorX:   0,
		CursorY:   0,
		Version:   1,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(2, 3),
	}

	// Create new state with larger dimensions
	newState := &GameState{
		Width:     5,
		Height:    4,
		CursorX:   2,
		CursorY:   1,
		Version:   2,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(4, 5),
	}

	// Modify a cell in the overlapping area
	newState.Buffer[0][0] = Cell{Char: 'X', FgColor: "#ff0000"}

	diff := sm.generateDiff(oldState, newState)

	if diff == nil {
		t.Fatal("generateDiff() returned nil")
	}

	// Should have changes for:
	// 1. Modified cell (0,0)
	// 2. New cells from size expansion
	expectedMinChanges := 1 + (5*4 - 3*2) // 1 modified + new cells
	if len(diff.Changes) < expectedMinChanges {
		t.Errorf("Diff has %d changes, expected at least %d", len(diff.Changes), expectedMinChanges)
	}

	// Verify the modified cell is in the changes
	foundModified := false
	for _, change := range diff.Changes {
		if change.X == 0 && change.Y == 0 {
			foundModified = true
			if change.Cell.Char != 'X' {
				t.Errorf("Modified cell char = %c, want 'X'", change.Cell.Char)
			}
			break
		}
	}

	if !foundModified {
		t.Error("Modified cell (0,0) not found in diff changes")
	}
}

// TestStateManager_generateDiffFromVersion_ReturnsFullState tests full state diff generation
func TestStateManager_generateDiffFromVersion_ReturnsFullState_WithAllCells(t *testing.T) {
	sm := NewStateManager()

	// Create and set a state
	state := &GameState{
		Width:     2,
		Height:    2,
		CursorX:   1,
		CursorY:   1,
		Version:   5,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(2, 2),
	}
	state.Buffer[0][0] = Cell{Char: 'A', FgColor: "#ff0000"}
	state.Buffer[1][1] = Cell{Char: 'B', FgColor: "#00ff00"}

	sm.UpdateState(state)

	// Generate diff from old version
	diff, err := sm.generateDiffFromVersion(1)

	if err != nil {
		t.Fatalf("generateDiffFromVersion() error = %v", err)
	}

	if diff == nil {
		t.Fatal("generateDiffFromVersion() returned nil")
	}

	// Should have all cells (2x2 = 4 cells)
	expectedChanges := 2 * 2
	if len(diff.Changes) != expectedChanges {
		t.Errorf("Diff has %d changes, want %d", len(diff.Changes), expectedChanges)
	}

	// Verify specific cells are present
	cellMap := make(map[string]Cell)
	for _, change := range diff.Changes {
		key := fmt.Sprintf("%d,%d", change.X, change.Y)
		cellMap[key] = change.Cell
	}

	if cell, exists := cellMap["0,0"]; !exists || cell.Char != 'A' {
		t.Error("Cell (0,0) with char 'A' not found in diff")
	}

	if cell, exists := cellMap["1,1"]; !exists || cell.Char != 'B' {
		t.Error("Cell (1,1) with char 'B' not found in diff")
	}
}

// TestStateManager_PollChanges_WaiterNotification tests actual waiter notification during polling
func TestStateManager_PollChanges_WaiterNotification_ReceivesUpdate(t *testing.T) {
	sm := NewStateManager()

	// Set up initial state
	sm.UpdateState(createTestGameState(1))

	// Start polling in a goroutine
	resultCh := make(chan *StateDiff, 1)
	errorCh := make(chan error, 1)

	go func() {
		diff, err := sm.PollChanges(1, 1*time.Second) // Poll for version 1 (current)
		if err != nil {
			errorCh <- err
			return
		}
		resultCh <- diff
	}()

	// Give the goroutine time to set up the waiter
	time.Sleep(50 * time.Millisecond)

	// Update state to trigger notification
	newState := createTestGameState(2)
	newState.Buffer[0][0] = Cell{Char: 'X', FgColor: "#ff0000"}
	sm.UpdateState(newState)

	// Wait for result
	select {
	case diff := <-resultCh:
		if diff == nil {
			t.Error("PollChanges() returned nil diff")
		} else if diff.Version != 2 {
			t.Errorf("Received diff version = %d, want 2", diff.Version)
		}
	case err := <-errorCh:
		t.Fatalf("PollChanges() error = %v", err)
	case <-time.After(2 * time.Second):
		t.Error("PollChanges() did not return within timeout")
	}
}

// Helper functions for test setup

// createTestBuffer creates a test buffer with given dimensions
func createTestBuffer(height, width int) [][]Cell {
	buffer := make([][]Cell, height)
	for y := 0; y < height; y++ {
		buffer[y] = make([]Cell, width)
		for x := 0; x < width; x++ {
			buffer[y][x] = Cell{
				Char:    ' ',
				FgColor: "#ffffff",
				BgColor: "#000000",
			}
		}
	}
	return buffer
}

// createTestGameState creates a test game state with specified version
func createTestGameState(version uint64) *GameState {
	return &GameState{
		Width:     80,
		Height:    24,
		CursorX:   0,
		CursorY:   0,
		Version:   version,
		Timestamp: time.Now().Unix(),
		Buffer:    createTestBuffer(24, 80),
	}
}
