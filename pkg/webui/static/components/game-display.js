/**
 * @fileoverview Main game display component for terminal-based game rendering with canvas support
 * @module components/game-display
 * @requires utils/logger
 * @requires services/game-client
 * @requires components/connection-status
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";
import { GameClient, ConnectionState } from "../services/game-client.js";
import {
  ConnectionStatus,
  StatusState
} from "../components/connection-status.js";

/**
 * @enum {string}
 * @readonly
 * @description Display rendering modes for game content
 */
const RenderMode = {
  TEXT: "text",
  TILESET: "tileset",
  HYBRID: "hybrid"
};

/**
 * @enum {string}
 * @readonly
 * @description Font rendering styles for terminal display
 */
const FontStyle = {
  MONOSPACE: "monospace",
  BITMAP: "bitmap",
  VECTOR: "vector"
};

/**
 * @class ViewportManager
 * @description Manages viewport scaling, scrolling, and display adaptation for game content
 */
class ViewportManager {
  /**
   * Creates a new ViewportManager instance
   * @param {HTMLCanvasElement} canvas - Canvas element to manage
   * @param {Object} [options={}] - Viewport configuration options
   * @param {number} [options.minScale=0.5] - Minimum scaling factor
   * @param {number} [options.maxScale=3.0] - Maximum scaling factor
   * @param {boolean} [options.allowScroll=true] - Whether to allow viewport scrolling
   * @param {boolean} [options.autoResize=true] - Whether to auto-resize to fit content
   */
  constructor(canvas, options = {}) {
    this.logger = createLogger("ViewportManager", LogLevel.DEBUG);

    this.canvas = canvas;
    this.options = {
      minScale: options.minScale || 0.5,
      maxScale: options.maxScale || 3.0,
      allowScroll: options.allowScroll !== false,
      autoResize: options.autoResize !== false,
      ...options
    };

    // Viewport state
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;

    // Content dimensions
    this.contentWidth = 0;
    this.contentHeight = 0;
    this.cellWidth = 12;
    this.cellHeight = 16;

    // Event handling
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this._setupEventListeners();
    this._updateViewport();

    this.logger.info("constructor", "Viewport manager initialized", {
      allowScroll: this.options.allowScroll,
      autoResize: this.options.autoResize
    });
  }

  /**
   * Sets up event listeners for viewport interaction
   * @private
   */
  _setupEventListeners() {
    // Mouse wheel for zooming
    this.canvas.addEventListener(
      "wheel",
      event => {
        if (event.ctrlKey) {
          event.preventDefault();
          this._handleZoom(event);
        } else if (this.options.allowScroll) {
          event.preventDefault();
          this._handleScroll(event);
        }
      },
      { passive: false }
    );

    // Mouse drag for panning
    this.canvas.addEventListener("mousedown", event => {
      if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
        // Middle mouse or Ctrl+left
        event.preventDefault();
        this._startDrag(event);
      }
    });

    this.canvas.addEventListener("mousemove", event => {
      if (this.isDragging) {
        event.preventDefault();
        this._handleDrag(event);
      }
    });

    this.canvas.addEventListener("mouseup", event => {
      if (this.isDragging) {
        event.preventDefault();
        this._endDrag(event);
      }
    });

    // Window resize handling
    window.addEventListener("resize", () => {
      this._updateViewport();
    });

