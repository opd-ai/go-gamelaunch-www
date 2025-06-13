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
 * @description Represents a single character cell in the game terminal buffer
 */
class GameCell {
  /**
   * Creates a new GameCell instance
   * @param {Object} [data={}] - Cell data from server
   * @param {string|number} [data.char=' '] - Character to display (string or char code)
   * @param {string} [data.fg_color='#FFFFFF'] - Foreground color
   * @param {string} [data.bg_color='#000000'] - Background color
   * @param {boolean} [data.bold=false] - Bold text styling
   * @param {boolean} [data.inverse=false] - Inverse video styling
   * @param {boolean} [data.blink=false] - Blinking text effect
   * @param {number} [data.tile_x] - Tileset X coordinate (if using tileset)
   * @param {number} [data.tile_y] - Tileset Y coordinate (if using tileset)
   */
  constructor(data = {}) {
    this.char = data.char !== undefined ? data.char : " ";
    this.fg_color = data.fg_color || "#FFFFFF";
    this.bg_color = data.bg_color || "#000000";
    this.bold = Boolean(data.bold);
    this.inverse = Boolean(data.inverse);
    this.blink = Boolean(data.blink);
    this.tile_x = data.tile_x;
    this.tile_y = data.tile_y;
    this.timestamp = Date.now();
  }

  /**
   * Gets the display character as a string
   * @returns {string} Character to display
   */
  getDisplayChar() {
    if (typeof this.char === "number") {
      return String.fromCharCode(this.char);
    }
    return this.char || " ";
  }

  /**
   * Checks if this cell has tileset coordinates
   * @returns {boolean} True if tile coordinates are defined
   */
  hasTileCoordinates() {
    return this.tile_x !== undefined && this.tile_y !== undefined;
  }

  /**
   * Checks if this cell represents an empty space
   * @returns {boolean} True if cell is effectively empty
   */
  isEmpty() {
    const char = this.getDisplayChar();
    return char === " " && this.bg_color === "#000000";
  }

  /**
   * Creates a copy of this cell
   * @returns {GameCell} New cell instance with same properties
   */
  clone() {
    return new GameCell({
      char: this.char,
      fg_color: this.fg_color,
      bg_color: this.bg_color,
      bold: this.bold,
      inverse: this.inverse,
      blink: this.blink,
      tile_x: this.tile_x,
      tile_y: this.tile_y
    });
  }

  /**
   * Checks if this cell is equivalent to another cell
   * @param {GameCell} other - Cell to compare with
   * @returns {boolean} True if cells are equivalent
   */
  equals(other) {
    if (!other) return false;

    return (
      this.char === other.char &&
      this.fg_color === other.fg_color &&
      this.bg_color === other.bg_color &&
      this.bold === other.bold &&
      this.inverse === other.inverse &&
      this.blink === other.blink &&
      this.tile_x === other.tile_x &&
      this.tile_y === other.tile_y
    );
  }

  /**
   * Converts cell to JSON representation
   * @returns {Object} JSON-serializable cell data
   */
  toJSON() {
    return {
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
  }
}

/**
 * @class CursorPosition
 * @description Represents cursor position and visibility state
 */
class CursorPosition {
  /**
   * Creates a new CursorPosition instance
   * @param {number} [x=0] - X coordinate
   * @param {number} [y=0] - Y coordinate
   * @param {boolean} [visible=true] - Cursor visibility
   */
  constructor(x = 0, y = 0, visible = true) {
    this.x = Math.max(0, x);
    this.y = Math.max(0, y);
    this.visible = Boolean(visible);
    this.lastUpdate = Date.now();
  }

  /**
   * Updates cursor position
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   */
  moveTo(x, y) {
    this.x = Math.max(0, x);
    this.y = Math.max(0, y);
    this.lastUpdate = Date.now();
  }

  /**
   * Sets cursor visibility
   * @param {boolean} visible - New visibility state
   */
  setVisible(visible) {
    this.visible = Boolean(visible);
    this.lastUpdate = Date.now();
  }

  /**
   * Checks if cursor is at the specified position
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if cursor is at position
   */
  isAt(x, y) {
    return this.x === x && this.y === y;
  }

  /**
   * Converts cursor to JSON representation
   * @returns {Object} JSON-serializable cursor data
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      visible: this.visible,
      lastUpdate: this.lastUpdate
    };
  }
}

/**
 * @class StateChangeTracker
 * @description Tracks changes to game state for efficient updates
 */
class StateChangeTracker {
  /**
   * Creates a new StateChangeTracker instance
   */
  constructor() {
    this.logger = createLogger("StateChangeTracker", LogLevel.DEBUG);
    this.changedCells = new Set();
    this.cursorChanged = false;
    this.dimensionsChanged = false;
    this.lastChangeTime = 0;
  }

