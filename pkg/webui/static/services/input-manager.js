/**
 * @fileoverview Input event management for terminal-based game interaction with buffering and statistics
 * @module services/input-manager
 * @requires utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";

/**
 * @enum {string}
 * @readonly
 * @description Input event types for classification and processing
 */
const InputEventType = {
  KEY_DOWN: "keydown",
  KEY_UP: "keyup",
  MOUSE_CLICK: "mouseclick",
  MOUSE_MOVE: "mousemove",
  FOCUS: "focus",
  BLUR: "blur"
};

/**
 * @enum {string}
 * @readonly
 * @description Special key mappings for terminal game controls
 */
const SpecialKeys = {
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ENTER: "Enter",
  ESCAPE: "Escape",
  SPACE: " ",
  TAB: "Tab",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown"
};

/**
 * @class InputEvent
 * @description Represents a single input event with normalized properties for game processing
 */
class InputEvent {
  /**
   * Creates a new InputEvent instance
   * @param {string} type - Event type (from InputEventType enum)
   * @param {Object} data - Event data
   * @param {string} [data.key] - Key identifier for keyboard events
   * @param {string} [data.code] - Physical key code
   * @param {boolean} [data.ctrlKey=false] - Ctrl modifier state
   * @param {boolean} [data.altKey=false] - Alt modifier state
   * @param {boolean} [data.shiftKey=false] - Shift modifier state
   * @param {boolean} [data.metaKey=false] - Meta/Cmd modifier state
   * @param {number} [data.x] - Mouse X coordinate
   * @param {number} [data.y] - Mouse Y coordinate
   * @param {number} [data.button] - Mouse button pressed
   * @param {Event} [originalEvent] - Original DOM event for reference
   */
  constructor(type, data, originalEvent = null) {
    this.type = type;
    this.timestamp = Date.now();
    this.id = `${type}_${this.timestamp}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Keyboard event properties
    this.key = data.key || null;
    this.code = data.code || null;
    this.ctrlKey = Boolean(data.ctrlKey);
    this.altKey = Boolean(data.altKey);
    this.shiftKey = Boolean(data.shiftKey);
    this.metaKey = Boolean(data.metaKey);

    // Mouse event properties
    this.x = data.x || null;
    this.y = data.y || null;
    this.button = data.button || null;

    // Event metadata
    this.originalEvent = originalEvent;
    this.processed = false;
    this.sent = false;
    this.sendAttempts = 0;

    // Derived properties
    this.hasModifiers =
      this.ctrlKey || this.altKey || this.shiftKey || this.metaKey;
    this.isSpecialKey =
      this.key && Object.values(SpecialKeys).includes(this.key);
  }

  /**
   * Checks if this is a keyboard event
   * @returns {boolean} True if event is keyboard-related
   */
  isKeyboardEvent() {
    return (
      this.type === InputEventType.KEY_DOWN ||
      this.type === InputEventType.KEY_UP
    );
  }

  /**
   * Checks if this is a mouse event
   * @returns {boolean} True if event is mouse-related
   */
  isMouseEvent() {
    return (
      this.type === InputEventType.MOUSE_CLICK ||
      this.type === InputEventType.MOUSE_MOVE
    );
  }

  /**
   * Gets a formatted string representation of the key combination
   * @returns {string} Human-readable key combination
   */
  getKeyString() {
    if (!this.isKeyboardEvent()) {
      return null;
    }

    const modifiers = [];
    if (this.ctrlKey) modifiers.push("Ctrl");
    if (this.altKey) modifiers.push("Alt");
    if (this.shiftKey) modifiers.push("Shift");
    if (this.metaKey) modifiers.push("Meta");

    const keyPart = this.key || this.code || "Unknown";
    return modifiers.length > 0 ? `${modifiers.join("+")}+${keyPart}` : keyPart;
  }

  /**
   * Marks the event as processed
   * @param {boolean} [sent=false] - Whether the event was successfully sent
   */
  markProcessed(sent = false) {
    this.processed = true;
    this.sent = sent;
    if (sent) {
      this.sendAttempts++;
    }
  }

  /**
   * Converts event to JSON representation for transmission
   * @returns {Object} JSON-serializable event data
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      key: this.key,
      code: this.code,
      ctrlKey: this.ctrlKey,
      altKey: this.altKey,
      shiftKey: this.shiftKey,
      metaKey: this.metaKey,
      x: this.x,
      y: this.y,
      button: this.button,
      hasModifiers: this.hasModifiers,
      isSpecialKey: this.isSpecialKey
    };
  }

  /**
   * Creates a copy of this event
   * @returns {InputEvent} New event instance with same properties
   */
  clone() {
    const cloned = new InputEvent(
      this.type,
      {
        key: this.key,
        code: this.code,
        ctrlKey: this.ctrlKey,
        altKey: this.altKey,
        shiftKey: this.shiftKey,
        metaKey: this.metaKey,
        x: this.x,
        y: this.y,
        button: this.button
      },
      this.originalEvent
    );

    cloned.id = this.id + "_clone";
    return cloned;
  }
}

/**
 * @class InputBuffer
 * @description Manages buffering and batching of input events for efficient transmission
 */
class InputBuffer {
  /**
   * Creates a new InputBuffer instance
   * @param {Object} [options={}] - Buffer configuration options
   * @param {number} [options.maxSize=100] - Maximum number of events to buffer
   * @param {number} [options.flushInterval=50] - Auto-flush interval in milliseconds
   * @param {number} [options.maxBatchSize=10] - Maximum events per batch transmission
   */
  constructor(options = {}) {
    this.logger = createLogger("InputBuffer", LogLevel.DEBUG);

    this.maxSize = options.maxSize || 100;
    this.flushInterval = options.flushInterval || 50;
    this.maxBatchSize = options.maxBatchSize || 10;

    this.events = [];
    this.flushTimer = null;
    this.flushCallback = null;
    this.autoFlush = true;

    // Buffer statistics
    this.totalEvents = 0;
    this.totalFlushed = 0;
    this.lastFlushTime = 0;
    this.droppedEvents = 0;

    this.logger.info(
      "constructor",
      `Input buffer initialized: maxSize=${this.maxSize}, flushInterval=${
        this.flushInterval
      }ms`
    );
  }

  /**
   * Adds an event to the buffer
   * @param {InputEvent} event - Event to add
   * @returns {boolean} True if event was added successfully
   */
  addEvent(event) {
    if (!(event instanceof InputEvent)) {
      this.logger.error(
        "addEvent",
        "Invalid event type, expected InputEvent instance"
      );
      return false;
    }

    // Check buffer capacity
    if (this.events.length >= this.maxSize) {
      // Remove oldest event to make room
      const dropped = this.events.shift();
      this.droppedEvents++;
      this.logger.warn("addEvent", `Buffer full, dropped event: ${dropped.id}`);
    }

    this.events.push(event);
    this.totalEvents++;

    this.logger.debug(
      "addEvent",
      `Event added to buffer: ${event.getKeyString() || event.type}`,
      {
        bufferSize: this.events.length,
        eventId: event.id
      }
    );

    // Schedule auto-flush if enabled
    if (this.autoFlush && this.flushCallback) {
      this._scheduleFlush();
    }

    return true;
  }

  /**
   * Schedules an automatic flush of the buffer
   * @private
   */
  _scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Flushes pending events from the buffer
   * @param {boolean} [force=false] - Whether to flush even if buffer is small
   * @returns {Array<InputEvent>} Array of events that were flushed
   */
  flush(force = false) {
    if (this.events.length === 0) {
      this.logger.debug("flush", "No events to flush");
      return [];
    }

    // Don't flush small batches unless forced
    if (
      !force &&
      this.events.length < 3 &&
      Date.now() - this.lastFlushTime < this.flushInterval * 2
    ) {
      this.logger.debug("flush", "Deferring flush for larger batch");
      return [];
    }

    const batchSize = Math.min(this.events.length, this.maxBatchSize);
    const flushedEvents = this.events.splice(0, batchSize);

    this.totalFlushed += flushedEvents.length;
    this.lastFlushTime = Date.now();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.logger.debug(
      "flush",
      `Flushed ${flushedEvents.length} events from buffer`,
      {
        remaining: this.events.length,
        batchIds: flushedEvents.map(e => e.id)
      }
    );

    // Call flush callback if registered
    if (this.flushCallback && flushedEvents.length > 0) {
      try {
        this.flushCallback(flushedEvents);
      } catch (error) {
        this.logger.error("flush", "Error in flush callback", error);
      }
    }

    // Schedule next flush if more events remain
    if (this.autoFlush && this.events.length > 0 && this.flushCallback) {
      this._scheduleFlush();
    }

    return flushedEvents;
  }

  /**
   * Sets the callback function for automatic flushing
   * @param {Function} callback - Function to call with flushed events
   */
  setFlushCallback(callback) {
    if (typeof callback !== "function") {
      this.logger.error("setFlushCallback", "Callback must be a function");
      return;
    }

    this.flushCallback = callback;
    this.logger.debug("setFlushCallback", "Flush callback registered");

    // Start auto-flushing if there are pending events
    if (this.autoFlush && this.events.length > 0) {
      this._scheduleFlush();
    }
  }

  /**
   * Enables or disables automatic flushing
   * @param {boolean} enabled - Whether to enable auto-flush
   */
  setAutoFlush(enabled) {
    this.autoFlush = Boolean(enabled);

    if (!this.autoFlush && this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.logger.debug(
      "setAutoFlush",
      `Auto-flush ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Gets the number of pending events in buffer
   * @returns {number} Number of buffered events
   */
  size() {
    return this.events.length;
  }

  /**
   * Checks if buffer is empty
   * @returns {boolean} True if no events are buffered
   */
  isEmpty() {
    return this.events.length === 0;
  }

  /**
   * Clears all buffered events
   * @returns {number} Number of events that were cleared
   */
  clear() {
    const clearedCount = this.events.length;
    this.events = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.logger.info("clear", `Cleared ${clearedCount} events from buffer`);
    return clearedCount;
  }

  /**
   * Gets buffer statistics and performance metrics
   * @returns {Object} Buffer statistics
   */
  getStats() {
    return {
      currentSize: this.events.length,
      maxSize: this.maxSize,
      totalEvents: this.totalEvents,
      totalFlushed: this.totalFlushed,
      droppedEvents: this.droppedEvents,
      autoFlush: this.autoFlush,
      flushInterval: this.flushInterval,
      maxBatchSize: this.maxBatchSize,
      lastFlushTime: this.lastFlushTime,
      hasFlushCallback: !!this.flushCallback
    };
  }
}

/**
 * @class InputStatistics
 * @description Tracks input event statistics and patterns for performance monitoring
 */
class InputStatistics {
  /**
   * Creates a new InputStatistics instance
   */
  constructor() {
    this.logger = createLogger("InputStatistics", LogLevel.DEBUG);

    // Event counters
    this.totalEvents = 0;
    this.keyEvents = 0;
    this.mouseEvents = 0;
    this.focusEvents = 0;

    // Timing statistics
    this.lastInputTime = 0;
    this.firstInputTime = 0;
    this.totalInputTime = 0;

    // Event type breakdown
    this.eventTypes = new Map();
    this.keyFrequency = new Map();

    // Performance metrics
    this.avgEventsPerSecond = 0;
    this.peakEventsPerSecond = 0;
    this.lastSecondEvents = [];

    this.logger.info("constructor", "Input statistics tracker initialized");
  }

