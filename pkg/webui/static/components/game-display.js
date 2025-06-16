/**
 * @fileoverview Main game display component for terminal-based game rendering with canvas support
 * Provides comprehensive display management including viewport control, terminal rendering,
 * performance optimization, and user interaction handling for roguelike games.
 * Coordinates rendering pipeline, input management, and real-time state updates.
 * @module components/game-display
 * @requires utils/logger
 * @requires services/game-client
 * @requires components/connection-status
 * @author go-gamelaunch-client
 * @version 1.0.0
 * @since 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";
import { GameClient, ConnectionState } from "../services/game-client.js";
import {
  ConnectionStatus,
  StatusState
} from "../components/connection-status.js";

console.debug("[GameDisplay] - debug: Initializing game display module");

/**
 * @enum {string}
 * @readonly
 * @description Display rendering modes for game content with different performance characteristics
 * @since 1.0.0
 */
const RenderMode = {
  /** Pure text-based rendering for maximum compatibility */
  TEXT: "text",
  /** Tileset-based graphical rendering for enhanced visuals */
  TILESET: "tileset", 
  /** Combined text and tileset rendering for flexibility */
  HYBRID: "hybrid"
};

/**
 * @enum {string}
 * @readonly
 * @description Font rendering styles for terminal display with different visual qualities
 * @since 1.0.0
 */
const FontStyle = {
  /** Standard monospace font rendering */
  MONOSPACE: "monospace",
  /** Bitmap font rendering for pixel-perfect display */
  BITMAP: "bitmap",
  /** Vector font rendering for scalable text */
  VECTOR: "vector"
};

console.debug("[GameDisplay] - debug: Enums defined", { RenderMode, FontStyle });

/**
 * @class ViewportManager
 * @description Manages viewport scaling, scrolling, and display adaptation for game content.
 * Provides interactive viewport control including zoom, pan, and auto-fitting functionality
 * for responsive game display across different screen sizes and user preferences.
 * Handles mouse and keyboard interactions for viewport manipulation.
 * @since 1.0.0
 */
class ViewportManager {
  /**
   * Creates a new ViewportManager instance with interactive viewport control capabilities.
   * Configures viewport scaling, scrolling behavior, and event handling for game content
   * display with user interaction support and responsive design adaptation.
   * 
   * @constructor
   * @memberof ViewportManager
   * @param {HTMLCanvasElement} canvas - Canvas element to manage viewport for
   * @param {Object} [options={}] - Viewport configuration options for behavior customization
   * @param {number} [options.minScale=0.5] - Minimum scaling factor for zoom limits (0.1-1.0)
   * @param {number} [options.maxScale=3.0] - Maximum scaling factor for zoom limits (1.0-5.0)
   * @param {boolean} [options.allowScroll=true] - Whether to allow viewport scrolling with mouse/keyboard
   * @param {boolean} [options.autoResize=true] - Whether to auto-resize to fit content changes
   * @returns {ViewportManager} New ViewportManager instance with configured behavior and event handling
   * @throws {TypeError} When canvas is not a valid HTMLCanvasElement
   * @throws {RangeError} When scale options are outside valid ranges
   * @example
   * // Create viewport manager with default settings
   * const viewport = new ViewportManager(canvasElement);
   * 
   * // Create viewport with custom zoom and scroll settings
   * const customViewport = new ViewportManager(canvasElement, {
   *   minScale: 0.25, maxScale: 5.0, allowScroll: false
   * });
   * @since 1.0.0
   */
  constructor(canvas, options = {}) {
    console.debug("[ViewportManager.constructor] - debug: Creating viewport manager", { options });

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error("[ViewportManager.constructor] - error: Invalid canvas element", canvas);
      throw new TypeError('Canvas must be a valid HTMLCanvasElement');
    }

    this.logger = createLogger("ViewportManager", LogLevel.DEBUG);

    this.canvas = canvas;
    this.options = {
      minScale: options.minScale || 0.5,
      maxScale: options.maxScale || 3.0,
      allowScroll: options.allowScroll !== false,
      autoResize: options.autoResize !== false,
      ...options
    };

    // Validate scale options
    if (this.options.minScale <= 0 || this.options.minScale > 1.0) {
      console.error("[ViewportManager.constructor] - error: Invalid minScale", this.options.minScale);
      throw new RangeError('minScale must be between 0.1 and 1.0');
    }

    if (this.options.maxScale < 1.0 || this.options.maxScale > 10.0) {
      console.error("[ViewportManager.constructor] - error: Invalid maxScale", this.options.maxScale);
      throw new RangeError('maxScale must be between 1.0 and 10.0');
    }

    console.debug("[ViewportManager.constructor] - debug: Options validated", this.options);

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

    console.info("[ViewportManager.constructor] - info: Setting up event listeners and updating viewport");