  /**
   * Records a cell change
   * @param {number} x - Cell X coordinate
   * @param {number} y - Cell Y coordinate
   */
  markCellChanged(x, y) {
    const key = `${x},${y}`;
    this.changedCells.add(key);
    this.lastChangeTime = Date.now();
    this.logger.debug(
      "markCellChanged",
      `Cell marked as changed: (${x}, ${y})`
    );
  }

  /**
   * Records cursor position change
   */
  markCursorChanged() {
    this.cursorChanged = true;
    this.lastChangeTime = Date.now();
    this.logger.debug("markCursorChanged", "Cursor position marked as changed");
  }

  /**
   * Records dimension change
   */
  markDimensionsChanged() {
    this.dimensionsChanged = true;
    this.lastChangeTime = Date.now();
    this.logger.debug("markDimensionsChanged", "Dimensions marked as changed");
  }

  /**
   * Gets all changed cell coordinates
   * @returns {Array<{x: number, y: number}>} Array of changed cell positions
   */
  getChangedCells() {
    const cells = Array.from(this.changedCells).map(key => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });

    this.logger.debug(
      "getChangedCells",
      `Retrieved ${cells.length} changed cells`
    );
    return cells;
  }

  /**
   * Checks if there are any pending changes
   * @returns {boolean} True if changes exist
   */
  hasChanges() {
    return (
      this.changedCells.size > 0 || this.cursorChanged || this.dimensionsChanged
    );
  }

  /**
   * Clears all tracked changes
   */
  clearChanges() {
    const cellCount = this.changedCells.size;
    this.changedCells.clear();
    this.cursorChanged = false;
    this.dimensionsChanged = false;

    this.logger.debug(
      "clearChanges",
      `Cleared ${cellCount} cell changes and flags`
    );
  }

  /**
   * Gets change statistics
   * @returns {Object} Change tracking statistics
   */
  getStats() {
    return {
      changedCells: this.changedCells.size,
      cursorChanged: this.cursorChanged,
      dimensionsChanged: this.dimensionsChanged,
      lastChangeTime: this.lastChangeTime,
      hasChanges: this.hasChanges()
    };
  }
}

/**
 * @class GameState
 * @description Complete game state model with terminal buffer, cursor, and change tracking
 */
class GameState {
  /**
   * Creates a new GameState instance
   * @param {Object} [data={}] - Initial state data
   * @param {number} [data.width=80] - Terminal width in characters
   * @param {number} [data.height=24] - Terminal height in characters
   * @param {number} [data.version=0] - State version number
   * @param {Array} [data.buffer] - 2D array of cell data
   * @param {number} [data.cursor_x=0] - Cursor X position
   * @param {number} [data.cursor_y=0] - Cursor Y position
   * @param {number} [data.timestamp] - State timestamp
   */
  constructor(data = {}) {
    this.logger = createLogger("GameState", LogLevel.INFO);

    // Terminal dimensions
    this.width = Math.max(1, data.width || 80);
    this.height = Math.max(1, data.height || 24);

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

    this.logger.info(
      "constructor",
      `Game state initialized: ${this.width}x${this.height}, version ${
        this.version
      }`
    );
  }

  /**
   * Creates an empty terminal buffer
   * @returns {Array<Array<GameCell>>} 2D array of empty cells
   * @private
   */
  _createBuffer() {
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

    return buffer;
  }

  /**
   * Loads buffer data from server response
   * @param {Array} bufferData - 2D array of cell data from server
   * @private
   */
  _loadBufferData(bufferData) {
    this.logger.enter("_loadBufferData", {
      rows: bufferData ? bufferData.length : 0
    });

    if (!Array.isArray(bufferData)) {
      this.logger.warn(
        "_loadBufferData",
        "Invalid buffer data format, expected array"
      );
      return;
    }

    let loadedCells = 0;

    for (let y = 0; y < Math.min(bufferData.length, this.height); y++) {
      if (!Array.isArray(bufferData[y])) continue;

      for (let x = 0; x < Math.min(bufferData[y].length, this.width); x++) {
        if (bufferData[y][x]) {
          this.buffer[y][x] = new GameCell(bufferData[y][x]);
          loadedCells++;
        }
      }
    }

    this.logger.exit("_loadBufferData", { loadedCells });
  }

  /**
   * Gets a cell at the specified position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {GameCell|null} Cell at position or null if out of bounds
   */
  getCell(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }

    return this.buffer[y][x];
  }

