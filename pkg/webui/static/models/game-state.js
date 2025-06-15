/**
 * @fileoverview Game state data model for terminal-based roguelike game display
 * @module models/game-state
 * @requires utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";

/**
 * @class GameCell
 * @classdesc Represents a single character cell in the game terminal buffer with visual styling and tileset support
 * @since 1.0.0
 */
class GameCell {
  /**
   * Creates a new GameCell instance with character data and visual styling
   * @constructor
   * @memberof GameCell
   * @param {Object} [data={}] - Cell data from server
   * @param {string|number} [data.char=' '] - Character to display (string or char code)
   * @param {string} [data.fg_color='#FFFFFF'] - Foreground color in hex format
   * @param {string} [data.bg_color='#000000'] - Background color in hex format
   * @param {boolean} [data.bold=false] - Bold text styling flag
   * @param {boolean} [data.inverse=false] - Inverse video styling flag
   * @param {boolean} [data.blink=false] - Blinking text effect flag
   * @param {number} [data.tile_x] - Tileset X coordinate (if using tileset)
   * @param {number} [data.tile_y] - Tileset Y coordinate (if using tileset)
   * @throws {TypeError} When data parameter is not an object
   * @example
   * // Create a basic cell with default values
   * const cell = new GameCell();
   * 
   * // Create a cell with custom character and colors
   * const styledCell = new GameCell({
   *   char: '@',
   *   fg_color: '#FF0000',
   *   bg_color: '#000000',
   *   bold: true
   * });
   * @since 1.0.0
   */
  constructor(data = {}) {
    console.debug(`[GameCell] - DEBUG: Creating cell with data: ${JSON.stringify(data)}`);
    
    if (data !== null && typeof data !== 'object') {
      console.error(`[GameCell] - ERROR: Invalid data type ${typeof data}, expected object`);
      throw new TypeError('GameCell constructor expects an object or null');
    }
    
    this.char = data.char !== undefined ? data.char : " ";
    this.fg_color = data.fg_color || "#FFFFFF";
    this.bg_color = data.bg_color || "#000000";
    this.bold = Boolean(data.bold);
    this.inverse = Boolean(data.inverse);
    this.blink = Boolean(data.blink);
    this.tile_x = data.tile_x;
    this.tile_y = data.tile_y;
    this.timestamp = Date.now();
    
    console.info(`[GameCell] - INFO: Cell created with character '${this.char}' and colors fg:${this.fg_color} bg:${this.bg_color}`);
  }

  /**
   * Gets the display character as a string representation for rendering
   * @memberof GameCell
   * @returns {string} Character to display, converted from char code if needed
   * @throws {TypeError} When character cannot be converted to string
   * @example
   * const cell = new GameCell({ char: 65 }); // ASCII code for 'A'
   * console.log(cell.getDisplayChar()); // Returns 'A'
   * @since 1.0.0
   */
  getDisplayChar() {
    console.debug(`[GameCell.getDisplayChar] - DEBUG: Converting character type ${typeof this.char}, value: ${this.char}`);
    
    try {
      if (typeof this.char === "number") {
        const result = String.fromCharCode(this.char);
        console.info(`[GameCell.getDisplayChar] - INFO: Converted char code ${this.char} to character '${result}'`);
        return result;
      }
      const result = this.char || " ";
      console.debug(`[GameCell.getDisplayChar] - DEBUG: Using string character '${result}'`);
      return result;
    } catch (error) {
      console.error(`[GameCell.getDisplayChar] - ERROR: Failed to convert character: ${error.message}`);
      throw new TypeError(`Cannot convert character to string: ${error.message}`);
    }
  }

  /**
   * Checks if this cell has tileset coordinates defined for graphical rendering
   * @memberof GameCell
   * @returns {boolean} True if tile coordinates are defined and valid
   * @throws {Error} Never throws
   * @example
   * const cell = new GameCell({ tile_x: 5, tile_y: 10 });
   * console.log(cell.hasTileCoordinates()); // Returns true
   * @since 1.0.0
   */
  hasTileCoordinates() {
    console.debug(`[GameCell.hasTileCoordinates] - DEBUG: Checking tile coordinates x:${this.tile_x} y:${this.tile_y}`);
    
    const hasCoords = this.tile_x !== undefined && this.tile_y !== undefined;
    console.info(`[GameCell.hasTileCoordinates] - INFO: Cell ${hasCoords ? 'has' : 'does not have'} tile coordinates`);
    return hasCoords;
  }

  /**
   * Checks if this cell represents an empty space with default styling
   * @memberof GameCell
   * @returns {boolean} True if cell is effectively empty (space character with black background)
   * @throws {Error} Never throws
   * @example
   * const emptyCell = new GameCell();
   * console.log(emptyCell.isEmpty()); // Returns true
   * @since 1.0.0
   */
  isEmpty() {
    console.debug(`[GameCell.isEmpty] - DEBUG: Checking if cell is empty - char:'${this.getDisplayChar()}' bg:'${this.bg_color}'`);
    
    const char = this.getDisplayChar();
    const isEmpty = char === " " && this.bg_color === "#000000";
    console.info(`[GameCell.isEmpty] - INFO: Cell is ${isEmpty ? 'empty' : 'not empty'}`);
    return isEmpty;
  }