    this.logger.debug(
      "_setupEventListeners",
      "Viewport event listeners attached"
    );
  }

  /**
   * Handles zoom events from mouse wheel
   * @param {WheelEvent} event - Mouse wheel event
   * @private
   */
  _handleZoom(event) {
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(
      this.options.minScale,
      Math.min(this.options.maxScale, this.scale * zoomFactor)
    );

    if (newScale !== this.scale) {
      // Zoom towards mouse position
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      this._setScale(newScale, mouseX, mouseY);
      this.logger.debug("_handleZoom", `Zoom: ${this.scale.toFixed(2)}x`);
    }
  }

  /**
   * Handles scroll events for viewport panning
   * @param {WheelEvent} event - Mouse wheel event
   * @private
   */
  _handleScroll(event) {
    const scrollSpeed = 20;
    this.offsetX -= event.deltaX * scrollSpeed / this.scale;
    this.offsetY -= event.deltaY * scrollSpeed / this.scale;
    this._constrainOffset();
  }

  /**
   * Starts drag operation for viewport panning
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _startDrag(event) {
    this.isDragging = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.canvas.style.cursor = "grabbing";
  }

  /**
   * Handles drag movement for viewport panning
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleDrag(event) {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    this.offsetX += deltaX / this.scale;
    this.offsetY += deltaY / this.scale;
    this._constrainOffset();

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  /**
   * Ends drag operation
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _endDrag(event) {
    this.isDragging = false;
    this.canvas.style.cursor = "default";
  }

  /**
   * Sets the viewport scale with optional focus point
   * @param {number} newScale - New scale factor
   * @param {number} [focusX] - X coordinate to zoom towards
   * @param {number} [focusY] - Y coordinate to zoom towards
   * @private
   */
  _setScale(newScale, focusX, focusY) {
    if (focusX !== undefined && focusY !== undefined) {
      // Adjust offset to zoom towards focus point
      const scaleDelta = newScale / this.scale;
      this.offsetX =
        focusX / newScale - (focusX / this.scale - this.offsetX) * scaleDelta;
      this.offsetY =
        focusY / newScale - (focusY / this.scale - this.offsetY) * scaleDelta;
    }

    this.scale = newScale;
    this._constrainOffset();
  }

  /**
   * Constrains viewport offset to valid bounds
   * @private
   */
  _constrainOffset() {
    const maxOffsetX = Math.max(
      0,
      this.contentWidth - this.viewportWidth / this.scale
    );
    const maxOffsetY = Math.max(
      0,
      this.contentHeight - this.viewportHeight / this.scale
    );

    this.offsetX = Math.max(0, Math.min(maxOffsetX, this.offsetX));
    this.offsetY = Math.max(0, Math.min(maxOffsetY, this.offsetY));
  }

  /**
   * Updates viewport dimensions and constraints
   * @private
   */
  _updateViewport() {
    const rect = this.canvas.getBoundingClientRect();
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;

    if (
      this.options.autoResize &&
      this.contentWidth > 0 &&
      this.contentHeight > 0
    ) {
      this._autoFitContent();
    }

    this._constrainOffset();
  }

  /**
   * Automatically fits content to viewport
   * @private
   */
  _autoFitContent() {
    const scaleX = this.viewportWidth / this.contentWidth;
    const scaleY = this.viewportHeight / this.contentHeight;
    const autoScale = Math.min(scaleX, scaleY);

    if (
      autoScale >= this.options.minScale &&
      autoScale <= this.options.maxScale
    ) {
      this.scale = autoScale;
      this.offsetX = Math.max(
        0,
        (this.contentWidth - this.viewportWidth / this.scale) / 2
      );
      this.offsetY = Math.max(
        0,
        (this.contentHeight - this.viewportHeight / this.scale) / 2
      );
    }
  }

  /**
   * Updates content dimensions
   * @param {number} width - Content width in pixels
   * @param {number} height - Content height in pixels
   * @param {number} [cellWidth] - Width of individual cells
   * @param {number} [cellHeight] - Height of individual cells
   */
  updateContent(width, height, cellWidth, cellHeight) {
    this.contentWidth = width;
    this.contentHeight = height;

    if (cellWidth !== undefined) this.cellWidth = cellWidth;
    if (cellHeight !== undefined) this.cellHeight = cellHeight;

    this._updateViewport();

    this.logger.debug("updateContent", `Content updated: ${width}x${height}`);
  }

  /**
   * Converts screen coordinates to content coordinates
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @returns {Object} Content coordinates {x, y}
   */
  screenToContent(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    return {
      x: canvasX / this.scale + this.offsetX,
      y: canvasY / this.scale + this.offsetY
    };
  }

  /**
   * Converts content coordinates to screen coordinates
   * @param {number} contentX - Content X coordinate
   * @param {number} contentY - Content Y coordinate
   * @returns {Object} Screen coordinates {x, y}
   */
  contentToScreen(contentX, contentY) {
    return {
      x: (contentX - this.offsetX) * this.scale,
      y: (contentY - this.offsetY) * this.scale
    };
  }

  /**
   * Gets current viewport transformation matrix
   * @returns {Object} Transformation parameters
   */
  getTransform() {
    return {
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight
    };
  }

  /**
   * Resets viewport to default state
   */
  reset() {
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this._updateViewport();

    this.logger.debug("reset", "Viewport reset to defaults");
  }
}

/**
 * @class TerminalRenderer
 * @description Handles low-level terminal rendering with multiple display modes and optimizations
 */