    try {
      this._setupEventListeners();
      this._updateViewport();

      this.logger.info("constructor", "Viewport manager initialized", {
        allowScroll: this.options.allowScroll,
        autoResize: this.options.autoResize
      });

      console.info("[ViewportManager.constructor] - info: Viewport manager initialization completed successfully");
    } catch (error) {
      console.error("[ViewportManager.constructor] - error: Failed to initialize viewport manager", error);
      throw error;
    }
  }

  /**
   * Sets up event listeners for viewport interaction including zoom, pan, and drag operations.
   * Configures mouse wheel events for zooming and scrolling, mouse drag events for panning,
   * and window resize events for responsive viewport updates. Handles both standard and
   * accessibility keyboard combinations for viewport control.
   * 
   * @function _setupEventListeners
   * @memberof ViewportManager
   * @throws {Error} If event listener attachment fails
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically during initialization
   * // this._setupEventListeners(); // Configures all viewport interaction events
   * @private
   */
  _setupEventListeners() {
    console.debug("[ViewportManager._setupEventListeners] - debug: Setting up viewport event listeners");

    try {
      // Mouse wheel for zooming
      this.canvas.addEventListener(
        "wheel",
        event => {
          console.debug("[ViewportManager._setupEventListeners] - debug: Wheel event", { 
            ctrlKey: event.ctrlKey, 
            deltaY: event.deltaY,
            allowScroll: this.options.allowScroll 
          });

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
          console.debug("[ViewportManager._setupEventListeners] - debug: Mouse down for drag", { 
            button: event.button, 
            ctrlKey: event.ctrlKey 
          });
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
          console.debug("[ViewportManager._setupEventListeners] - debug: Mouse up, ending drag");
          event.preventDefault();
          this._endDrag(event);
        }
      });

      // Window resize handling
      window.addEventListener("resize", () => {
        console.debug("[ViewportManager._setupEventListeners] - debug: Window resize detected");
        this._updateViewport();
      });

      this.logger.debug("_setupEventListeners", "Viewport event listeners attached");
      console.info("[ViewportManager._setupEventListeners] - info: Event listeners setup completed successfully");

    } catch (error) {
      console.error("[ViewportManager._setupEventListeners] - error: Failed to setup event listeners", error);
      throw error;
    }
  }

  /**
   * Handles zoom events from mouse wheel with scale bounds enforcement.
   * Processes Ctrl+wheel events to zoom in/out while maintaining scale limits
   * and adjusting viewport offset to zoom toward mouse cursor position.
   * Provides smooth zoom experience with configurable sensitivity.
   * 
   * @function _handleZoom
   * @memberof ViewportManager
   * @param {WheelEvent} event - Mouse wheel event with zoom direction and position
   * @throws {TypeError} If event is not a valid WheelEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically for Ctrl+wheel events
   * // this._handleZoom(wheelEvent); // Zooms toward mouse position
   * @private
   */
  _handleZoom(event) {
    console.debug("[ViewportManager._handleZoom] - debug: Processing zoom event", { 
      deltaY: event.deltaY, 
      currentScale: this.scale 
    });

    try {
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

        console.debug("[ViewportManager._handleZoom] - debug: Applying zoom", { 
          oldScale: this.scale, 
          newScale, 
          mousePosition: { x: mouseX, y: mouseY } 
        });

        this._setScale(newScale, mouseX, mouseY);
        
        console.info("[ViewportManager._handleZoom] - info: Zoom applied successfully", { 
          scale: this.scale.toFixed(2) 
        });
        this.logger.debug("_handleZoom", `Zoom: ${this.scale.toFixed(2)}x`);
      } else {
        console.debug("[ViewportManager._handleZoom] - debug: Zoom at limit, no change applied");
      }
    } catch (error) {
      console.error("[ViewportManager._handleZoom] - error: Failed to handle zoom", error);
    }
  }

  /**
   * Handles scroll events for viewport panning with speed control.
   * Processes wheel events without Ctrl modifier to pan the viewport
   * in response to user scrolling. Applies scroll speed scaling and
   * constrains panning to valid content bounds.
   * 
   * @function _handleScroll
   * @memberof ViewportManager
   * @param {WheelEvent} event - Mouse wheel event with scroll direction and distance
   * @throws {TypeError} If event is not a valid WheelEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically for wheel events without Ctrl
   * // this._handleScroll(wheelEvent); // Pans viewport in scroll direction
   * @private
   */
  _handleScroll(event) {
    console.debug("[ViewportManager._handleScroll] - debug: Processing scroll event", { 
      deltaX: event.deltaX, 
      deltaY: event.deltaY 
    });

    try {
      const scrollSpeed = 20;
      const oldOffset = { x: this.offsetX, y: this.offsetY };
      
      this.offsetX -= event.deltaX * scrollSpeed / this.scale;
      this.offsetY -= event.deltaY * scrollSpeed / this.scale;
      this._constrainOffset();

      console.debug("[ViewportManager._handleScroll] - debug: Scroll applied", { 
        oldOffset, 
        newOffset: { x: this.offsetX, y: this.offsetY } 
      });

    } catch (error) {
      console.error("[ViewportManager._handleScroll] - error: Failed to handle scroll", error);
    }
  }

  /**
   * Starts drag operation for viewport panning with cursor feedback.
   * Initiates viewport dragging mode by capturing initial mouse position
   * and changing cursor appearance to indicate drag state. Sets up
   * state for subsequent drag movement handling.
   * 
   * @function _startDrag
   * @memberof ViewportManager
   * @param {MouseEvent} event - Mouse event with initial drag position
   * @throws {TypeError} If event is not a valid MouseEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically for middle mouse or Ctrl+left mouse
   * // this._startDrag(mouseEvent); // Begins viewport drag operation
   * @private
   */
  _startDrag(event) {
    console.debug("[ViewportManager._startDrag] - debug: Starting drag operation", { 
      clientX: event.clientX, 
      clientY: event.clientY 
    });

    try {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.canvas.style.cursor = "grabbing";

      console.info("[ViewportManager._startDrag] - info: Drag operation started successfully");
    } catch (error) {
      console.error("[ViewportManager._startDrag] - error: Failed to start drag", error);
    }
  }

  /**
   * Handles drag movement for viewport panning with offset updates.
   * Processes mouse movement during drag operations to pan the viewport
   * by calculating movement delta and updating viewport offset. Applies
   * scale-aware movement and constrains panning to valid bounds.
   * 
   * @function _handleDrag
   * @memberof ViewportManager
   * @param {MouseEvent} event - Mouse event with current drag position
   * @throws {TypeError} If event is not a valid MouseEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically during mouse drag operations
   * // this._handleDrag(mouseMoveEvent); // Updates viewport position based on drag
   * @private
   */
  _handleDrag(event) {
    if (!this.isDragging) {
      console.debug("[ViewportManager._handleDrag] - debug: Drag event received but not in dragging state");
      return;
    }

    console.debug("[ViewportManager._handleDrag] - debug: Processing drag movement", { 
      clientX: event.clientX, 
      clientY: event.clientY,
      lastPosition: { x: this.lastMouseX, y: this.lastMouseY }
    });

    try {
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      this.offsetX += deltaX / this.scale;
      this.offsetY += deltaY / this.scale;
      this._constrainOffset();

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;

      console.debug("[ViewportManager._handleDrag] - debug: Drag movement applied", { 
        delta: { x: deltaX, y: deltaY },
        newOffset: { x: this.offsetX, y: this.offsetY }
      });
    } catch (error) {
      console.error("[ViewportManager._handleDrag] - error: Failed to handle drag movement", error);
    }
  }

  /**
   * Ends drag operation and restores normal cursor state.
   * Completes viewport dragging by resetting drag state and
   * restoring default cursor appearance. Cleans up drag-related
   * state variables for next interaction.
   * 
   * @function _endDrag
   * @memberof ViewportManager
   * @param {MouseEvent} event - Mouse event ending the drag operation
   * @throws {Error} If drag cleanup fails
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Internal method called automatically for mouse up events during drag
   * // this._endDrag(mouseUpEvent); // Completes and cleans up drag operation
   * @private
   */
  _endDrag(event) {
    console.debug("[ViewportManager._endDrag] - debug: Ending drag operation");

    try {
      this.isDragging = false;
      this.canvas.style.cursor = "default";

      console.info("[ViewportManager._endDrag] - info: Drag operation ended successfully");
    } catch (error) {
      console.error("[ViewportManager._endDrag] - error: Failed to end drag operation", error);
    }
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
   * Updates content dimensions for viewport calculations and auto-fitting.
   * Sets new content dimensions and optionally updates cell size parameters
   * for accurate viewport scaling and positioning. Triggers viewport recalculation
   * and applies auto-fitting if enabled in configuration.
   * 
   * @function updateContent
   * @memberof ViewportManager
   * @param {number} width - Content width in pixels (must be positive)
   * @param {number} height - Content height in pixels (must be positive)
   * @param {number} [cellWidth] - Width of individual cells in pixels
   * @param {number} [cellHeight] - Height of individual cells in pixels
   * @throws {TypeError} When width or height are not positive numbers
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Update content size for new game state
   * viewport.updateContent(800, 600, 16, 20);
   * 
   * // Update just dimensions, keep existing cell size
   * viewport.updateContent(1024, 768);
   */
  updateContent(width, height, cellWidth, cellHeight) {
    console.debug("[ViewportManager.updateContent] - debug: Updating content dimensions", { 
      width, height, cellWidth, cellHeight 
    });

    try {
      if (typeof width !== 'number' || width <= 0) {
        console.error("[ViewportManager.updateContent] - error: Invalid width", width);
        throw new TypeError('Width must be a positive number');
      }

      if (typeof height !== 'number' || height <= 0) {
        console.error("[ViewportManager.updateContent] - error: Invalid height", height);
        throw new TypeError('Height must be a positive number');
      }

      this.contentWidth = width;
      this.contentHeight = height;

      if (cellWidth !== undefined) this.cellWidth = cellWidth;
      if (cellHeight !== undefined) this.cellHeight = cellHeight;

      this._updateViewport();

      this.logger.debug("updateContent", `Content updated: ${width}x${height}`);
      console.info("[ViewportManager.updateContent] - info: Content dimensions updated successfully", { 
        contentSize: `${width}x${height}`,
        cellSize: `${this.cellWidth}x${this.cellHeight}`
      });

    } catch (error) {
      console.error("[ViewportManager.updateContent] - error: Failed to update content", error);
      throw error;
    }
  }

  /**
   * Converts screen coordinates to content coordinates with viewport transformation.
   * Transforms mouse or screen coordinates to corresponding content coordinates
   * accounting for current viewport scale and offset. Essential for input
   * handling and coordinate-based interactions.
   * 
   * @function screenToContent
   * @memberof ViewportManager
   * @param {number} screenX - Screen X coordinate relative to canvas
   * @param {number} screenY - Screen Y coordinate relative to canvas
   * @throws {TypeError} When coordinates are not numbers
   * @returns {Object} Content coordinates with x and y properties
   * @since 1.0.0
   * @example
   * // Convert mouse click to content coordinates
   * const contentPos = viewport.screenToContent(mouseX, mouseY);
   * console.log(`Clicked at content position: ${contentPos.x}, ${contentPos.y}`);
   */
  screenToContent(screenX, screenY) {
    console.debug("[ViewportManager.screenToContent] - debug: Converting screen to content coordinates", { 
      screenX, screenY 
    });

    try {
      if (typeof screenX !== 'number' || typeof screenY !== 'number') {
        console.error("[ViewportManager.screenToContent] - error: Invalid coordinate types", { screenX, screenY });
        throw new TypeError('Coordinates must be numbers');
      }

      const rect = this.canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      const result = {
        x: canvasX / this.scale + this.offsetX,
        y: canvasY / this.scale + this.offsetY
      };

      console.debug("[ViewportManager.screenToContent] - debug: Coordinate conversion completed", { 
        screen: { x: screenX, y: screenY },
        content: result
      });

      return result;
    } catch (error) {
      console.error("[ViewportManager.screenToContent] - error: Failed to convert coordinates", error);
      throw error;
    }
  }

  /**
   * Converts content coordinates to screen coordinates with viewport transformation.
   * Transforms content coordinates to corresponding screen coordinates
   * accounting for current viewport scale and offset. Used for positioning
   * UI elements and overlays relative to game content.
   * 
   * @function contentToScreen
   * @memberof ViewportManager
   * @param {number} contentX - Content X coordinate
   * @param {number} contentY - Content Y coordinate
   * @throws {TypeError} When coordinates are not numbers
   * @returns {Object} Screen coordinates with x and y properties
   * @since 1.0.0
   * @example
   * // Convert game object position to screen coordinates
   * const screenPos = viewport.contentToScreen(gameX, gameY);
   * overlay.style.left = screenPos.x + 'px';
   * overlay.style.top = screenPos.y + 'px';
   */
  contentToScreen(contentX, contentY) {
    console.debug("[ViewportManager.contentToScreen] - debug: Converting content to screen coordinates", { 
      contentX, contentY 
    });

    try {
      if (typeof contentX !== 'number' || typeof contentY !== 'number') {
        console.error("[ViewportManager.contentToScreen] - error: Invalid coordinate types", { contentX, contentY });
        throw new TypeError('Coordinates must be numbers');
      }

      const result = {
        x: (contentX - this.offsetX) * this.scale,
        y: (contentY - this.offsetY) * this.scale
      };

      console.debug("[ViewportManager.contentToScreen] - debug: Coordinate conversion completed", { 
        content: { x: contentX, y: contentY },
        screen: result
      });

      return result;
    } catch (error) {
      console.error("[ViewportManager.contentToScreen] - error: Failed to convert coordinates", error);
      throw error;
    }
  }

  /**
   * Gets current viewport transformation matrix for rendering operations.
   * Returns complete transformation state including scale, offset, and
   * viewport dimensions for use in rendering and coordinate calculations.
   * Provides read-only snapshot of current viewport state.
   * 
   * @function getTransform
   * @memberof ViewportManager
   * @returns {Object} Transformation parameters with scale, offsetX, offsetY, viewportWidth, viewportHeight
   * @throws {Error} Never throws, safe to call in any state
   * @since 1.0.0
   * @example
   * // Get current viewport state for rendering
   * const transform = viewport.getTransform();
   * renderer.applyTransform(transform);
   */
  getTransform() {
    console.debug("[ViewportManager.getTransform] - debug: Getting viewport transformation");

    try {
      const result = {
        scale: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight
      };

      console.debug("[ViewportManager.getTransform] - debug: Transform retrieved", result);
      return result;
    } catch (error) {
      console.error("[ViewportManager.getTransform] - error: Failed to get transform", error);
      // Return safe defaults if error occurs
      return {
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        viewportWidth: 0,
        viewportHeight: 0
      };
    }
  }

  /**
   * Resets viewport to default state with identity transformation.
   * Restores viewport to initial scale and offset values, effectively
   * resetting all user zoom and pan operations. Useful for "fit to screen"
   * or "reset view" functionality.
   * 
   * @function reset
   * @memberof ViewportManager
   * @throws {Error} If viewport reset fails
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Reset viewport to defaults
   * viewport.reset();
   */
  reset() {
    console.debug("[ViewportManager.reset] - debug: Resetting viewport to defaults");

    try {
      this.scale = 1.0;
      this.offsetX = 0;
      this.offsetY = 0;
      this._updateViewport();

      this.logger.debug("reset", "Viewport reset to defaults");
      console.info("[ViewportManager.reset] - info: Viewport reset completed successfully");
    } catch (error) {
      console.error("[ViewportManager.reset] - error: Failed to reset viewport", error);
      throw error;
    }
  }
}