  /**
   * Creates a deep copy of this cell with identical properties
   * @memberof GameCell
   * @returns {GameCell} New cell instance with same properties
   * @throws {Error} Never throws
   * @example
   * const originalCell = new GameCell({ char: 'X', fg_color: '#FF0000' });
   * const clonedCell = originalCell.clone();
   * console.log(clonedCell.char); // Returns 'X'
   * @since 1.0.0
   */
  clone() {
    console.debug(`[GameCell.clone] - DEBUG: Cloning cell with char:'${this.char}'`);
    
    const cloned = new GameCell({
      char: this.char,
      fg_color: this.fg_color,
      bg_color: this.bg_color,
      bold: this.bold,
      inverse: this.inverse,
      blink: this.blink,
      tile_x: this.tile_x,
      tile_y: this.tile_y
    });
    
    console.info(`[GameCell.clone] - INFO: Cell cloned successfully`);
    return cloned;
  }

  /**
   * Checks if this cell is equivalent to another cell by comparing all properties
   * @memberof GameCell
   * @param {GameCell} other - Cell to compare with
   * @returns {boolean} True if cells are equivalent
   * @throws {TypeError} When other parameter is not a GameCell instance
   * @example
   * const cell1 = new GameCell({ char: 'A' });
   * const cell2 = new GameCell({ char: 'A' });
   * console.log(cell1.equals(cell2)); // Returns true
   * @since 1.0.0
   */
  equals(other) {
    console.debug(`[GameCell.equals] - DEBUG: Comparing cell with another cell`);
    
    if (!other) {
      console.warn(`[GameCell.equals] - WARN: Comparison with null/undefined cell`);
      return false;
    }
    
    if (!(other instanceof GameCell)) {
      console.error(`[GameCell.equals] - ERROR: Comparison with non-GameCell object`);
      throw new TypeError('Cannot compare GameCell with non-GameCell object');
    }

    const isEqual = (
      this.char === other.char &&
      this.fg_color === other.fg_color &&
      this.bg_color === other.bg_color &&
      this.bold === other.bold &&
      this.inverse === other.inverse &&
      this.blink === other.blink &&
      this.tile_x === other.tile_x &&
      this.tile_y === other.tile_y
    );
    
    console.info(`[GameCell.equals] - INFO: Cells are ${isEqual ? 'equal' : 'different'}`);
    return isEqual;
  }

  /**
   * Converts cell to JSON representation for serialization and transmission
   * @memberof GameCell
   * @returns {Object} JSON-serializable cell data with all properties
   * @throws {Error} Never throws
   * @example
   * const cell = new GameCell({ char: 'X', fg_color: '#FF0000' });
   * const json = cell.toJSON();
   * console.log(json.char); // Returns 'X'
   * @since 1.0.0
   */
  toJSON() {
    console.debug(`[GameCell.toJSON] - DEBUG: Converting cell to JSON`);
    
    const jsonData = {
      char: this.char,
      fg_color: this.fg_color,
      bg_color: this.bg_color,
      bold: this.bold,
      inverse: this.inverse,
      blink: this.blink,
      tile_x: this.tile_x,
      tile_y: this.tile_y,
      timestamp: this.timestamp
    };
    
    console.info(`[GameCell.toJSON] - INFO: Cell converted to JSON successfully`);
    return jsonData;
  }
}

/**
 * @class CursorPosition
 * @classdesc Represents cursor position and visibility state with bounds checking and update tracking
 * @since 1.0.0
 */
class CursorPosition {
  /**
   * Creates a new CursorPosition instance with coordinate validation
   * @constructor
   * @memberof CursorPosition
   * @param {number} [x=0] - X coordinate (will be clamped to non-negative)
   * @param {number} [y=0] - Y coordinate (will be clamped to non-negative)
   * @param {boolean} [visible=true] - Cursor visibility state
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * // Create cursor at origin
   * const cursor = new CursorPosition();
   * 
   * // Create cursor at specific position
   * const positioned = new CursorPosition(10, 5, true);
   * @since 1.0.0
   */
  constructor(x = 0, y = 0, visible = true) {
    console.debug(`[CursorPosition] - DEBUG: Creating cursor at position (${x}, ${y}), visible: ${visible}`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[CursorPosition] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cursor coordinates must be numbers');
    }
    
    this.x = Math.max(0, x);
    this.y = Math.max(0, y);
    this.visible = Boolean(visible);
    this.lastUpdate = Date.now();
    
    console.info(`[CursorPosition] - INFO: Cursor created at (${this.x}, ${this.y}), visible: ${this.visible}`);
  }