class TerminalRenderer {
  /**
   * Creates a new TerminalRenderer instance
   * @param {HTMLCanvasElement} canvas - Canvas element for rendering
   * @param {Object} [options={}] - Renderer configuration options
   * @param {string} [options.mode=RenderMode.TEXT] - Default rendering mode
   * @param {string} [options.fontStyle=FontStyle.MONOSPACE] - Font rendering style
   * @param {number} [options.fontSize=14] - Base font size in pixels
   * @param {string} [options.fontFamily='Consolas, Monaco, monospace'] - Font family
   * @param {boolean} [options.antialiasing=false] - Whether to enable font antialiasing
   */
  constructor(canvas, options = {}) {
    this.logger = createLogger("TerminalRenderer", LogLevel.DEBUG);

    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.options = {
      mode: options.mode || RenderMode.TEXT,
      fontStyle: options.fontStyle || FontStyle.MONOSPACE,
      fontSize: options.fontSize || 14,
      fontFamily: options.fontFamily || "Consolas, Monaco, monospace",
      antialiasing: options.antialiasing === true,
      ...options
    };

    // Rendering state
    this.cellWidth = 0;
    this.cellHeight = 0;
    this.currentTileset = null;
    this.fontMetrics = null;

    // Performance tracking
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.averageFrameTime = 0;
    this.renderStats = {
      cellsRendered: 0,
      tilesUsed: 0,
      textChars: 0
    };

    // Performance optimizations
    this.dirtyRegions = new Set(); // Track dirty cells for partial updates
    this.renderCache = new Map(); // Cache rendered cell data
    this.maxCacheSize = 1000;
    this.lastFrameTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;

    this._initializeRenderer();

    this.logger.info("constructor", "Terminal renderer initialized", {
      mode: this.options.mode,
      fontSize: this.options.fontSize
    });
  }

  /**
   * Initializes renderer settings and font metrics
   * @private
   */
  _initializeRenderer() {
    // Configure canvas context
    this.context.imageSmoothingEnabled = this.options.antialiasing;
    this.context.textBaseline = "top";

    // Calculate font metrics
    this._calculateFontMetrics();

    this.logger.debug(
      "_initializeRenderer",
      "Renderer initialization complete",
      {
        cellSize: `${this.cellWidth}x${this.cellHeight}`
      }
    );
  }

  /**
   * Calculates font metrics for character cell sizing
   * @private
   */
  _calculateFontMetrics() {
    const font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    this.context.font = font;

    // Measure character dimensions using a representative character
    const metrics = this.context.measureText("M");
    this.cellWidth = Math.ceil(metrics.width);
    this.cellHeight = Math.ceil(this.options.fontSize * 1.2); // Add line spacing

    this.fontMetrics = {
      font: font,
      width: this.cellWidth,
      height: this.cellHeight,
      baseline: Math.ceil(this.options.fontSize * 0.1)
    };

    this.logger.debug(
      "_calculateFontMetrics",
      "Font metrics calculated",
      this.fontMetrics
    );
  }

  /**
   * Sets the tileset for tileset-based rendering
   * @param {Tileset} tileset - Tileset instance to use
   */
  setTileset(tileset) {
    this.currentTileset = tileset;

    if (tileset && tileset.imageLoaded) {
      // Update cell dimensions based on tileset
      this.cellWidth = tileset.tile_width;
      this.cellHeight = tileset.tile_height;

      this.logger.info("setTileset", `Tileset configured: ${tileset.name}`, {
        tileSize: `${this.cellWidth}x${this.cellHeight}`
      });
    } else {
      this.logger.warn("setTileset", "Invalid or unloaded tileset provided");
    }
  }

  /**
   * Gets the current cell dimensions
   * @returns {Object} Cell dimensions {width, height}
   */
  getCellDimensions() {
    return {
      width: this.cellWidth,
      height: this.cellHeight
    };
  }

  /**
   * Gets performance statistics for monitoring
   * @returns {Object} Performance metrics
   */
  getPerformanceStats() {
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const fps = timeSinceLastFrame > 0 ? 1000 / timeSinceLastFrame : 0;

    return {
      fps: Math.min(fps, this.targetFPS),
      lastFrameTime: timeSinceLastFrame,
      averageFrameTime: this.averageFrameTime,
      frameCount: this.frameCount,
      renderStats: { ...this.renderStats },
      cacheSize: this.renderCache.size,
      dirtyRegions: this.dirtyRegions.size
    };
  }

  /**
   * Renders a complete game state to the canvas with dirty region optimization
   * @param {GameState} gameState - Game state to render
   * @param {Object} [transform] - Viewport transformation parameters
   */
  render(gameState, transform = null) {
    if (!gameState) {
      this.logger.warn("render", "No game state provided for rendering");
      return;
    }

    const now = performance.now();
    
    // Frame rate limiting
    if (now - this.lastFrameTime < this.frameInterval) {
      return; // Skip frame to maintain target FPS
    }

    const startTime = now;
    this.frameCount++;

    // Reset render statistics
    this.renderStats = { cellsRendered: 0, tilesUsed: 0, textChars: 0 };

    try {
      // Apply viewport transformation if provided
      if (transform) {
        this._applyTransform(transform);
      }

      // Only clear dirty regions instead of entire canvas
      if (this.dirtyRegions.size > 0) {
        this._clearDirtyRegions(gameState);
        this._renderDirtyRegions(gameState);
      } else {
        // Full render on first frame or when no dirty tracking
        this._clearCanvas(gameState);
        this._renderGameContent(gameState);
      }

      // Render cursor if visible
      if (gameState.cursor && gameState.cursor.visible) {
        this._renderCursor(gameState);
      }

      // Restore transformation
      if (transform) {
        this.context.restore();
      }

      // Update performance metrics
      const frameTime = performance.now() - startTime;
      this._updatePerformanceMetrics(frameTime);
      this.lastFrameTime = now;

      this.logger.debug(
        "render",
        `Frame rendered in ${frameTime.toFixed(2)}ms`,
        this.renderStats
      );
    } catch (error) {
      this.logger.error("render", "Rendering failed", error);
    }
  }