/**
 * @class TerminalRenderer
 * @description Handles low-level terminal rendering with multiple display modes and optimizations.
 * Provides high-performance canvas-based rendering for terminal games with support for
 * text and tileset rendering modes, dirty region optimization, render caching, and
 * performance monitoring. Manages font metrics, color processing, and visual effects.
 * @since 1.0.0
 */
class TerminalRenderer {
  /**
   * Creates a new TerminalRenderer instance with comprehensive rendering capabilities.
   * Initializes canvas context, configures rendering options, calculates font metrics,
   * and sets up performance optimization systems including render caching and dirty
   * region tracking for efficient terminal game rendering.
   * 
   * @constructor
   * @memberof TerminalRenderer
   * @param {HTMLCanvasElement} canvas - Canvas element for rendering operations
   * @param {Object} [options={}] - Renderer configuration options for visual and performance tuning
   * @param {string} [options.mode=RenderMode.TEXT] - Default rendering mode (text/tileset/hybrid)
   * @param {string} [options.fontStyle=FontStyle.MONOSPACE] - Font rendering style for text display
   * @param {number} [options.fontSize=14] - Base font size in pixels (8-72)
   * @param {string} [options.fontFamily='Consolas, Monaco, monospace'] - Font family specification
   * @param {boolean} [options.antialiasing=false] - Whether to enable font antialiasing
   * @returns {TerminalRenderer} New TerminalRenderer instance with configured rendering pipeline
   * @throws {TypeError} When canvas is not a valid HTMLCanvasElement
   * @throws {RangeError} When fontSize is outside valid range
   * @example
   * // Create renderer with default text mode
   * const renderer = new TerminalRenderer(canvasElement);
   * 
   * // Create renderer with custom font and tileset support
   * const customRenderer = new TerminalRenderer(canvasElement, {
   *   mode: RenderMode.HYBRID, fontSize: 16, antialiasing: true
   * });
   * @since 1.0.0
   */
  constructor(canvas, options = {}) {
    console.debug("[TerminalRenderer.constructor] - debug: Creating terminal renderer", { options });

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error("[TerminalRenderer.constructor] - error: Invalid canvas element", canvas);
      throw new TypeError('Canvas must be a valid HTMLCanvasElement');
    }