  /**
   * Updates cursor position with coordinate validation and timestamp tracking
   * @memberof CursorPosition
   * @param {number} x - New X coordinate (will be clamped to non-negative)
   * @param {number} y - New Y coordinate (will be clamped to non-negative)
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * const cursor = new CursorPosition();
   * cursor.moveTo(10, 5);
   * console.log(cursor.x); // Returns 10
   * @since 1.0.0
   */
  moveTo(x, y) {
    console.debug(`[CursorPosition.moveTo] - DEBUG: Moving cursor from (${this.x}, ${this.y}) to (${x}, ${y})`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[CursorPosition.moveTo] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cursor coordinates must be numbers');
    }
    
    const oldX = this.x;
    const oldY = this.y;
    
    this.x = Math.max(0, x);
    this.y = Math.max(0, y);
    this.lastUpdate = Date.now();
    
    console.info(`[CursorPosition.moveTo] - INFO: Cursor moved from (${oldX}, ${oldY}) to (${this.x}, ${this.y})`);
  }

  /**
   * Sets cursor visibility state with timestamp update
   * @memberof CursorPosition
   * @param {boolean} visible - New visibility state
   * @throws {Error} Never throws
   * @example
   * const cursor = new CursorPosition();
   * cursor.setVisible(false);
   * console.log(cursor.visible); // Returns false
   * @since 1.0.0
   */
  setVisible(visible) {
    console.debug(`[CursorPosition.setVisible] - DEBUG: Changing cursor visibility from ${this.visible} to ${visible}`);
    
    const oldVisible = this.visible;
    this.visible = Boolean(visible);
    this.lastUpdate = Date.now();
    
    console.info(`[CursorPosition.setVisible] - INFO: Cursor visibility changed from ${oldVisible} to ${this.visible}`);
  }

  /**
   * Checks if cursor is at the specified position
   * @memberof CursorPosition
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if cursor is at the specified position
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * const cursor = new CursorPosition(5, 10);
   * console.log(cursor.isAt(5, 10)); // Returns true
   * @since 1.0.0
   */
  isAt(x, y) {
    console.debug(`[CursorPosition.isAt] - DEBUG: Checking if cursor at (${this.x}, ${this.y}) matches (${x}, ${y})`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[CursorPosition.isAt] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cursor coordinates must be numbers');
    }
    
    const isAtPosition = this.x === x && this.y === y;
    console.info(`[CursorPosition.isAt] - INFO: Cursor is ${isAtPosition ? 'at' : 'not at'} position (${x}, ${y})`);
    return isAtPosition;
  }

  /**
   * Converts cursor to JSON representation for serialization
   * @memberof CursorPosition
   * @returns {Object} JSON-serializable cursor data with position and metadata
   * @throws {Error} Never throws
   * @example
   * const cursor = new CursorPosition(5, 10);
   * const json = cursor.toJSON();
   * console.log(json.x); // Returns 5
   * @since 1.0.0
   */
  toJSON() {
    console.debug(`[CursorPosition.toJSON] - DEBUG: Converting cursor to JSON representation`);
    
    const jsonData = {
      x: this.x,
      y: this.y,
      visible: this.visible,
      lastUpdate: this.lastUpdate
    };
    
    console.info(`[CursorPosition.toJSON] - INFO: Cursor converted to JSON successfully`);
    return jsonData;
  }
}

/**
 * @class StateChangeTracker
 * @classdesc Tracks changes to game state for efficient updates and differential rendering
 * @since 1.0.0
 */
class StateChangeTracker {
  /**
   * Creates a new StateChangeTracker instance with logging capabilities
   * @constructor
   * @memberof StateChangeTracker
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCellChanged(5, 10);
   * console.log(tracker.hasChanges()); // Returns true
   * @since 1.0.0
   */
  constructor() {
    console.debug(`[StateChangeTracker] - DEBUG: Initializing change tracker`);
    
    this.logger = createLogger("StateChangeTracker", LogLevel.DEBUG);
    this.changedCells = new Set();
    this.cursorChanged = false;
    this.dimensionsChanged = false;
    this.lastChangeTime = 0;
    
    console.info(`[StateChangeTracker] - INFO: Change tracker initialized successfully`);
  }

  /**
   * Records a cell change at specified coordinates for tracking dirty regions
   * @memberof StateChangeTracker
   * @param {number} x - Cell X coordinate
   * @param {number} y - Cell Y coordinate
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCellChanged(10, 5);
   * console.log(tracker.getChangedCells().length); // Returns 1
   * @since 1.0.0
   */
  markCellChanged(x, y) {
    console.debug(`[StateChangeTracker.markCellChanged] - DEBUG: Marking cell (${x}, ${y}) as changed`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[StateChangeTracker.markCellChanged] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cell coordinates must be numbers');
    }
    
    const key = `${x},${y}`;
    this.changedCells.add(key);
    this.lastChangeTime = Date.now();
    
    console.info(`[StateChangeTracker.markCellChanged] - INFO: Cell marked as changed: (${x}, ${y}), total changed: ${this.changedCells.size}`);
    this.logger.debug(
      "markCellChanged",
      `Cell marked as changed: (${x}, ${y})`
    );
  }