  /**
   * Clears only dirty regions of the canvas
   * @param {GameState} gameState - Game state for background color
   * @private
   */
  _clearDirtyRegions(gameState) {
    this.context.fillStyle = "#000000";
    
    for (const regionKey of this.dirtyRegions) {
      const [x, y] = regionKey.split(',').map(Number);
      const pixelX = x * this.cellWidth;
      const pixelY = y * this.cellHeight;
      
      this.context.fillRect(pixelX, pixelY, this.cellWidth, this.cellHeight);
    }
  }

  /**
   * Renders only dirty regions of the game content
   * @param {GameState} gameState - Game state to render
   * @private
   */
  _renderDirtyRegions(gameState) {
    const buffer = gameState.buffer;
    if (!buffer || !buffer.length) {
      return;
    }

    const useTileset =
      (this.options.mode === RenderMode.TILESET ||
        this.options.mode === RenderMode.HYBRID) &&
      this.currentTileset &&
      this.currentTileset.imageLoaded;

    for (const regionKey of this.dirtyRegions) {
      const [x, y] = regionKey.split(',').map(Number);
      
      if (x < gameState.width && y < gameState.height) {
        const cell = gameState.getCell(x, y);
        if (cell) {
          this._renderCell(x, y, cell, useTileset);
          this.renderStats.cellsRendered++;
        }
      }
    }

    // Clear dirty regions after rendering
    this.dirtyRegions.clear();
  }

  /**
   * Marks a cell region as dirty for next render
   * @param {number} x - Cell X coordinate
   * @param {number} y - Cell Y coordinate
   */
  markDirty(x, y) {
    this.dirtyRegions.add(`${x},${y}`);
  }

  /**
   * Renders a single game cell with caching
   * @param {number} x - Cell X coordinate
   * @param {number} y - Cell Y coordinate
   * @param {GameCell} cell - Cell data to render
   * @param {boolean} useTileset - Whether to attempt tileset rendering
   * @private
   */
  _renderCell(x, y, cell, useTileset) {
    const pixelX = x * this.cellWidth;
    const pixelY = y * this.cellHeight;

    // Generate cache key for this cell
    const cacheKey = this._generateCellCacheKey(cell);
    
    // Check render cache first
    let cachedRender = this.renderCache.get(cacheKey);
    if (cachedRender) {
      // Use cached render data
      this._applyCachedRender(pixelX, pixelY, cachedRender);
      return;
    }

    // Render background if not default
    if (cell.bg_color && cell.bg_color !== "#000000") {
      this._renderCellBackground(pixelX, pixelY, cell.bg_color);
    }

    // Choose rendering method and cache result
    if (useTileset && cell.hasTileCoordinates()) {
      const rendered = this._renderTilesetCell(pixelX, pixelY, cell);
      if (rendered) {
        this.renderStats.tilesUsed++;
        this._cacheRender(cacheKey, 'tileset', cell);
        return;
      }
    }

    // Fall back to text rendering
    this._renderTextCell(pixelX, pixelY, cell);
    this._cacheRender(cacheKey, 'text', cell);
    this.renderStats.textChars++;
  }

  /**
   * Generates a cache key for a cell
   * @param {GameCell} cell - Cell to generate key for
   * @returns {string} Cache key
   * @private
   */
  _generateCellCacheKey(cell) {
    return `${cell.getDisplayChar()}_${cell.fg_color}_${cell.bg_color}_${cell.bold}_${cell.inverse}_${cell.tile_x}_${cell.tile_y}`;
  }

  /**
   * Caches render data for a cell
   * @param {string} cacheKey - Cache key
   * @param {string} renderType - Type of render (text/tileset)
   * @param {GameCell} cell - Original cell data
   * @private
   */
  _cacheRender(cacheKey, renderType, cell) {
    // Implement LRU cache eviction
    if (this.renderCache.size >= this.maxCacheSize) {
      const firstKey = this.renderCache.keys().next().value;
      this.renderCache.delete(firstKey);
    }

    this.renderCache.set(cacheKey, {
      type: renderType,
      timestamp: Date.now(),
      // Store minimal data needed for re-rendering
      char: cell.getDisplayChar(),
      fgColor: cell.fg_color,
      bgColor: cell.bg_color,
      tileX: cell.tile_x,
      tileY: cell.tile_y
    });
  }

