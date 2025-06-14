package webui

import (
	"context"
	"image"
	"image/color"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestTilesetService_NewTilesetService tests service initialization
func TestTilesetService_NewTilesetService(t *testing.T) {
	// Create mock WebUI and handler
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}

	service := NewTilesetService(handler)

	if service == nil {
		t.Fatal("NewTilesetService returned nil")
	}

	if service.handler != handler {
		t.Error("Service handler not set correctly")
	}

	if service.imageCache == nil {
		t.Error("Image cache not initialized")
	}

	if service.watchedPaths == nil {
		t.Error("Watched paths not initialized")
	}

	if !service.enableImageOptimization {
		t.Error("Image optimization should be enabled by default")
	}

	if service.maxCacheSize != 50 {
		t.Errorf("Expected maxCacheSize to be 50, got %d", service.maxCacheSize)
	}

	if service.cacheDuration != 1*time.Hour {
		t.Errorf("Expected cacheDuration to be 1 hour, got %v", service.cacheDuration)
	}
}

// TestTilesetService_Fetch tests basic tileset fetching
func TestTilesetService_Fetch(t *testing.T) {
	// Create test tileset
	tileset := DefaultTilesetConfig()

	// Create mock WebUI with tileset
	webui := &WebUI{tileset: tileset}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	// Create mock request
	req := httptest.NewRequest("POST", "/rpc", nil)

	var result map[string]interface{}
	params := struct{}{}

	err := service.Fetch(req, &params, &result)
	if err != nil {
		t.Fatalf("Fetch returned error: %v", err)
	}

	// Verify result structure
	if result["tileset"] == nil {
		t.Error("Result should contain tileset")
	}

	if imageAvailable, ok := result["image_available"].(bool); !ok {
		t.Error("Result should contain image_available as bool")
	} else if imageAvailable {
		t.Error("Default tileset should not have image data")
	}

	if result["metadata"] == nil {
		t.Error("Result should contain metadata")
	}

	if result["capabilities"] == nil {
		t.Error("Result should contain capabilities")
	}

	if result["cache_status"] == nil {
		t.Error("Result should contain cache_status")
	}
}

// TestTilesetService_Fetch_NoTileset tests fetch with no tileset loaded
func TestTilesetService_Fetch_NoTileset(t *testing.T) {
	// Create mock WebUI without tileset
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	var result map[string]interface{}
	params := struct{}{}

	err := service.Fetch(req, &params, &result)
	if err != nil {
		t.Fatalf("Fetch returned error: %v", err)
	}

	// Verify nil tileset handling
	if result["tileset"] != nil {
		t.Error("Result should contain nil tileset")
	}

	if imageAvailable, ok := result["image_available"].(bool); !ok || imageAvailable {
		t.Error("Result should indicate no image available")
	}
}

// TestTilesetService_Update_WithPath tests tileset update from file path
func TestTilesetService_Update_WithPath(t *testing.T) {
	// Create temporary tileset file
	tempDir := t.TempDir()
	tilesetPath := filepath.Join(tempDir, "test.yaml")

	tilesetContent := `tileset:
  name: "Test Tileset"
  version: "1.0"
  tile_width: 16
  tile_height: 16
  source_image: "test.png"
  mappings:
    - char: "@"
      x: 0
      y: 0
`

	err := os.WriteFile(tilesetPath, []byte(tilesetContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test tileset file: %v", err)
	}

	// Create a simple test image
	// imagePath := filepath.Join(tempDir, "test.png")
	testImg := image.NewRGBA(image.Rect(0, 0, 32, 32)) // 2x2 tiles at 16x16 each
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			testImg.Set(x, y, color.RGBA{255, 255, 255, 255})
		}
	}

	// We'll skip the actual PNG encoding for this test since it would require more setup
	// In practice, you'd use png.Encode(file, testImg)

	// Create mock WebUI
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	params := &TilesetUpdateParams{
		Path: tilesetPath,
	}

	var result map[string]interface{}

	// This will fail because we don't have the actual image file, but we can test the path handling
	err = service.Update(req, params, &result)
	if err == nil {
		t.Error("Expected error due to missing image file")
	}

	// Check that the error is about the image file, not the YAML parsing
	if !containsString(err.Error(), "image file does not exist") &&
		!containsString(err.Error(), "failed to load tileset from path") {
		t.Errorf("Unexpected error: %v", err)
	}
}