  /**
   * Records cursor position change for rendering updates
   * @memberof StateChangeTracker
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCursorChanged();
   * console.log(tracker.getStats().cursorChanged); // Returns true
   * @since 1.0.0
   */
  markCursorChanged() {
    console.debug(`[StateChangeTracker.markCursorChanged] - DEBUG: Marking cursor as changed`);
    
    this.cursorChanged = true;
    this.lastChangeTime = Date.now();
    
    console.info(`[StateChangeTracker.markCursorChanged] - INFO: Cursor position marked as changed`);
    this.logger.debug("markCursorChanged", "Cursor position marked as changed");
  }

  /**
   * Records dimension change for buffer resize operations
   * @memberof StateChangeTracker
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markDimensionsChanged();
   * console.log(tracker.getStats().dimensionsChanged); // Returns true
   * @since 1.0.0
   */
  markDimensionsChanged() {
    console.debug(`[StateChangeTracker.markDimensionsChanged] - DEBUG: Marking dimensions as changed`);
    
    this.dimensionsChanged = true;
    this.lastChangeTime = Date.now();
    
    console.info(`[StateChangeTracker.markDimensionsChanged] - INFO: Dimensions marked as changed`);
    this.logger.debug("markDimensionsChanged", "Dimensions marked as changed");
  }

  /**
   * Gets all changed cell coordinates as an array for batch processing
   * @memberof StateChangeTracker
   * @returns {Array<{x: number, y: number}>} Array of changed cell positions
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCellChanged(5, 10);
   * const changes = tracker.getChangedCells();
   * console.log(changes[0]); // Returns {x: 5, y: 10}
   * @since 1.0.0
   */
  getChangedCells() {
    console.debug(`[StateChangeTracker.getChangedCells] - DEBUG: Retrieving ${this.changedCells.size} changed cells`);
    
    const cells = Array.from(this.changedCells).map(key => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });

    console.info(`[StateChangeTracker.getChangedCells] - INFO: Retrieved ${cells.length} changed cells`);
    this.logger.debug(
      "getChangedCells",
      `Retrieved ${cells.length} changed cells`
    );
    return cells;
  }

  /**
   * Checks if there are any pending changes requiring updates
   * @memberof StateChangeTracker
   * @returns {boolean} True if any changes exist (cells, cursor, or dimensions)
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCellChanged(5, 10);
   * console.log(tracker.hasChanges()); // Returns true
   * @since 1.0.0
   */
  hasChanges() {
    console.debug(`[StateChangeTracker.hasChanges] - DEBUG: Checking for changes - cells: ${this.changedCells.size}, cursor: ${this.cursorChanged}, dimensions: ${this.dimensionsChanged}`);
    
    const hasChanges = (
      this.changedCells.size > 0 || this.cursorChanged || this.dimensionsChanged
    );
    
    console.info(`[StateChangeTracker.hasChanges] - INFO: Change tracker ${hasChanges ? 'has' : 'has no'} pending changes`);
    return hasChanges;
  }

  /**
   * Clears all tracked changes and resets state flags
   * @memberof StateChangeTracker
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * tracker.markCellChanged(5, 10);
   * tracker.clearChanges();
   * console.log(tracker.hasChanges()); // Returns false
   * @since 1.0.0
   */
  clearChanges() {
    console.debug(`[StateChangeTracker.clearChanges] - DEBUG: Clearing ${this.changedCells.size} cell changes and flags`);
    
    const cellCount = this.changedCells.size;
    this.changedCells.clear();
    this.cursorChanged = false;
    this.dimensionsChanged = false;

    console.info(`[StateChangeTracker.clearChanges] - INFO: Cleared ${cellCount} cell changes and reset all flags`);
    this.logger.debug(
      "clearChanges",
      `Cleared ${cellCount} cell changes and flags`
    );
  }

  /**
   * Gets comprehensive change tracking statistics and metadata
   * @memberof StateChangeTracker
   * @returns {Object} Change tracking statistics including counts and timestamps
   * @throws {Error} Never throws
   * @example
   * const tracker = new StateChangeTracker();
   * const stats = tracker.getStats();
   * console.log(stats.changedCells); // Returns number of changed cells
   * @since 1.0.0
   */
  getStats() {
    console.debug(`[StateChangeTracker.getStats] - DEBUG: Generating statistics report`);
    
    const stats = {
      changedCells: this.changedCells.size,
      cursorChanged: this.cursorChanged,
      dimensionsChanged: this.dimensionsChanged,
      lastChangeTime: this.lastChangeTime,
      hasChanges: this.hasChanges()
    };
    
    console.info(`[StateChangeTracker.getStats] - INFO: Generated statistics - ${stats.changedCells} cell changes, flags: cursor=${stats.cursorChanged}, dimensions=${stats.dimensionsChanged}`);
    return stats;
  }
}