  /**
   * Applies cached render data
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @param {Object} cachedRender - Cached render data
   * @private
   */
  _applyCachedRender(pixelX, pixelY, cachedRender) {
    // This is a simplified version - in practice you'd want to
    // cache actual ImageData or rendering commands
    if (cachedRender.type === 'tileset' && this.currentTileset) {
      const sprite = this.currentTileset.getSprite(cachedRender.tileX, cachedRender.tileY);
      if (sprite) {
        const sourceCoords = sprite.getPixelCoordinates(
          this.currentTileset.tile_width,
          this.currentTileset.tile_height
        );
        
        this.context.drawImage(
          this.currentTileset.imageElement,
          sourceCoords.x, sourceCoords.y, sourceCoords.width, sourceCoords.height,
          pixelX, pixelY, this.cellWidth, this.cellHeight
        );
      }
    } else {
      // Re-render text (could be optimized further with pre-rendered glyphs)
      this._renderTextCharacter(pixelX, pixelY, cachedRender.char, 
                               cachedRender.fgColor, cachedRender.bgColor);
    }
  }

  /**
   * Renders a single text character (extracted for caching)
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {string} char - Character to render
   * @param {string} fgColor - Foreground color
   * @param {string} bgColor - Background color
   * @private
   */
  _renderTextCharacter(x, y, char, fgColor, bgColor) {
    if (!char || char === " ") {
      return;
    }

    // Render background
    if (bgColor && bgColor !== "#000000") {
      this.context.fillStyle = bgColor;
      this.context.fillRect(x, y, this.cellWidth, this.cellHeight);
    }

    // Set text properties
    this.context.fillStyle = fgColor || "#FFFFFF";
    this.context.font = this.fontMetrics.font;

    // Center character in cell
    const textMetrics = this.context.measureText(char);
    const textX = x + (this.cellWidth - textMetrics.width) / 2;
    const textY = y + this.fontMetrics.baseline;

    this.context.fillText(char, textX, textY);
  }