  /**
   * Records an input event for statistics tracking
   * @param {InputEvent} event - Event to record
   */
  recordEvent(event) {
    if (!(event instanceof InputEvent)) {
      this.logger.warn("recordEvent", "Invalid event type for statistics");
      return;
    }

    const now = Date.now();

    // Update counters
    this.totalEvents++;
    if (this.firstInputTime === 0) {
      this.firstInputTime = now;
    }
    this.lastInputTime = now;

    // Update event type counters
    if (event.isKeyboardEvent()) {
      this.keyEvents++;

      // Track key frequency
      const keyString = event.getKeyString();
      if (keyString) {
        this.keyFrequency.set(
          keyString,
          (this.keyFrequency.get(keyString) || 0) + 1
        );
      }
    } else if (event.isMouseEvent()) {
      this.mouseEvents++;
    } else if (
      event.type === InputEventType.FOCUS ||
      event.type === InputEventType.BLUR
    ) {
      this.focusEvents++;
    }

    // Track event type distribution
    this.eventTypes.set(event.type, (this.eventTypes.get(event.type) || 0) + 1);

    // Update performance metrics
    this._updatePerformanceMetrics(now);

    this.logger.debug(
      "recordEvent",
      `Event recorded: ${event.getKeyString() || event.type}`,
      {
        totalEvents: this.totalEvents,
        eventType: event.type
      }
    );
  }