// TestTilesetService_Update_InvalidPath tests update with invalid path
func TestTilesetService_Update_InvalidPath(t *testing.T) {
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	params := &TilesetUpdateParams{
		Path: "/nonexistent/path/tileset.yaml",
	}

	var result map[string]interface{}

	err := service.Update(req, params, &result)
	if err == nil {
		t.Error("Expected error for nonexistent path")
	}

	if !containsString(err.Error(), "failed to load tileset from path") {
		t.Errorf("Expected path loading error, got: %v", err)
	}
}

// TestTilesetService_Update_NoParams tests update with no parameters
func TestTilesetService_Update_NoParams(t *testing.T) {
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	params := &TilesetUpdateParams{}

	var result map[string]interface{}

	err := service.Update(req, params, &result)
	if err == nil {
		t.Error("Expected error for empty parameters")
	}

	if !containsString(err.Error(), "either path or config must be provided") {
		t.Errorf("Expected parameter validation error, got: %v", err)
	}
}

// TestTilesetService_List tests tileset listing functionality
func TestTilesetService_List(t *testing.T) {
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	var result TilesetListResponse
	params := struct{}{}

	err := service.List(req, &params, &result)
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}

	// Verify result structure
	if result.Tilesets == nil {
		t.Error("Result should contain tilesets slice")
	}

	// The list might be empty since we don't have actual tileset files
	// but it should not be nil
}

// TestTilesetService_ProcessImage_NoTileset tests image processing without tileset
func TestTilesetService_ProcessImage_NoTileset(t *testing.T) {
	webui := &WebUI{}
	handler := &RPCHandler{webui: webui}
	service := NewTilesetService(handler)

	req := httptest.NewRequest("POST", "/rpc", nil)

	params := &struct {
		Options ProcessingOptions `json:"options"`
	}{
		Options: ProcessingOptions{
			OptimizeColors: true,
		},
	}

	var result map[string]interface{}

	err := service.ProcessImage(req, params, &result)
	if err == nil {
		t.Error("Expected error when no tileset is loaded")
	}

	if !containsString(err.Error(), "no tileset loaded") {
		t.Errorf("Expected 'no tileset loaded' error, got: %v", err)
	}
}

// TestTilesetService_ImageProcessing tests various image processing operations
func TestTilesetService_ImageProcessing(t *testing.T) {
	service := &TilesetService{}

	// Create test image
	testImg := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			testImg.Set(x, y, color.RGBA{128, 128, 128, 255})
		}
	}

	// Test color optimization
	service.optimizeColors(testImg)

	// Verify the color was quantized
	c := testImg.RGBAAt(0, 0)
	if c.R != 128 || c.G != 128 || c.B != 128 {
		// Colors should be quantized to nearest multiple of 32
		expectedR := (128 / 32) * 32
		if c.R != uint8(expectedR) {
			t.Errorf("Color optimization failed: expected R=%d, got R=%d", expectedR, c.R)
		}
	}

	// Test contrast adjustment
	service.adjustContrast(testImg, 1.5)

	// Test sharpening
	service.applySharpen(testImg)

	// Test transparency removal
	testImgWithAlpha := image.NewRGBA(image.Rect(0, 0, 2, 2))
	testImgWithAlpha.Set(0, 0, color.RGBA{255, 0, 0, 128}) // Semi-transparent red

	service.removeTransparency(testImgWithAlpha, color.RGBA{255, 255, 255, 255}) // White background

	// Verify alpha was removed
	processedColor := testImgWithAlpha.RGBAAt(0, 0)
	if processedColor.A != 255 {
		t.Errorf("Transparency removal failed: alpha should be 255, got %d", processedColor.A)
	}
}