  /**
   * Clears the entire canvas with optional background color
   * @param {GameState} gameState - Game state for styling context
   * @private
   */
  _clearCanvas(gameState) {
    this.context.fillStyle = "#000000";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Renders the complete game content
   * @param {GameState} gameState - Game state to render
   * @private
   */
  _renderGameContent(gameState) {
    const buffer = gameState.buffer;
    if (!buffer || !buffer.length) {
      return;
    }

    const useTileset =
      (this.options.mode === RenderMode.TILESET ||
        this.options.mode === RenderMode.HYBRID) &&
      this.currentTileset &&
      this.currentTileset.imageLoaded;

    for (let y = 0; y < gameState.height; y++) {
      for (let x = 0; x < gameState.width; x++) {
        const cell = gameState.getCell(x, y);
        if (cell && !cell.isEmpty()) {
          this._renderCell(x, y, cell, useTileset);
          this.renderStats.cellsRendered++;
        }
      }
    }
  }

  /**
   * Renders the cursor at its current position
   * @param {GameState} gameState - Game state containing cursor information
   * @private
   */
  _renderCursor(gameState) {
    if (!gameState.cursor || !gameState.cursor.visible) {
      return;
    }

    const cursorX = gameState.cursor.x * this.cellWidth;
    const cursorY = gameState.cursor.y * this.cellHeight;

    // Simple cursor rendering - can be enhanced with blinking
    this.context.strokeStyle = "#ffffff";
    this.context.lineWidth = 2;
    this.context.strokeRect(cursorX, cursorY, this.cellWidth, this.cellHeight);
  }

  /**
   * Applies viewport transformation to the canvas context
   * @param {Object} transform - Transformation parameters
   * @private
   */
  _applyTransform(transform) {
    this.context.save();
    this.context.scale(transform.scale, transform.scale);
    this.context.translate(-transform.offsetX, -transform.offsetY);
  }

  /**
   * Updates performance metrics
   * @param {number} frameTime - Time taken for current frame
   * @private
   */
  _updatePerformanceMetrics(frameTime) {
    // Calculate rolling average frame time
    this.averageFrameTime = this.averageFrameTime === 0 
      ? frameTime 
      : (this.averageFrameTime * 0.9 + frameTime * 0.1);
  }

  /**
   * Renders cell background
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @param {string} bgColor - Background color
   * @private
   */
  _renderCellBackground(pixelX, pixelY, bgColor) {
    this.context.fillStyle = bgColor;
    this.context.fillRect(pixelX, pixelY, this.cellWidth, this.cellHeight);
  }

  /**
   * Renders a tileset-based cell
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @param {GameCell} cell - Cell to render
   * @returns {boolean} True if successfully rendered
   * @private
   */
  _renderTilesetCell(pixelX, pixelY, cell) {
    if (!this.currentTileset || !cell.hasTileCoordinates()) {
      return false;
    }

    const sprite = this.currentTileset.getSprite(cell.tile_x, cell.tile_y);
    if (!sprite) {
      return false;
    }

    const sourceCoords = sprite.getPixelCoordinates(
      this.currentTileset.tile_width,
      this.currentTileset.tile_height
    );

    try {
      this.context.drawImage(
        this.currentTileset.imageElement,
        sourceCoords.x, sourceCoords.y, sourceCoords.width, sourceCoords.height,
        pixelX, pixelY, this.cellWidth, this.cellHeight
      );
      return true;
    } catch (error) {
      this.logger.warn("_renderTilesetCell", "Failed to render tileset cell", error);
      return false;
    }
  }

  /**
   * Renders a text-based cell
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @param {GameCell} cell - Cell to render
   * @private
   */
  _renderTextCell(pixelX, pixelY, cell) {
    this._renderTextCharacter(
      pixelX, pixelY, 
      cell.getDisplayChar(), 
      cell.fg_color, 
      cell.bg_color
    );
  }

  /**
   * Clears render cache to free memory
   */
  clearCache() {
    this.renderCache.clear();
    this.dirtyRegions.clear();
    this.logger.debug("clearCache", "Render cache cleared");
  }
}

/**
 * @class GameDisplay
 * @description Main game display component coordinating rendering, input, and UI elements
 */
class GameDisplay {
  /**
   * Creates a new GameDisplay instance
   * @param {HTMLElement} container - Container element for the display
   * @param {Object} [options={}] - Display configuration options
   * @param {Object} [options.client] - Game client configuration
   * @param {Object} [options.renderer] - Renderer configuration
   * @param {Object} [options.viewport] - Viewport configuration
   * @param {boolean} [options.showConnectionStatus=true] - Whether to show connection status
   * @param {boolean} [options.showPerformanceStats=false] - Whether to show performance statistics
   */
  constructor(container, options = {}) {
    this.logger = createLogger("GameDisplay", LogLevel.INFO);

    this.container = container;
    this.options = {
      showConnectionStatus: options.showConnectionStatus !== false,
      showPerformanceStats: options.showPerformanceStats === true,
      ...options
    };

    // Core components
    this.gameClient = new GameClient(options.client);
    this.viewport = null;
    this.renderer = null;
    this.connectionStatus = null;

    // DOM elements
    this.element = null;
    this.canvasElement = null;
    this.performanceElement = null;

    // Rendering state
    this.isRendering = false;
    this.renderTimer = null;
    this.lastRenderTime = 0;

    // Initialize DOM structure
    this._createElement();
    this._initializeComponents();
    this._setupEventHandlers();

    this.logger.info("constructor", "Game display initialized", {
      showConnectionStatus: this.options.showConnectionStatus,
      showPerformanceStats: this.options.showPerformanceStats
    });
  }

  /**
   * Creates the main DOM structure for the display
   * @private
   */
  _createElement() {
    this.element = document.createElement("div");
    this.element.className = "game-display";

    // Apply base styles
    Object.assign(this.element.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      backgroundColor: "#000000",
      overflow: "hidden",
      fontFamily: "monospace"
    });

    // Create canvas for game rendering
    this.canvasElement = document.createElement("canvas");
    this.canvasElement.className = "game-canvas";
    Object.assign(this.canvasElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      imageRendering: "pixelated"
    });

    this.element.appendChild(this.canvasElement);

    // Add to container
    if (this.container) {
      this.container.appendChild(this.element);
    }