    this.logger = createLogger("TerminalRenderer", LogLevel.DEBUG);

    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    
    if (!this.context) {
      console.error("[TerminalRenderer.constructor] - error: Failed to get 2D context");
      throw new Error('Failed to get 2D rendering context');
    }

    this.options = {
      mode: options.mode || RenderMode.TEXT,
      fontStyle: options.fontStyle || FontStyle.MONOSPACE,
      fontSize: options.fontSize || 14,
      fontFamily: options.fontFamily || "Consolas, Monaco, monospace",
      antialiasing: options.antialiasing === true,
      ...options
    };

    // Validate fontSize
    if (this.options.fontSize < 8 || this.options.fontSize > 72) {
      console.error("[TerminalRenderer.constructor] - error: Invalid font size", this.options.fontSize);
      throw new RangeError('Font size must be between 8 and 72 pixels');
    }

    console.debug("[TerminalRenderer.constructor] - debug: Options validated", this.options);

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

    console.info("[TerminalRenderer.constructor] - info: Initializing renderer systems");

    try {
      this._initializeRenderer();

      this.logger.info("constructor", "Terminal renderer initialized", {
        mode: this.options.mode,
        fontSize: this.options.fontSize
      });

      console.info("[TerminalRenderer.constructor] - info: Terminal renderer initialization completed successfully");
    } catch (error) {
      console.error("[TerminalRenderer.constructor] - error: Failed to initialize renderer", error);
      throw error;
    }
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
   * Sets the tileset for tileset-based rendering with validation and metrics update.
   * Configures the renderer to use the specified tileset for tile-based rendering,
   * updating cell dimensions and validating tileset readiness. Enables hybrid
   * rendering modes that combine text and tileset graphics.
   * 
   * @function setTileset
   * @memberof TerminalRenderer
   * @param {Tileset} tileset - Tileset instance to use for rendering operations
   * @throws {TypeError} When tileset is not a valid Tileset instance
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Set a loaded tileset for graphics rendering
   * renderer.setTileset(loadedTileset);
   * 
   * // Clear tileset to use text-only rendering
   * renderer.setTileset(null);
   */
  setTileset(tileset) {
    console.debug("[TerminalRenderer.setTileset] - debug: Setting tileset", { 
      tileset: tileset?.name || 'null',
      imageLoaded: tileset?.imageLoaded 
    });

    try {
      this.currentTileset = tileset;

      if (tileset && tileset.imageLoaded) {
        // Update cell dimensions based on tileset
        this.cellWidth = tileset.tile_width;
        this.cellHeight = tileset.tile_height;

        this.logger.info("setTileset", `Tileset configured: ${tileset.name}`, {
          tileSize: `${this.cellWidth}x${this.cellHeight}`
        });

        console.info("[TerminalRenderer.setTileset] - info: Tileset configured successfully", {
          name: tileset.name,
          tileSize: `${this.cellWidth}x${this.cellHeight}`
        });
      } else if (tileset) {
        console.warn("[TerminalRenderer.setTileset] - warn: Tileset provided but not loaded");
        this.logger.warn("setTileset", "Invalid or unloaded tileset provided");
      } else {
        console.info("[TerminalRenderer.setTileset] - info: Tileset cleared, using text-only rendering");
      }

      // Clear cache when tileset changes
      this.renderCache.clear();
    } catch (error) {
      console.error("[TerminalRenderer.setTileset] - error: Failed to set tileset", error);
      throw error;
    }
  }