  /**
   * Sets a cell at the specified position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {GameCell|Object} cellData - Cell instance or cell data
   * @returns {boolean} True if cell was set successfully
   */
  setCell(x, y, cellData) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      this.logger.warn(
        "setCell",
        `Attempted to set cell out of bounds: (${x}, ${y})`
      );
      return false;
    }

    const cell =
      cellData instanceof GameCell ? cellData : new GameCell(cellData);
    const oldCell = this.buffer[y][x];

    // Only update if cell actually changed
    if (!oldCell.equals(cell)) {
      this.buffer[y][x] = cell;
      this.changeTracker.markCellChanged(x, y);
      this.logger.debug("setCell", `Cell updated at (${x}, ${y})`);
    }

    return true;
  }

  /**
   * Resizes the terminal buffer
   * @param {number} newWidth - New terminal width
   * @param {number} newHeight - New terminal height
   */
  resize(newWidth, newHeight) {
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
    for (let y = 0; y < Math.min(oldHeight, this.height); y++) {
      for (let x = 0; x < Math.min(oldWidth, this.width); x++) {
        if (this.buffer[y] && this.buffer[y][x]) {
          newBuffer[y][x] = this.buffer[y][x];
        }
      }
    }

    this.buffer = newBuffer;
    this.changeTracker.markDimensionsChanged();

    // Ensure cursor is within bounds
    if (this.cursor.x >= this.width) {
      this.cursor.x = this.width - 1;
      this.changeTracker.markCursorChanged();
    }
    if (this.cursor.y >= this.height) {
      this.cursor.y = this.height - 1;
      this.changeTracker.markCursorChanged();
    }

    this.logger.exit("resize", { success: true });
  }

  /**
   * Updates cursor position
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   */
  moveCursor(x, y) {
    const oldX = this.cursor.x;
    const oldY = this.cursor.y;

    this.cursor.moveTo(
      Math.max(0, Math.min(x, this.width - 1)),
      Math.max(0, Math.min(y, this.height - 1))
    );

    if (oldX !== this.cursor.x || oldY !== this.cursor.y) {
      this.changeTracker.markCursorChanged();
      this.logger.debug(
        "moveCursor",
        `Cursor moved from (${oldX}, ${oldY}) to (${this.cursor.x}, ${
          this.cursor.y
        })`
      );
    }
  }

  /**
   * Applies state changes from server diff
   * @param {Object} diff - State diff from server
   * @param {number} [diff.version] - New version number
   * @param {number} [diff.cursor_x] - New cursor X position
   * @param {number} [diff.cursor_y] - New cursor Y position
   * @param {Array} [diff.changes] - Array of cell changes
   * @param {number} [diff.timestamp] - Update timestamp
   */
  applyChanges(diff) {
    this.logger.enter("applyChanges", {
      version: diff.version,
      hasChanges: Array.isArray(diff.changes),
      changeCount: diff.changes ? diff.changes.length : 0
    });

    if (!diff) {
      this.logger.warn("applyChanges", "No diff provided");
      return;
    }

    // Update version
    if (diff.version !== undefined && diff.version > this.version) {
      this.version = diff.version;
    }

    // Update timestamp
    if (diff.timestamp !== undefined) {
      this.timestamp = diff.timestamp;
    }

    // Update cursor position
    if (diff.cursor_x !== undefined || diff.cursor_y !== undefined) {
      this.moveCursor(
        diff.cursor_x !== undefined ? diff.cursor_x : this.cursor.x,
        diff.cursor_y !== undefined ? diff.cursor_y : this.cursor.y
      );
    }

    // Apply cell changes
    if (Array.isArray(diff.changes)) {
      let appliedChanges = 0;

      for (const change of diff.changes) {
        if (
          change &&
          typeof change.x === "number" &&
          typeof change.y === "number"
        ) {
          if (this.setCell(change.x, change.y, change)) {
            appliedChanges++;
          }
        }
      }

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
   * Clears the entire buffer
   */
  clear() {
    this.logger.info("clear", "Clearing entire buffer");

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = new GameCell();
        this.changeTracker.markCellChanged(x, y);
      }
    }
  }

  /**
   * Gets current state statistics
   * @returns {Object} State statistics and metadata
   */
  getStats() {
    const stats = {
      dimensions: `${this.width}x${this.height}`,
      version: this.version,
      timestamp: this.timestamp,
      cursor: this.cursor.toJSON(),
      changeTracking: this.changeTracker.getStats(),
      totalCells: this.width * this.height,
      age: Date.now() - this.timestamp
    };

    this.logger.debug("getStats", "Retrieved state statistics", stats);
    return stats;
  }

  /**
   * Converts state to JSON representation
   * @param {boolean} [includeBuffer=false] - Whether to include full buffer data
   * @returns {Object} JSON-serializable state data
   */
  toJSON(includeBuffer = false) {
    const result = {
      width: this.width,
      height: this.height,
      version: this.version,
      timestamp: this.timestamp,
      cursor_x: this.cursor.x,
      cursor_y: this.cursor.y
    };

    if (includeBuffer) {
      result.buffer = this.buffer.map(row => row.map(cell => cell.toJSON()));
    }

    return result;
  }
}

// Export public interface
export { GameState, GameCell, CursorPosition, StateChangeTracker };

console.log("[GameState] Game state model module loaded successfully");