    this.logger.debug("_createElement", "DOM structure created");
  }

  /**
   * Initializes core components
   * @private
   */
  _initializeComponents() {
    // Initialize viewport manager
    this.viewport = new ViewportManager(
      this.canvasElement,
      this.options.viewport
    );

    // Initialize terminal renderer
    this.renderer = new TerminalRenderer(
      this.canvasElement,
      this.options.renderer
    );

    // Initialize connection status if enabled
    if (this.options.showConnectionStatus) {
      const statusContainer = document.createElement("div");
      statusContainer.className = "connection-status-container";
      Object.assign(statusContainer.style, {
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: "100"
      });

      this.connectionStatus = new ConnectionStatus({
        container: statusContainer,
        showHistory: true,
        showStatistics: this.options.showPerformanceStats
      });

      this.element.appendChild(statusContainer);
    }

    // Create performance display if enabled
    if (this.options.showPerformanceStats) {
      this._createPerformanceDisplay();
    }

    this.logger.debug("_initializeComponents", "Core components initialized");
  }

  /**
   * Creates performance statistics display
   * @private
   */
  _createPerformanceDisplay() {
    this.performanceElement = document.createElement("div");
    this.performanceElement.className = "performance-display";
    Object.assign(this.performanceElement.style, {
      position: "absolute",
      top: "10px",
      left: "10px",
      padding: "8px",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "12px",
      borderRadius: "4px",
      zIndex: "99"
    });

    this.element.appendChild(this.performanceElement);
  }

  /**
   * Sets up event handlers for component coordination
   * @private
   */
  _setupEventHandlers() {
    // Handle game client events
    this.gameClient.onStateUpdate = gameState => {
      this._handleGameStateUpdate(gameState);
    };

    this.gameClient.onConnectionChange = connectionChange => {
      this._handleConnectionStateChange(connectionChange);
    };

    this.gameClient.onError = (error, context) => {
      this.logger.error(
        "_setupEventHandlers",
        `Game client error in ${context}`,
        error
      );
    };

    // Handle canvas resize - but only if canvasElement exists
    if (this.canvasElement) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          this._handleCanvasResize(entry.contentRect);
        }
      });

      resizeObserver.observe(this.canvasElement);

      // Store observer for cleanup
      this.resizeObserver = resizeObserver;
    } else {
      this.logger.warn(
        "_setupEventHandlers",
        "Canvas element not available for resize observation"
      );
    }

    this.logger.debug("_setupEventHandlers", "Event handlers configured");
  }

  /**
   * Handles game state updates from client with dirty region tracking
   * @param {GameState} gameState - Updated game state
   * @private
   */
  _handleGameStateUpdate(gameState) {
    if (!this.renderer) {
      this.logger.warn("_handleGameStateUpdate", "Renderer not available");
      return;
    }

    // Update viewport content dimensions
    const cellDimensions = this.renderer.getCellDimensions();
    if (this.viewport) {
      this.viewport.updateContent(
        gameState.width * cellDimensions.width,
        gameState.height * cellDimensions.height,
        cellDimensions.width,
        cellDimensions.height
      );
    }

    // Mark changed cells as dirty for efficient rendering
    if (gameState.changeTracker && gameState.changeTracker.hasChanges()) {
      const changedCells = gameState.changeTracker.getChangedCells();
      for (const {x, y} of changedCells) {
        this.renderer.markDirty(x, y);
      }
      
      // Clear the change tracker after processing
      gameState.changeTracker.clearChanges();
    }

    // Trigger render if we're actively rendering
    if (this.isRendering) {
      this.forceRender();
    }
  }

  /**
   * Handles connection state changes
   * @param {Object} detail - Event detail with connection state information
   * @private
   */
  _handleConnectionStateChange(detail) {
    if (this.connectionStatus) {
      const statusState = this._mapConnectionState(detail.newState);
      this.connectionStatus.updateStatus(
        statusState,
        detail.reason,
        detail.metadata
      );
    }

    this.logger.debug(
      "_handleConnectionStateChange",
      "Connection state updated",
      detail
    );
  }

    /**
   * Maps game client connection states to status display states
   * @param {string} clientState - Game client connection state
   * @returns {string} Status display state
   * @private
   */
  _mapConnectionState(clientState) {
    // Import ConnectionState and StatusState enums if not already available
    const stateMapping = {
      [ConnectionState.DISCONNECTED]: "disconnected",
      [ConnectionState.CONNECTING]: "connecting",
      [ConnectionState.CONNECTED]: "connected",
      [ConnectionState.AUTHENTICATED]: "authenticated",
      [ConnectionState.PLAYING]: "playing",
      [ConnectionState.ERROR]: "error",
      [ConnectionState.RECONNECTING]: "reconnecting"
    };

    const mappedState = stateMapping[clientState];

    if (!mappedState) {
      this.logger.warn(
        "_mapConnectionState",
        `Unknown client state: ${clientState}, defaulting to error`
      );
      return "error";
    }

    this.logger.debug(
      "_mapConnectionState",
      `Mapped client state ${clientState} to display state ${mappedState}`
    );

    return mappedState;
  }

  /**
   * Handles canvas resize events
   * @param {DOMRect} rect - New canvas dimensions
   * @private
   */
  _handleCanvasResize(rect) {
    if (!this.canvasElement) {
      this.logger.warn("_handleCanvasResize", "Canvas element is null");
      return;
    }

    // Update canvas internal dimensions
    this.canvasElement.width = rect.width;
    this.canvasElement.height = rect.height;

    // Update viewport if available
    if (this.viewport) {
      this.viewport.updateContent(rect.width, rect.height);
    }

    // Force re-render
    this.forceRender();

    this.logger.debug("_handleCanvasResize", `Canvas resized to ${rect.width}x${rect.height}`);
  }

  /**
   * Initializes the game display and all subsystems
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async init() {
    this.logger.enter("init");

    try {
      // Set up input handling for the canvas
      this.gameClient.setupInput(this.canvasElement, this.options.input);

      // Update connection status to show we're ready
      if (this.connectionStatus) {
        this.connectionStatus.updateStatus(
          StatusState.DISCONNECTED,
          "display_ready"
        );
      }

      this.logger.exit("init", "Display initialization completed");
    } catch (error) {
      this.logger.error("init", "Display initialization failed", error);
      throw error;
    }
  }

  /**
   * Starts the rendering loop
   * @private
   */
  _startRendering() {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this._renderLoop();

    this.logger.debug("_startRendering", "Rendering loop started");
  }

  /**
   * Stops the rendering loop
   * @private
   */
  _stopRendering() {
    this.isRendering = false;

    if (this.renderTimer) {
      cancelAnimationFrame(this.renderTimer);
      this.renderTimer = null;
    }

    this.logger.debug("_stopRendering", "Rendering loop stopped");
  }

  /**
   * Main rendering loop
   * @private
   */
  _renderLoop() {
    if (!this.isRendering) {
      return;
    }

    const now = performance.now();

    try {
      // Get current game state
      const gameState = this.gameClient.getGameState();
      if (gameState) {
        // Get viewport transformation
        const transform = this.viewport.getTransform();

        // Render the game
        this.renderer.render(gameState, transform);
      }

      // Update performance display
      if (this.options.showPerformanceStats) {
        this._updatePerformanceDisplay();
      }

      this.lastRenderTime = now;
    } catch (error) {
      this.logger.error("_renderLoop", "Render loop error", error);
    }

    // Schedule next frame
    this.renderTimer = requestAnimationFrame(() => this._renderLoop());
  }

  /**
   * Updates performance statistics display
   * @private
   */
  _updatePerformanceDisplay() {
    if (!this.performanceElement || !this.renderer) {
      return;
    }

    const rendererStats = this.renderer.getPerformanceStats();
    const clientStats = this.gameClient ? this.gameClient.getStats() : null;

    const performanceHTML = `
      <div><strong>Performance</strong></div>
      <div>FPS: ${rendererStats.fps.toFixed(1)}</div>
      <div>Frame Time: ${rendererStats.lastFrameTime.toFixed(1)}ms</div>
      <div>Cells: ${rendererStats.renderStats.cellsRendered}</div>
      <div>Cache: ${rendererStats.cacheSize}</div>
      ${clientStats ? `
        <div>Poll Rate: ${clientStats.session.isPolling ? "Active" : "Inactive"}</div>
        <div>State Version: ${clientStats.session.lastStateVersion}</div>
      ` : ''}
    `;

    this.performanceElement.innerHTML = performanceHTML;
  }

  /**
   * Gets comprehensive display statistics
   * @returns {Object} Complete display status and performance information
   */
  getStats() {
    return {
      isRendering: this.isRendering,
      lastRenderTime: this.lastRenderTime,
      viewport: this.viewport ? this.viewport.getTransform() : null,
      renderer: this.renderer ? this.renderer.getPerformanceStats() : null,
      gameClient: this.gameClient ? this.gameClient.getStats() : null,
      connectionStatus: this.connectionStatus
        ? this.connectionStatus.getStatistics()
        : null
    };
  }

  /**
   * Manually triggers a render update
   */
  forceRender() {
    if (!this.isRendering) {
      this._startRendering();
    }
  }

  /**
   * Starts the display with rendering
   */
  start() {
    this.logger.info("start", "Starting game display");
    this._startRendering();
  }

  /**
   * Stops the display and cleans up resources
   */
  stop() {
    this.logger.info("stop", "Stopping game display");
    this._stopRendering();
  }

  /**
   * Destroys the display and releases all resources with proper cleanup
   */
  destroy() {
    this.logger.enter("destroy");

    // Stop rendering
    this._stopRendering();

    // Cleanup resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear renderer cache and resources
    if (this.renderer) {
      this.renderer.clearCache();
      this.renderer = null;
    }

    // Destroy game client
    if (this.gameClient) {
      this.gameClient.destroy();
      this.gameClient = null;
    }

    // Destroy connection status
    if (this.connectionStatus) {
      this.connectionStatus.destroy();
      this.connectionStatus = null;
    }

    // Remove from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // Clear references for garbage collection
    this.element = null;
    this.canvasElement = null;
    this.performanceElement = null;
    this.viewport = null;
    this.container = null;

    this.logger.info("destroy", "Game display destroyed and resources cleaned up");
  }
}

// Export public interface
export {
  GameDisplay,
  TerminalRenderer,
  ViewportManager,
  RenderMode,
  FontStyle
};

console.log("[GameDisplay] Game display component module loaded successfully");