// TestTilesetService_ImageAnalysis tests image analysis functions
func TestTilesetService_ImageAnalysis(t *testing.T) {
	service := &TilesetService{}

	// Test alpha channel detection
	solidImg := image.NewRGBA(image.Rect(0, 0, 2, 2))
	solidImg.Set(0, 0, color.RGBA{255, 0, 0, 255})
	solidImg.Set(1, 0, color.RGBA{0, 255, 0, 255})
	solidImg.Set(0, 1, color.RGBA{0, 0, 255, 255})
	solidImg.Set(1, 1, color.RGBA{255, 255, 0, 255})

	if service.hasAlphaChannel(solidImg) {
		t.Error("Solid image should not have alpha channel")
	}

	transparentImg := image.NewRGBA(image.Rect(0, 0, 2, 2))
	transparentImg.Set(0, 0, color.RGBA{255, 0, 0, 128}) // Semi-transparent
	transparentImg.Set(1, 0, color.RGBA{0, 255, 0, 255})

	if !service.hasAlphaChannel(transparentImg) {
		t.Error("Transparent image should have alpha channel")
	}

	// Test color depth analysis
	depth := service.analyzeColorDepth(solidImg)
	if depth < 4 { // Should detect at least 4-bit color depth for 4 colors
		t.Errorf("Color depth analysis failed: expected at least 4-bit, got %d-bit", depth)
	}

	// Test dominant colors
	dominantColors := service.getDominantColors(solidImg, 3)
	if len(dominantColors) == 0 {
		t.Error("Should find at least some dominant colors")
	}

	// Verify color format
	for _, colorStr := range dominantColors {
		if len(colorStr) != 7 || colorStr[0] != '#' {
			t.Errorf("Invalid color format: %s", colorStr)
		}
	}
}

// TestTilesetService_CacheManagement tests cache functionality
func TestTilesetService_CacheManagement(t *testing.T) {
	service := NewTilesetService(&RPCHandler{})

	// Test cache empty initially
	cached := service.getCachedImage("test-key")
	if cached != nil {
		t.Error("Cache should be empty initially")
	}

	// Create test image
	testImg := image.NewRGBA(image.Rect(0, 0, 2, 2))

	// Cache the image
	service.cacheProcessedImage("test-key", testImg)

	// Verify it's cached
	cached = service.getCachedImage("test-key")
	if cached == nil {
		t.Error("Image should be cached")
	}

	if cached.Image != testImg {
		t.Error("Cached image doesn't match original")
	}

	// Test cache expiration (simulate)
	cached.ProcessedAt = time.Now().Add(-2 * time.Hour) // Make it expired

	// Should return nil for expired entry
	expired := service.getCachedImage("test-key")
	if expired != nil {
		t.Error("Expired cache entry should be removed")
	}
}

// TestTilesetService_WatchedPaths tests path watching functionality
func TestTilesetService_WatchedPaths(t *testing.T) {
	service := NewTilesetService(&RPCHandler{})

	// Test adding watched path
	testPath := "/test/path/tileset.yaml"
	service.addWatchedPath(testPath)

	if _, exists := service.watchedPaths[testPath]; !exists {
		t.Error("Path should be added to watched paths")
	}

	// Test checkForChanges with non-existent path
	service.checkForChanges() // Should not panic

	// The actual file change detection would require real files
	// so we just test that the method doesn't crash
}

// TestTilesetService_HotReload tests hot-reload monitoring
func TestTilesetService_HotReload(t *testing.T) {
	service := NewTilesetService(&RPCHandler{})

	// Test that hot-reload can be started and stopped
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := service.StartHotReload(ctx)
	if err != context.DeadlineExceeded && err != context.Canceled {
		t.Errorf("Expected context cancellation, got: %v", err)
	}
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