  /**
   * Updates performance metrics including events per second
   * @param {number} now - Current timestamp
   * @private
   */
  _updatePerformanceMetrics(now) {
    // Add current event to recent events list
    this.lastSecondEvents.push(now);

    // Remove events older than 1 second
    const oneSecondAgo = now - 1000;
    this.lastSecondEvents = this.lastSecondEvents.filter(
      time => time > oneSecondAgo
    );

    // Calculate current events per second
    const currentEPS = this.lastSecondEvents.length;
    if (currentEPS > this.peakEventsPerSecond) {
      this.peakEventsPerSecond = currentEPS;
    }

    // Calculate average events per second
    if (this.firstInputTime > 0) {
      const totalTimeSeconds = (now - this.firstInputTime) / 1000;
      this.avgEventsPerSecond =
        totalTimeSeconds > 0 ? this.totalEvents / totalTimeSeconds : 0;
    }
  }

  /**
   * Gets the most frequently used keys
   * @param {number} [limit=10] - Maximum number of keys to return
   * @returns {Array<{key: string, count: number}>} Top keys by frequency
   */
  getTopKeys(limit = 10) {
    const sortedKeys = Array.from(this.keyFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));

    this.logger.debug("getTopKeys", `Retrieved top ${sortedKeys.length} keys`);
    return sortedKeys;
  }