/**
 * @class GameState
 * @classdesc Complete game state model with terminal buffer, cursor, and change tracking for roguelike games
 * @since 1.0.0
 */
class GameState {
  /**
   * Creates a new GameState instance with terminal buffer and tracking capabilities
   * @constructor
   * @memberof GameState
   * @param {Object} [data={}] - Initial state data from server
   * @param {number} [data.width=80] - Terminal width in characters
   * @param {number} [data.height=24] - Terminal height in characters
   * @param {number} [data.version=0] - State version number for synchronization
   * @param {Array} [data.buffer] - 2D array of cell data for terminal content
   * @param {number} [data.cursor_x=0] - Cursor X position
   * @param {number} [data.cursor_y=0] - Cursor Y position
   * @param {number} [data.timestamp] - State timestamp for tracking updates
   * @throws {TypeError} When data parameter is not an object or dimensions are invalid
   * @example
   * // Create default 80x24 terminal
   * const state = new GameState();
   * 
   * // Create custom sized terminal with initial data
   * const customState = new GameState({
   *   width: 120,
   *   height: 40,
   *   version: 1
   * });
   * @since 1.0.0
   */
  constructor(data = {}) {
    console.debug(`[GameState] - DEBUG: Initializing game state with data: ${JSON.stringify(data, null, 2)}`);
    
    if (data !== null && typeof data !== 'object') {
      console.error(`[GameState] - ERROR: Invalid data type ${typeof data}, expected object`);
      throw new TypeError('GameState constructor expects an object or null');
    }
    
    this.logger = createLogger("GameState", LogLevel.INFO);

    // Terminal dimensions with validation
    this.width = Math.max(1, data.width || 80);
    this.height = Math.max(1, data.height || 24);
    
    if (data.width && data.width < 1) {
      console.warn(`[GameState] - WARN: Width ${data.width} clamped to minimum 1`);
    }
    if (data.height && data.height < 1) {
      console.warn(`[GameState] - WARN: Height ${data.height} clamped to minimum 1`);
    }

    // State metadata
    this.version = data.version || 0;
    this.timestamp = data.timestamp || Date.now();

    // Cursor position
    this.cursor = new CursorPosition(data.cursor_x || 0, data.cursor_y || 0);

    // Change tracking
    this.changeTracker = new StateChangeTracker();

    // Initialize buffer
    this.buffer = this._createBuffer();

    // Load initial buffer data if provided
    if (data.buffer) {
      this._loadBufferData(data.buffer);
    }

    console.info(`[GameState] - INFO: Game state initialized successfully - ${this.width}x${this.height}, version ${this.version}`);
    this.logger.info(
      "constructor",
      `Game state initialized: ${this.width}x${this.height}, version ${
        this.version
      }`
    );
  }

  /**
   * Creates an empty terminal buffer with default cells
   * @memberof GameState
   * @returns {Array<Array<GameCell>>} 2D array of empty cells
   * @throws {Error} Never throws
   * @private
   * @example
   * // Internal method called during initialization
   * const buffer = this._createBuffer();
   * console.log(buffer.length); // Returns height
   * @since 1.0.0
   */
  _createBuffer() {
    console.debug(`[GameState._createBuffer] - DEBUG: Creating buffer with dimensions ${this.width}x${this.height}`);
    
    this.logger.debug(
      "_createBuffer",
      `Creating buffer: ${this.width}x${this.height}`
    );

    const buffer = [];
    for (let y = 0; y < this.height; y++) {
      buffer[y] = [];
      for (let x = 0; x < this.width; x++) {
        buffer[y][x] = new GameCell();
      }
    }

    console.info(`[GameState._createBuffer] - INFO: Buffer created successfully with ${this.width * this.height} cells`);
    return buffer;
  }