  /**
   * Gets the current cell dimensions for layout calculations.
   * Returns the width and height of individual character cells in pixels,
   * which may be based on font metrics or tileset dimensions depending
   * on current rendering mode.
   * 
   * @function getCellDimensions
   * @memberof TerminalRenderer
   * @returns {Object} Cell dimensions with width and height properties in pixels
   * @throws {Error} Never throws, returns safe defaults if needed
   * @since 1.0.0
   * @example
   * // Get cell size for layout calculations
   * const { width, height } = renderer.getCellDimensions();
   * const gameWidth = columns * width;
   * const gameHeight = rows * height;
   */
  getCellDimensions() {
    console.debug("[TerminalRenderer.getCellDimensions] - debug: Getting cell dimensions");

    try {
      const result = {
        width: this.cellWidth || 12,
        height: this.cellHeight || 16
      };

      console.debug("[TerminalRenderer.getCellDimensions] - debug: Cell dimensions retrieved", result);
      return result;
    } catch (error) {
      console.error("[TerminalRenderer.getCellDimensions] - error: Failed to get cell dimensions", error);
      return { width: 12, height: 16 }; // Safe defaults
    }
  }

  /**
   * Gets performance statistics for monitoring and optimization.
   * Returns comprehensive performance metrics including frame rate,
   * render times, cache efficiency, and rendering statistics for
   * performance monitoring and debugging purposes.
   * 
   * @function getPerformanceStats
   * @memberof TerminalRenderer
   * @returns {Object} Performance metrics with fps, frameTime, renderStats, cacheSize, and dirtyRegions
   * @throws {Error} Never throws, returns safe defaults if calculation fails
   * @since 1.0.0
   * @example
   * // Monitor rendering performance
   * const stats = renderer.getPerformanceStats();
   * console.log(`FPS: ${stats.fps}, Cache: ${stats.cacheSize}`);
   */
  getPerformanceStats() {
    console.debug("[TerminalRenderer.getPerformanceStats] - debug: Calculating performance statistics");

    try {
      const now = performance.now();
      const timeSinceLastFrame = now - this.lastFrameTime;
      const fps = timeSinceLastFrame > 0 ? 1000 / timeSinceLastFrame : 0;

      const result = {
        fps: Math.min(fps, this.targetFPS),
        lastFrameTime: timeSinceLastFrame,
        averageFrameTime: this.averageFrameTime,
        frameCount: this.frameCount,
        renderStats: { ...this.renderStats },
        cacheSize: this.renderCache.size,
        dirtyRegions: this.dirtyRegions.size
      };

      console.debug("[TerminalRenderer.getPerformanceStats] - debug: Performance stats calculated", result);
      return result;
    } catch (error) {
      console.error("[TerminalRenderer.getPerformanceStats] - error: Failed to calculate performance stats", error);
      return {
        fps: 0,
        lastFrameTime: 0,
        averageFrameTime: 0,
        frameCount: 0,
        renderStats: { cellsRendered: 0, tilesUsed: 0, textChars: 0 },
        cacheSize: 0,
        dirtyRegions: 0
      };
    }
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
 * @description Main game display component coordinating rendering, input, and UI elements.
 * Serves as the primary interface for displaying terminal-based games with comprehensive
 * rendering pipeline management, viewport control, performance monitoring, and user
 * interaction handling. Coordinates multiple subsystems for complete game presentation.
 * @since 1.0.0
 */
class GameDisplay {
  /**
   * Creates a new GameDisplay instance with complete game presentation capabilities.
   * Initializes and coordinates all display subsystems including game client, viewport
   * manager, terminal renderer, and connection status display. Sets up event handling
   * and creates DOM structure for comprehensive game display functionality.
   * 
   * @constructor
   * @memberof GameDisplay
   * @param {HTMLElement} container - Container element for the display (must be valid DOM element)
   * @param {Object} [options={}] - Display configuration options for customizing behavior
   * @param {Object} [options.client] - Game client configuration options
   * @param {Object} [options.renderer] - Renderer configuration options  
   * @param {Object} [options.viewport] - Viewport configuration options
   * @param {boolean} [options.showConnectionStatus=true] - Whether to show connection status indicator
   * @param {boolean} [options.showPerformanceStats=false] - Whether to show performance statistics overlay
   * @returns {GameDisplay} New GameDisplay instance with initialized subsystems and DOM structure
   * @throws {TypeError} When container is not a valid DOM element
   * @throws {Error} When display initialization fails
   * @example
   * // Create basic game display
   * const display = new GameDisplay(containerElement);
   * 
   * // Create display with custom options
   * const customDisplay = new GameDisplay(containerElement, {
   *   showPerformanceStats: true,
   *   renderer: { fontSize: 16, mode: RenderMode.HYBRID }
   * });
   * @since 1.0.0
   */
  constructor(container, options = {}) {
    console.debug("[GameDisplay.constructor] - debug: Creating game display", { options });

    if (!container || !(container instanceof HTMLElement)) {
      console.error("[GameDisplay.constructor] - error: Invalid container element", container);
      throw new TypeError('Container must be a valid HTMLElement');
    }

    this.logger = createLogger("GameDisplay", LogLevel.INFO);

    this.container = container;
    this.options = {
      showConnectionStatus: options.showConnectionStatus !== false,
      showPerformanceStats: options.showPerformanceStats === true,
      ...options
    };

    console.debug("[GameDisplay.constructor] - debug: Options configured", this.options);

    // Core components
    this.gameClient = null;
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

    console.info("[GameDisplay.constructor] - info: Initializing display components");

    try {
      // Initialize DOM structure
      this._createElement();
      this._initializeComponents();
      this._setupEventHandlers();

      this.logger.info("constructor", "Game display initialized", {
        showConnectionStatus: this.options.showConnectionStatus,
        showPerformanceStats: this.options.showPerformanceStats
      });

      console.info("[GameDisplay.constructor] - info: Game display initialization completed successfully");
    } catch (error) {
      console.error("[GameDisplay.constructor] - error: Failed to initialize game display", error);
      throw error;
    }
  }

  /**
   * Creates the main DOM structure for the display including canvas and styling.
   * Sets up the primary container element with appropriate CSS properties and creates
   * a canvas element for game rendering with pixel-perfect image rendering.
   * 
   * @private
   * @memberof GameDisplay
   * @returns {void} Method does not return a value
   * @throws {Error} When DOM element creation fails
   * @example
   * // Called internally during constructor
   * this._createElement();
   * @since 1.0.0
   */
  _createElement() {
    console.debug("[GameDisplay._createElement] - debug: Creating DOM structure");

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

    console.debug("[GameDisplay._createElement] - debug: Main container element created");

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

    console.debug("[GameDisplay._createElement] - debug: Canvas element created and configured");

    // Add to container
    if (this.container) {
      this.container.appendChild(this.element);
      console.info("[GameDisplay._createElement] - info: Display element added to container");
    } else {
      console.warn("[GameDisplay._createElement] - warn: No container available for display element");
    }

    this.logger.debug("_createElement", "DOM structure created");
  }

  /**
   * Initializes core components including viewport manager, terminal renderer, and connection status.
   * Creates and configures all necessary display subsystems with proper error handling and
   * validation. Sets up optional performance monitoring and connection status displays.
   * 
   * @private
   * @memberof GameDisplay
   * @returns {void} Method does not return a value
   * @throws {Error} When component initialization fails
   * @example
   * // Called internally during constructor
   * this._initializeComponents();
   * @since 1.0.0
   */
  _initializeComponents() {
    console.debug("[GameDisplay._initializeComponents] - debug: Initializing core components");

    try {
      // Initialize viewport manager
      console.debug("[GameDisplay._initializeComponents] - debug: Creating viewport manager");
      this.viewport = new ViewportManager(
        this.canvasElement,
        this.options.viewport
      );

      // Initialize terminal renderer
      console.debug("[GameDisplay._initializeComponents] - debug: Creating terminal renderer");
      this.renderer = new TerminalRenderer(
        this.canvasElement,
        this.options.renderer
      );

      console.info("[GameDisplay._initializeComponents] - info: Core rendering components initialized");

      // Initialize connection status if enabled
      if (this.options.showConnectionStatus) {
        console.debug("[GameDisplay._initializeComponents] - debug: Creating connection status display");
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
        console.info("[GameDisplay._initializeComponents] - info: Connection status display created");
      } else {
        console.debug("[GameDisplay._initializeComponents] - debug: Connection status display disabled");
      }

      // Create performance display if enabled
      if (this.options.showPerformanceStats) {
        console.debug("[GameDisplay._initializeComponents] - debug: Creating performance display");
        this._createPerformanceDisplay();
        console.info("[GameDisplay._initializeComponents] - info: Performance display created");
      } else {
        console.debug("[GameDisplay._initializeComponents] - debug: Performance display disabled");
      }

      this.logger.debug("_initializeComponents", "Core components initialized");
    } catch (error) {
      console.error("[GameDisplay._initializeComponents] - error: Component initialization failed", error);
      throw error;
    }
  }

  /**
   * Creates performance statistics display overlay with styling and positioning.
   * Sets up a semi-transparent overlay element positioned in the top-left corner
   * for displaying real-time performance metrics including FPS and render statistics.
   * 
   * @private
   * @memberof GameDisplay
   * @returns {void} Method does not return a value
   * @throws {Error} When performance display creation fails
   * @example
   * // Called internally when performance stats are enabled
   * this._createPerformanceDisplay();
   * @since 1.0.0
   */
  _createPerformanceDisplay() {
    console.debug("[GameDisplay._createPerformanceDisplay] - debug: Creating performance statistics display");

    try {
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
      console.info("[GameDisplay._createPerformanceDisplay] - info: Performance display element created and styled");
    } catch (error) {
      console.error("[GameDisplay._createPerformanceDisplay] - error: Failed to create performance display", error);
      throw error;
    }
  }

  /**
   * Sets up event handlers for component coordination and canvas resize observation.
   * Configures game client event listeners for state updates, connection changes, and errors.
   * Establishes resize observer for canvas element to handle dynamic resizing with proper cleanup.
   * 
   * @private
   * @memberof GameDisplay
   * @returns {void} Method does not return a value
   * @throws {Error} When event handler setup fails
   * @example
   * // Called internally during constructor
   * this._setupEventHandlers();
   * @since 1.0.0
   */
  _setupEventHandlers() {
    console.debug("[GameDisplay._setupEventHandlers] - debug: Setting up event handlers");

    try {
      // Handle game client events
      console.debug("[GameDisplay._setupEventHandlers] - debug: Configuring game client event handlers");
      this.gameClient.onStateUpdate = gameState => {
        this._handleGameStateUpdate(gameState);
      };

      this.gameClient.onConnectionChange = connectionChange => {
        this._handleConnectionStateChange(connectionChange);
      };

      this.gameClient.onError = (error, context) => {
        console.error("[GameDisplay._setupEventHandlers] - error: Game client error received", { error, context });
        this.logger.error(
          "_setupEventHandlers",
          `Game client error in ${context}`,
          error
        );
      };

      console.info("[GameDisplay._setupEventHandlers] - info: Game client event handlers configured");

      // Handle canvas resize - but only if canvasElement exists
      if (this.canvasElement) {
        console.debug("[GameDisplay._setupEventHandlers] - debug: Setting up canvas resize observer");
        const resizeObserver = new ResizeObserver(entries => {
          console.debug("[GameDisplay._setupEventHandlers] - debug: Canvas resize detected", { entries: entries.length });
          for (const entry of entries) {
            this._handleCanvasResize(entry.contentRect);
          }
        });

        resizeObserver.observe(this.canvasElement);

        // Store observer for cleanup
        this.resizeObserver = resizeObserver;
        console.info("[GameDisplay._setupEventHandlers] - info: Canvas resize observer configured");
      } else {
        console.warn("[GameDisplay._setupEventHandlers] - warn: Canvas element not available for resize observation");
        this.logger.warn(
          "_setupEventHandlers",
          "Canvas element not available for resize observation"
        );
      }

      this.logger.debug("_setupEventHandlers", "Event handlers configured");
    } catch (error) {
      console.error("[GameDisplay._setupEventHandlers] - error: Event handler setup failed", error);
      throw error;
    }
  }

  /**
   * Handles game state updates from client with dirty region tracking and viewport management.
   * Processes updated game state by updating viewport content dimensions, marking changed cells
   * as dirty for efficient rendering, and triggering render updates if actively rendering.
   * 
   * @private
   * @memberof GameDisplay
   * @param {GameState} gameState - Updated game state from client with dimensions and change tracking
   * @returns {void} Method does not return a value
   * @throws {Error} When game state processing fails
   * @example
   * // Called internally by game client event handler
   * this._handleGameStateUpdate(updatedGameState);
   * @since 1.0.0
   */
  _handleGameStateUpdate(gameState) {
    console.debug("[GameDisplay._handleGameStateUpdate] - debug: Processing game state update", {
      width: gameState?.width,
      height: gameState?.height,
      hasChanges: gameState?.changeTracker?.hasChanges()
    });

    if (!this.renderer) {
      console.warn("[GameDisplay._handleGameStateUpdate] - warn: Renderer not available for state update");
      this.logger.warn("_handleGameStateUpdate", "Renderer not available");
      return;
    }

    try {
      // Update viewport content dimensions
      const cellDimensions = this.renderer.getCellDimensions();
      if (this.viewport) {
        console.debug("[GameDisplay._handleGameStateUpdate] - debug: Updating viewport content dimensions", {
          contentWidth: gameState.width * cellDimensions.width,
          contentHeight: gameState.height * cellDimensions.height,
          cellDimensions
        });
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
        console.debug("[GameDisplay._handleGameStateUpdate] - debug: Marking changed cells as dirty", {
          changedCellCount: changedCells.length
        });
        for (const {x, y} of changedCells) {
          this.renderer.markDirty(x, y);
        }
        
        // Clear the change tracker after processing
        gameState.changeTracker.clearChanges();
        console.info("[GameDisplay._handleGameStateUpdate] - info: Processed game state changes", {
          cellsUpdated: changedCells.length
        });
      }

      // Trigger render if we're actively rendering
      if (this.isRendering) {
        console.debug("[GameDisplay._handleGameStateUpdate] - debug: Triggering render update");
        this.forceRender();
      }
    } catch (error) {
      console.error("[GameDisplay._handleGameStateUpdate] - error: Failed to process game state update", error);
      throw error;
    }
  }

  /**
   * Handles connection state changes from game client with status display updates.
   * Maps game client connection states to display states and updates the connection status
   * indicator with appropriate visual feedback and metadata information.
   * 
   * @private
   * @memberof GameDisplay
   * @param {Object} detail - Event detail with connection state information and metadata
   * @param {string} detail.newState - New connection state from game client
   * @param {string} [detail.reason] - Optional reason for state change
   * @param {Object} [detail.metadata] - Additional metadata about the state change
   * @returns {void} Method does not return a value
   * @throws {Error} When connection state handling fails
   * @example
   * // Called internally by game client event handler
   * this._handleConnectionStateChange({
   *   newState: 'connected',
   *   reason: 'authentication_success',
   *   metadata: { server: 'localhost' }
   * });
   * @since 1.0.0
   */
  _handleConnectionStateChange(detail) {
    console.debug("[GameDisplay._handleConnectionStateChange] - debug: Processing connection state change", detail);

    try {
      if (this.connectionStatus) {
        const statusState = this._mapConnectionState(detail.newState);
        console.debug("[GameDisplay._handleConnectionStateChange] - debug: Updating connection status display", {
          clientState: detail.newState,
          mappedState: statusState,
          reason: detail.reason
        });
        this.connectionStatus.updateStatus(
          statusState,
          detail.reason,
          detail.metadata
        );
        console.info("[GameDisplay._handleConnectionStateChange] - info: Connection status updated", {
          state: statusState
        });
      } else {
        console.debug("[GameDisplay._handleConnectionStateChange] - debug: Connection status display not available");
      }

      this.logger.debug(
        "_handleConnectionStateChange",
        "Connection state updated",
        detail
      );
    } catch (error) {
      console.error("[GameDisplay._handleConnectionStateChange] - error: Failed to handle connection state change", error);
      throw error;
    }
  }

    /**
   * Maps game client connection states to status display states with fallback handling.
   * Converts internal game client connection state enums to display-appropriate state names
   * for consistent status indicator presentation with error fallback for unknown states.
   * 
   * @private
   * @memberof GameDisplay
   * @param {string} clientState - Game client connection state to map
   * @returns {string} Status display state corresponding to client state
   * @throws {Error} Never throws, returns 'error' state for unknown inputs
   * @example
   * // Map connected state
   * const displayState = this._mapConnectionState('connected'); // Returns 'connected'
   * 
   * // Map unknown state with fallback
   * const errorState = this._mapConnectionState('unknown'); // Returns 'error'
   * @since 1.0.0
   */
  _mapConnectionState(clientState) {
    console.debug("[GameDisplay._mapConnectionState] - debug: Mapping connection state", { clientState });

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
      console.warn("[GameDisplay._mapConnectionState] - warn: Unknown client state, defaulting to error", { clientState });
      this.logger.warn(
        "_mapConnectionState",
        `Unknown client state: ${clientState}, defaulting to error`
      );
      return "error";
    }

    console.debug("[GameDisplay._mapConnectionState] - debug: State mapping successful", {
      clientState,
      mappedState
    });

    this.logger.debug(
      "_mapConnectionState",
      `Mapped client state ${clientState} to display state ${mappedState}`
    );

    return mappedState;
  }

  /**
   * Handles canvas resize events with dimension updates and render triggering.
   * Updates canvas internal dimensions to match new size, updates viewport content
   * dimensions for proper scaling, and forces a re-render to reflect changes.
   * 
   * @private
   * @memberof GameDisplay
   * @param {DOMRect} rect - New canvas dimensions from ResizeObserver
   * @param {number} rect.width - New canvas width in pixels
   * @param {number} rect.height - New canvas height in pixels
   * @returns {void} Method does not return a value
   * @throws {Error} When canvas resize handling fails
   * @example
   * // Called internally by ResizeObserver
   * this._handleCanvasResize({ width: 800, height: 600 });
   * @since 1.0.0
   */
  _handleCanvasResize(rect) {
    console.debug("[GameDisplay._handleCanvasResize] - debug: Handling canvas resize", rect);

    if (!this.canvasElement) {
      console.warn("[GameDisplay._handleCanvasResize] - warn: Canvas element is null, cannot resize");
      this.logger.warn("_handleCanvasResize", "Canvas element is null");
      return;
    }

    try {
      // Update canvas internal dimensions
      console.debug("[GameDisplay._handleCanvasResize] - debug: Updating canvas internal dimensions", {
        oldWidth: this.canvasElement.width,
        oldHeight: this.canvasElement.height,
        newWidth: rect.width,
        newHeight: rect.height
      });
      this.canvasElement.width = rect.width;
      this.canvasElement.height = rect.height;

      // Update viewport if available
      if (this.viewport) {
        console.debug("[GameDisplay._handleCanvasResize] - debug: Updating viewport content dimensions");
        this.viewport.updateContent(rect.width, rect.height);
      }

      // Force re-render
      console.debug("[GameDisplay._handleCanvasResize] - debug: Triggering force render after resize");
      this.forceRender();

      console.info("[GameDisplay._handleCanvasResize] - info: Canvas resize completed", {
        width: rect.width,
        height: rect.height
      });

      this.logger.debug("_handleCanvasResize", `Canvas resized to ${rect.width}x${rect.height}`);
    } catch (error) {
      console.error("[GameDisplay._handleCanvasResize] - error: Canvas resize handling failed", error);
      throw error;
    }
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