  /**
   * Gets input timing patterns and metrics
   * @returns {Object} Timing analysis data
   */
  getTimingAnalysis() {
    const now = Date.now();
    const totalTime = this.lastInputTime - this.firstInputTime;
    const sessionDuration = now - this.firstInputTime;

    return {
      totalEvents: this.totalEvents,
      sessionDuration: sessionDuration,
      activeInputTime: totalTime,
      lastInputAge: now - this.lastInputTime,
      avgEventsPerSecond: parseFloat(this.avgEventsPerSecond.toFixed(2)),
      peakEventsPerSecond: this.peakEventsPerSecond,
      currentEventsPerSecond: this.lastSecondEvents.length,
      inputDensity:
        totalTime > 0
          ? parseFloat((this.totalEvents / (totalTime / 1000)).toFixed(2))
          : 0
    };
  }

  /**
   * Gets complete statistics summary
   * @returns {Object} Complete statistics data
   */
  getStats() {
    const timing = this.getTimingAnalysis();
    const topKeys = this.getTopKeys(5);

    // Convert Maps to objects for JSON serialization
    const eventTypeDistribution = {};
    for (const [type, count] of this.eventTypes) {
      eventTypeDistribution[type] = count;
    }

    const stats = {
      totals: {
        totalEvents: this.totalEvents,
        keyEvents: this.keyEvents,
        mouseEvents: this.mouseEvents,
        focusEvents: this.focusEvents
      },
      timing: timing,
      distribution: eventTypeDistribution,
      topKeys: topKeys,
      performance: {
        avgEventsPerSecond: timing.avgEventsPerSecond,
        peakEventsPerSecond: this.peakEventsPerSecond,
        currentEventsPerSecond: timing.currentEventsPerSecond
      }
    };

    this.logger.debug("getStats", "Retrieved complete statistics", {
      totalEvents: this.totalEvents,
      keyTypes: this.keyFrequency.size
    });

    return stats;
  }