  /**
   * Loads buffer data from server response into the terminal buffer
   * @memberof GameState
   * @param {Array} bufferData - 2D array of cell data from server
   * @throws {TypeError} When bufferData is not an array
   * @private
   * @example
   * // Internal method called during initialization
   * this._loadBufferData(serverData.buffer);
   * @since 1.0.0
   */
  _loadBufferData(bufferData) {
    console.debug(`[GameState._loadBufferData] - DEBUG: Loading buffer data with ${bufferData ? bufferData.length : 0} rows`);
    
    this.logger.enter("_loadBufferData", {
      rows: bufferData ? bufferData.length : 0
    });

    if (!Array.isArray(bufferData)) {
      console.error(`[GameState._loadBufferData] - ERROR: Invalid buffer data format, expected array but got ${typeof bufferData}`);
      this.logger.warn(
        "_loadBufferData",
        "Invalid buffer data format, expected array"
      );
      throw new TypeError('Buffer data must be an array');
    }

    let loadedCells = 0;

    for (let y = 0; y < Math.min(bufferData.length, this.height); y++) {
      if (!Array.isArray(bufferData[y])) {
        console.warn(`[GameState._loadBufferData] - WARN: Row ${y} is not an array, skipping`);
        continue;
      }

      for (let x = 0; x < Math.min(bufferData[y].length, this.width); x++) {
        if (bufferData[y][x]) {
          try {
            this.buffer[y][x] = new GameCell(bufferData[y][x]);
            loadedCells++;
          } catch (error) {
            console.error(`[GameState._loadBufferData] - ERROR: Failed to create cell at (${x}, ${y}): ${error.message}`);
          }
        }
      }
    }

    console.info(`[GameState._loadBufferData] - INFO: Successfully loaded ${loadedCells} cells from buffer data`);
    this.logger.exit("_loadBufferData", { loadedCells });
  }

  /**
   * Gets a cell at the specified position with bounds checking
   * @memberof GameState
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {GameCell|null} Cell at position or null if out of bounds
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * const state = new GameState();
   * const cell = state.getCell(10, 5);
   * if (cell) console.log(cell.getDisplayChar());
   * @since 1.0.0
   */
  getCell(x, y) {
    console.debug(`[GameState.getCell] - DEBUG: Getting cell at position (${x}, ${y})`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[GameState.getCell] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cell coordinates must be numbers');
    }
    
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      console.warn(`[GameState.getCell] - WARN: Coordinates (${x}, ${y}) out of bounds ${this.width}x${this.height}`);
      return null;
    }