  /**
   * Resets all statistics to initial state
   */
  reset() {
    this.logger.info(
      "reset",
      `Resetting statistics (had ${this.totalEvents} events)`
    );

    this.totalEvents = 0;
    this.keyEvents = 0;
    this.mouseEvents = 0;
    this.focusEvents = 0;
    this.lastInputTime = 0;
    this.firstInputTime = 0;
    this.totalInputTime = 0;
    this.avgEventsPerSecond = 0;
    this.peakEventsPerSecond = 0;
    this.lastSecondEvents = [];

    this.eventTypes.clear();
    this.keyFrequency.clear();
  }
}

/**
 * @class InputManager
 * @description Main input management class coordinating event capture, buffering, and transmission
 */
class InputManager {
  /**
   * Creates a new InputManager instance
   * @param {HTMLElement} targetElement - Element to attach input listeners to
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.buffer] - Buffer configuration options
   * @param {boolean} [options.captureKeyboard=true] - Whether to capture keyboard events
   * @param {boolean} [options.captureMouse=false] - Whether to capture mouse events
   * @param {boolean} [options.captureFocus=true] - Whether to capture focus events
   * @param {Array<string>} [options.preventDefaultKeys] - Keys to prevent default behavior
   */
  constructor(targetElement, options = {}) {
    this.logger = createLogger("InputManager", LogLevel.INFO);

    this.targetElement = targetElement;
    this.captureKeyboard = options.captureKeyboard !== false;
    this.captureMouse = options.captureMouse === true;
    this.captureFocus = options.captureFocus !== false;
    this.preventDefaultKeys = options.preventDefaultKeys || [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Space",
      "Enter",
      "Escape"
    ];

    // Initialize components
    this.buffer = new InputBuffer(options.buffer);
    this.statistics = new InputStatistics();

    // Event listener management
    this.eventListeners = new Map();
    this.isListening = false;

    // Input processing
    this.inputProcessor = null;
    this.processingEnabled = true;

    this.logger.info("constructor", "Input manager initialized", {
      captureKeyboard: this.captureKeyboard,
      captureMouse: this.captureMouse,
      captureFocus: this.captureFocus,
      preventDefaultKeys: this.preventDefaultKeys.length
    });
  }

  /**
   * Starts listening for input events on the target element
   * @returns {boolean} True if listening was started successfully
   */
  startListening() {
    if (this.isListening) {
      this.logger.warn("startListening", "Already listening for input events");
      return false;
    }

    if (!this.targetElement) {
      this.logger.error("startListening", "No target element provided");
      return false;
    }

    this.logger.enter("startListening");

    try {
      this._attachEventListeners();
      this.isListening = true;
      this.logger.info("startListening", "Input event listening started");
      return true;
    } catch (error) {
      this.logger.error("startListening", "Failed to start listening", error);
      return false;
    }
  }

  /**
   * Stops listening for input events
   * @returns {boolean} True if listening was stopped successfully
   */
  stopListening() {
    if (!this.isListening) {
      this.logger.debug("stopListening", "Not currently listening");
      return false;
    }

    this.logger.enter("stopListening");

    try {
      this._detachEventListeners();
      this.isListening = false;
      this.logger.info("stopListening", "Input event listening stopped");
      return true;
    } catch (error) {
      this.logger.error(
        "stopListening",
        "Error while stopping listening",
        error
      );
      return false;
    }
  }