    const cell = this.buffer[y][x];
    console.info(`[GameState.getCell] - INFO: Retrieved cell at (${x}, ${y})`);
    return cell;
  }

  /**
   * Sets a cell at the specified position with change tracking
   * @memberof GameState
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {GameCell|Object} cellData - Cell instance or cell data object
   * @returns {boolean} True if cell was set successfully
   * @throws {TypeError} When coordinates are not numbers or cellData is invalid
   * @example
   * const state = new GameState();
   * const success = state.setCell(10, 5, { char: 'X', fg_color: '#FF0000' });
   * console.log(success); // Returns true if successful
   * @since 1.0.0
   */
  setCell(x, y, cellData) {
    console.debug(`[GameState.setCell] - DEBUG: Setting cell at (${x}, ${y}) with data: ${JSON.stringify(cellData)}`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[GameState.setCell] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cell coordinates must be numbers');
    }
    
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      console.warn(`[GameState.setCell] - WARN: Attempted to set cell out of bounds: (${x}, ${y}) in ${this.width}x${this.height}`);
      this.logger.warn(
        "setCell",
        `Attempted to set cell out of bounds: (${x}, ${y})`
      );
      return false;
    }

    try {
      const cell = cellData instanceof GameCell ? cellData : new GameCell(cellData);
      const oldCell = this.buffer[y][x];

      // Only update if cell actually changed
      if (!oldCell.equals(cell)) {
        this.buffer[y][x] = cell;
        this.changeTracker.markCellChanged(x, y);
        console.info(`[GameState.setCell] - INFO: Cell updated at (${x}, ${y})`);
        this.logger.debug("setCell", `Cell updated at (${x}, ${y})`);
      } else {
        console.debug(`[GameState.setCell] - DEBUG: Cell at (${x}, ${y}) unchanged, skipping update`);
      }

      return true;
    } catch (error) {
      console.error(`[GameState.setCell] - ERROR: Failed to set cell at (${x}, ${y}): ${error.message}`);
      throw new TypeError(`Cannot set cell: ${error.message}`);
    }
  }

  /**
   * Resizes the terminal buffer and preserves existing content where possible
   * @memberof GameState
   * @param {number} newWidth - New terminal width in characters
   * @param {number} newHeight - New terminal height in characters
   * @throws {TypeError} When dimensions are not numbers or are invalid
   * @example
   * const state = new GameState({ width: 80, height: 24 });
   * state.resize(120, 40);
   * console.log(state.width); // Returns 120
   * @since 1.0.0
   */
  resize(newWidth, newHeight) {
    console.debug(`[GameState.resize] - DEBUG: Resizing from ${this.width}x${this.height} to ${newWidth}x${newHeight}`);
    
    if (typeof newWidth !== 'number' || typeof newHeight !== 'number') {
      console.error(`[GameState.resize] - ERROR: Invalid dimension types - width: ${typeof newWidth}, height: ${typeof newHeight}`);
      throw new TypeError('Terminal dimensions must be numbers');
    }
    
    if (newWidth < 1 || newHeight < 1) {
      console.error(`[GameState.resize] - ERROR: Invalid dimensions ${newWidth}x${newHeight}, must be positive`);
      throw new TypeError('Terminal dimensions must be positive numbers');
    }
    
    this.logger.enter("resize", {
      oldSize: `${this.width}x${this.height}`,
      newSize: `${newWidth}x${newHeight}`
    });

    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = Math.max(1, newWidth);
    this.height = Math.max(1, newHeight);

    // Create new buffer
    const newBuffer = this._createBuffer();

    // Copy existing data
    let copiedCells = 0;
    for (let y = 0; y < Math.min(oldHeight, this.height); y++) {
      for (let x = 0; x < Math.min(oldWidth, this.width); x++) {
        if (this.buffer[y] && this.buffer[y][x]) {
          newBuffer[y][x] = this.buffer[y][x];
          copiedCells++;
        }
      }
    }

    this.buffer = newBuffer;
    this.changeTracker.markDimensionsChanged();

    // Ensure cursor is within bounds
    if (this.cursor.x >= this.width) {
      console.warn(`[GameState.resize] - WARN: Cursor X ${this.cursor.x} out of bounds, adjusting to ${this.width - 1}`);
      this.cursor.x = this.width - 1;
      this.changeTracker.markCursorChanged();
    }
    if (this.cursor.y >= this.height) {
      console.warn(`[GameState.resize] - WARN: Cursor Y ${this.cursor.y} out of bounds, adjusting to ${this.height - 1}`);
      this.cursor.y = this.height - 1;
      this.changeTracker.markCursorChanged();
    }

    console.info(`[GameState.resize] - INFO: Resize completed successfully, copied ${copiedCells} existing cells`);
    this.logger.exit("resize", { success: true });
  }

  /**
   * Updates cursor position with bounds checking and change tracking
   * @memberof GameState
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   * @throws {TypeError} When coordinates are not numbers
   * @example
   * const state = new GameState();
   * state.moveCursor(10, 5);
   * console.log(state.cursor.x); // Returns 10
   * @since 1.0.0
   */
  moveCursor(x, y) {
    console.debug(`[GameState.moveCursor] - DEBUG: Moving cursor from (${this.cursor.x}, ${this.cursor.y}) to (${x}, ${y})`);
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.error(`[GameState.moveCursor] - ERROR: Invalid coordinate types - x: ${typeof x}, y: ${typeof y}`);
      throw new TypeError('Cursor coordinates must be numbers');
    }
    
    const oldX = this.cursor.x;
    const oldY = this.cursor.y;

    this.cursor.moveTo(
      Math.max(0, Math.min(x, this.width - 1)),
      Math.max(0, Math.min(y, this.height - 1))
    );

    if (oldX !== this.cursor.x || oldY !== this.cursor.y) {
      this.changeTracker.markCursorChanged();
      console.info(`[GameState.moveCursor] - INFO: Cursor moved from (${oldX}, ${oldY}) to (${this.cursor.x}, ${this.cursor.y})`);
      this.logger.debug(
        "moveCursor",
        `Cursor moved from (${oldX}, ${oldY}) to (${this.cursor.x}, ${
          this.cursor.y
        })`
      );
    } else {
      console.debug(`[GameState.moveCursor] - DEBUG: Cursor position unchanged after bounds checking`);
    }
  }

  /**
   * Applies state changes from server diff with comprehensive validation and error handling
   * @memberof GameState
   * @param {Object} diff - State diff from server containing updates
   * @param {number} [diff.version] - New version number for synchronization
   * @param {number} [diff.cursor_x] - New cursor X position
   * @param {number} [diff.cursor_y] - New cursor Y position
   * @param {Array} [diff.changes] - Array of cell changes to apply
   * @param {number} [diff.timestamp] - Update timestamp
   * @throws {TypeError} When diff parameter is not an object
   * @example
   * const state = new GameState();
   * state.applyChanges({
   *   version: 2,
   *   cursor_x: 10,
   *   cursor_y: 5,
   *   changes: [{x: 0, y: 0, char: 'X', fg_color: '#FF0000'}]
   * });
   * @since 1.0.0
   */
  applyChanges(diff) {
    console.debug(`[GameState.applyChanges] - DEBUG: Applying changes - version: ${diff?.version}, changes: ${diff?.changes?.length || 0}`);
    
    this.logger.enter("applyChanges", {
      version: diff?.version,
      hasChanges: Array.isArray(diff?.changes),
      changeCount: diff?.changes ? diff.changes.length : 0
    });

    if (!diff) {
      console.warn(`[GameState.applyChanges] - WARN: No diff provided`);
      this.logger.warn("applyChanges", "No diff provided");
      return;
    }
    
    if (typeof diff !== 'object') {
      console.error(`[GameState.applyChanges] - ERROR: Invalid diff type ${typeof diff}, expected object`);
      throw new TypeError('Diff parameter must be an object');
    }

    // Update version
    if (diff.version !== undefined && diff.version > this.version) {
      console.info(`[GameState.applyChanges] - INFO: Version updated from ${this.version} to ${diff.version}`);
      this.version = diff.version;
    }

    // Update timestamp
    if (diff.timestamp !== undefined) {
      this.timestamp = diff.timestamp;
    }

    // Update cursor position
    if (diff.cursor_x !== undefined || diff.cursor_y !== undefined) {
      const newX = diff.cursor_x !== undefined ? diff.cursor_x : this.cursor.x;
      const newY = diff.cursor_y !== undefined ? diff.cursor_y : this.cursor.y;
      console.info(`[GameState.applyChanges] - INFO: Updating cursor position to (${newX}, ${newY})`);
      this.moveCursor(newX, newY);
    }

    // Apply cell changes
    if (Array.isArray(diff.changes)) {
      let appliedChanges = 0;
      let failedChanges = 0;

      for (const change of diff.changes) {
        if (
          change &&
          typeof change.x === "number" &&
          typeof change.y === "number"
        ) {
          try {
            if (this.setCell(change.x, change.y, change)) {
              appliedChanges++;
            } else {
              failedChanges++;
            }
          } catch (error) {
            console.error(`[GameState.applyChanges] - ERROR: Failed to apply change at (${change.x}, ${change.y}): ${error.message}`);
            failedChanges++;
          }
        } else {
          console.warn(`[GameState.applyChanges] - WARN: Invalid change object, missing coordinates`);
          failedChanges++;
        }
      }

      console.info(`[GameState.applyChanges] - INFO: Applied ${appliedChanges} cell changes, ${failedChanges} failed`);
      this.logger.info(
        "applyChanges",
        `Applied ${appliedChanges} cell changes`
      );
    }

    this.logger.exit("applyChanges", {
      newVersion: this.version,
      hasChanges: this.changeTracker.hasChanges()
    });
  }

  /**
   * Clears the entire buffer and marks all cells as changed
   * @memberof GameState
   * @throws {Error} Never throws
   * @example
   * const state = new GameState();
   * state.clear();
   * console.log(state.getCell(0, 0).isEmpty()); // Returns true
   * @since 1.0.0
   */
  clear() {
    console.debug(`[GameState.clear] - DEBUG: Clearing entire ${this.width}x${this.height} buffer`);
    
    this.logger.info("clear", "Clearing entire buffer");

    let clearedCells = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = new GameCell();
        this.changeTracker.markCellChanged(x, y);
        clearedCells++;
      }
    }
    
    console.info(`[GameState.clear] - INFO: Cleared ${clearedCells} cells successfully`);
  }

  /**
   * Gets comprehensive state statistics and performance metrics
   * @memberof GameState
   * @returns {Object} State statistics including dimensions, version, and change tracking data
   * @throws {Error} Never throws
   * @example
   * const state = new GameState();
   * const stats = state.getStats();
   * console.log(stats.dimensions); // Returns "80x24"
   * @since 1.0.0
   */
  getStats() {
    console.debug(`[GameState.getStats] - DEBUG: Generating comprehensive statistics`);
    
    const stats = {
      dimensions: `${this.width}x${this.height}`,
      version: this.version,
      timestamp: this.timestamp,
      cursor: this.cursor.toJSON(),
      changeTracking: this.changeTracker.getStats(),
      totalCells: this.width * this.height,
      age: Date.now() - this.timestamp
    };

    console.info(`[GameState.getStats] - INFO: Generated statistics for ${stats.dimensions} buffer, version ${stats.version}`);
    this.logger.debug("getStats", "Retrieved state statistics", stats);
    return stats;
  }

  /**
   * Converts state to JSON representation for serialization and transmission
   * @memberof GameState
   * @param {boolean} [includeBuffer=false] - Whether to include full buffer data (expensive operation)
   * @returns {Object} JSON-serializable state data with optional buffer content
   * @throws {Error} Never throws
   * @example
   * const state = new GameState();
   * const json = state.toJSON(true); // Include full buffer
   * console.log(json.width); // Returns 80
   * @since 1.0.0
   */
  toJSON(includeBuffer = false) {
    console.debug(`[GameState.toJSON] - DEBUG: Converting state to JSON, includeBuffer: ${includeBuffer}`);
    
    const result = {
      width: this.width,
      height: this.height,
      version: this.version,
      timestamp: this.timestamp,
      cursor_x: this.cursor.x,
      cursor_y: this.cursor.y
    };

    if (includeBuffer) {
      console.info(`[GameState.toJSON] - INFO: Including full buffer data (${this.width * this.height} cells)`);
      result.buffer = this.buffer.map(row => row.map(cell => cell.toJSON()));
    }

    console.info(`[GameState.toJSON] - INFO: State converted to JSON successfully`);
    return result;
  }
}

// Export public interface
export { GameState, GameCell, CursorPosition, StateChangeTracker };

console.log("[GameState] Game state model module loaded successfully");