  /**
   * Attaches DOM event listeners to the target element
   * @private
   */
  _attachEventListeners() {
    this.logger.debug("_attachEventListeners", "Attaching event listeners");

    if (this.captureKeyboard) {
      this._addListener("keydown", this._handleKeyDown.bind(this));
      this._addListener("keyup", this._handleKeyUp.bind(this));
    }

    if (this.captureMouse) {
      this._addListener("click", this._handleMouseClick.bind(this));
      this._addListener("mousemove", this._handleMouseMove.bind(this));
    }

    if (this.captureFocus) {
      this._addListener("focus", this._handleFocus.bind(this));
      this._addListener("blur", this._handleBlur.bind(this));
    }

    // Ensure element can receive focus for keyboard events
    if (this.captureKeyboard && this.targetElement.tabIndex < 0) {
      this.targetElement.tabIndex = 0;
      this.logger.debug(
        "_attachEventListeners",
        "Set tabIndex on target element"
      );
    }
  }

  /**
   * Adds an event listener and tracks it for cleanup
   * @param {string} eventType - DOM event type
   * @param {Function} handler - Event handler function
   * @private
   */
  _addListener(eventType, handler) {
    this.targetElement.addEventListener(eventType, handler);
    this.eventListeners.set(eventType, handler);
    this.logger.debug("_addListener", `Added ${eventType} listener`);
  }

  /**
   * Detaches all DOM event listeners
   * @private
   */
  _detachEventListeners() {
    this.logger.debug("_detachEventListeners", "Detaching event listeners");

    for (const [eventType, handler] of this.eventListeners) {
      this.targetElement.removeEventListener(eventType, handler);
      this.logger.debug(
        "_detachEventListeners",
        `Removed ${eventType} listener`
      );
    }

    this.eventListeners.clear();
  }

  /**
   * Handles keyboard key down events
   * @param {KeyboardEvent} event - DOM keyboard event
   * @private
   */
  _handleKeyDown(event) {
    this.logger.debug("_handleKeyDown", `Key pressed: ${event.key}`, {
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });

    // Prevent default behavior for specified keys
    if (this.preventDefaultKeys.includes(event.key)) {
      event.preventDefault();
    }

    const inputEvent = new InputEvent(
      InputEventType.KEY_DOWN,
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
      },
      event
    );

    this._processInputEvent(inputEvent);
  }

  /**
   * Handles keyboard key up events
   * @param {KeyboardEvent} event - DOM keyboard event
   * @private
   */
  _handleKeyUp(event) {
    const inputEvent = new InputEvent(
      InputEventType.KEY_UP,
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
      },
      event
    );

    this._processInputEvent(inputEvent);
  }

  /**
   * Handles mouse click events
   * @param {MouseEvent} event - DOM mouse event
   * @private
   */
  _handleMouseClick(event) {
    this.logger.debug(
      "_handleMouseClick",
      `Mouse clicked at (${event.offsetX}, ${event.offsetY})`,
      {
        button: event.button,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      }
    );

    // Focus element on click for keyboard input
    if (this.captureKeyboard) {
      this.targetElement.focus();
    }

    const inputEvent = new InputEvent(
      InputEventType.MOUSE_CLICK,
      {
        x: event.offsetX,
        y: event.offsetY,
        button: event.button,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
      },
      event
    );

    this._processInputEvent(inputEvent);
  }

  /**
   * Handles mouse move events
   * @param {MouseEvent} event - DOM mouse event
   * @private
   */
  _handleMouseMove(event) {
    // Only process if mouse button is pressed to avoid spam
    if (event.buttons > 0) {
      const inputEvent = new InputEvent(
        InputEventType.MOUSE_MOVE,
        {
          x: event.offsetX,
          y: event.offsetY,
          button: event.buttons,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey
        },
        event
      );

      this._processInputEvent(inputEvent);
    }
  }

  /**
   * Handles focus events
   * @param {FocusEvent} event - DOM focus event
   * @private
   */
  _handleFocus(event) {
    this.logger.debug("_handleFocus", "Element gained focus");

    const inputEvent = new InputEvent(InputEventType.FOCUS, {}, event);
    this._processInputEvent(inputEvent);
  }

  /**
   * Handles blur events
   * @param {FocusEvent} event - DOM focus event
   * @private
   */
  _handleBlur(event) {
    this.logger.debug("_handleBlur", "Element lost focus");

    const inputEvent = new InputEvent(InputEventType.BLUR, {}, event);
    this._processInputEvent(inputEvent);
  }

  /**
   * Processes an input event through the manager pipeline
   * @param {InputEvent} inputEvent - Event to process
   * @private
   */
  _processInputEvent(inputEvent) {
    if (!this.processingEnabled) {
      this.logger.debug(
        "_processInputEvent",
        "Processing disabled, ignoring event"
      );
      return;
    }

    // Record statistics
    this.statistics.recordEvent(inputEvent);

    // Add to buffer
    const added = this.buffer.addEvent(inputEvent);
    if (!added) {
      this.logger.warn("_processInputEvent", "Failed to add event to buffer");
      return;
    }

    // Call custom processor if registered
    if (this.inputProcessor) {
      try {
        this.inputProcessor(inputEvent);
      } catch (error) {
        this.logger.error(
          "_processInputEvent",
          "Error in input processor",
          error
        );
      }
    }
  }

  /**
   * Sets a custom input event processor
   * @param {Function} processor - Function to call for each input event
   */
  setInputProcessor(processor) {
    if (typeof processor !== "function") {
      this.logger.error("setInputProcessor", "Processor must be a function");
      return;
    }

    this.inputProcessor = processor;
    this.logger.info("setInputProcessor", "Custom input processor registered");
  }

  /**
   * Sets the callback for buffer flush events
   * @param {Function} callback - Function to call with batched events
   */
  setFlushCallback(callback) {
    this.buffer.setFlushCallback(callback);
    this.logger.info("setFlushCallback", "Buffer flush callback registered");
  }

  /**
   * Manually flushes the input buffer
   * @param {boolean} [force=true] - Whether to force flush regardless of buffer size
   * @returns {Array<InputEvent>} Events that were flushed
   */
  flush(force = true) {
    this.logger.debug("flush", "Manual buffer flush requested");
    return this.buffer.flush(force);
  }

  /**
   * Enables or disables input processing
   * @param {boolean} enabled - Whether to enable processing
   */
  setProcessingEnabled(enabled) {
    this.processingEnabled = Boolean(enabled);
    this.logger.info(
      "setProcessingEnabled",
      `Input processing ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Gets comprehensive input manager statistics
   * @returns {Object} Complete statistics and status information
   */
  getStats() {
    return {
      listening: this.isListening,
      processingEnabled: this.processingEnabled,
      targetElement: this.targetElement ? this.targetElement.tagName : null,
      capture: {
        keyboard: this.captureKeyboard,
        mouse: this.captureMouse,
        focus: this.captureFocus
      },
      buffer: this.buffer.getStats(),
      statistics: this.statistics.getStats(),
      listeners: Array.from(this.eventListeners.keys()),
      preventDefaultKeys: this.preventDefaultKeys
    };
  }

  /**
   * Resets all statistics and clears buffers
   */
  reset() {
    this.logger.info("reset", "Resetting input manager state");

    this.buffer.clear();
    this.statistics.reset();
  }

  /**
   * Destroys the input manager and cleans up resources
   */
  destroy() {
    this.logger.enter("destroy");

    this.stopListening();
    this.buffer.clear();
    this.statistics.reset();
    this.inputProcessor = null;

    this.logger.info("destroy", "Input manager destroyed");
  }
}

// Export public interface
export {
  InputManager,
  InputEvent,
  InputBuffer,
  InputStatistics,
  InputEventType,
  SpecialKeys
};

console.log("[InputManager] Input management module loaded successfully");
