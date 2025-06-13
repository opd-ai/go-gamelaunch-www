/**
 * @fileoverview Tileset data model for graphical tile-based game rendering with sprite management
 * @module models/tileset
 * @requires utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";

/**
 * @class TileSprite
 * @description Represents a single sprite tile with coordinates and metadata
 */
class TileSprite {
  /**
   * Creates a new TileSprite instance
   * @param {Object} data - Sprite configuration data
   * @param {number} data.x - X coordinate in tileset grid
   * @param {number} data.y - Y coordinate in tileset grid
   * @param {number} [data.width] - Sprite width in pixels (defaults to tile size)
   * @param {number} [data.height] - Sprite height in pixels (defaults to tile size)
   * @param {string} [data.name] - Optional sprite name/identifier
   * @param {string} [data.category] - Sprite category (e.g., 'character', 'item', 'terrain')
   * @param {Object} [data.metadata] - Additional sprite metadata
   */
  constructor(data) {
    this.x = Math.max(0, data.x || 0);
    this.y = Math.max(0, data.y || 0);
    this.width = data.width || null; // Will be set by parent tileset
    this.height = data.height || null; // Will be set by parent tileset
    this.name = data.name || null;
    this.category = data.category || "unknown";
    this.metadata = data.metadata || {};
    this.lastUsed = 0;
    this.useCount = 0;
  }

  /**
   * Gets the pixel coordinates for this sprite in the tileset image
   * @param {number} tileWidth - Width of individual tiles in pixels
   * @param {number} tileHeight - Height of individual tiles in pixels
   * @returns {Object} Pixel coordinates {x, y, width, height}
   */
  getPixelCoordinates(tileWidth, tileHeight) {
    return {
      x: this.x * tileWidth,
      y: this.y * tileHeight,
      width: this.width || tileWidth,
      height: this.height || tileHeight
    };
  }

  /**
   * Records usage of this sprite for statistics
   */
  recordUsage() {
    this.useCount++;
    this.lastUsed = Date.now();
  }

  /**
   * Checks if sprite coordinates are valid for given tileset dimensions
   * @param {number} gridWidth - Tileset width in tiles
   * @param {number} gridHeight - Tileset height in tiles
   * @returns {boolean} True if coordinates are within bounds
   */
  isValidForGrid(gridWidth, gridHeight) {
    return (
      this.x >= 0 && this.x < gridWidth && this.y >= 0 && this.y < gridHeight
    );
  }

  /**
   * Converts sprite to JSON representation
   * @returns {Object} JSON-serializable sprite data
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      name: this.name,
      category: this.category,
      metadata: this.metadata,
      useCount: this.useCount,
      lastUsed: this.lastUsed
    };
  }
}

/**
 * @class SpriteCache
 * @description Manages caching and lookup of sprites for performance optimization
 */
class SpriteCache {
  /**
   * Creates a new SpriteCache instance
   * @param {number} [maxSize=1000] - Maximum number of cached sprites
   */
  constructor(maxSize = 1000) {
    this.logger = createLogger("SpriteCache", LogLevel.DEBUG);
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;

    this.logger.info(
      "constructor",
      `Sprite cache initialized with max size: ${maxSize}`
    );
  }

  /**
   * Generates cache key for sprite coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {string} Cache key
   * @private
   */
  _getCacheKey(x, y) {
    return `${x},${y}`;
  }

  /**
   * Enforces cache size limits using LRU eviction
   * @private
   */
  _evictLRU() {
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
      this.logger.debug("_evictLRU", `Evicted sprite from cache: ${oldestKey}`);
    }
  }

  /**
   * Updates access order for LRU tracking
   * @param {string} key - Cache key
   * @private
   */
  _updateAccessOrder(key) {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Stores a sprite in the cache
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {TileSprite} sprite - Sprite to cache
   */
  set(x, y, sprite) {
    const key = this._getCacheKey(x, y);

    this._evictLRU();
    this.cache.set(key, sprite);
    this._updateAccessOrder(key);

    this.logger.debug("set", `Sprite cached at (${x}, ${y})`);
  }

  /**
   * Retrieves a sprite from the cache
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {TileSprite|null} Cached sprite or null if not found
   */
  get(x, y) {
    const key = this._getCacheKey(x, y);
    const sprite = this.cache.get(key);

    if (sprite) {
      this.hitCount++;
      this._updateAccessOrder(key);
      sprite.recordUsage();
      this.logger.debug("get", `Cache hit for sprite at (${x}, ${y})`);
      return sprite;
    } else {
      this.missCount++;
      this.logger.debug("get", `Cache miss for sprite at (${x}, ${y})`);
      return null;
    }
  }

  /**
   * Checks if a sprite exists in cache
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if sprite is cached
   */
  has(x, y) {
    const key = this._getCacheKey(x, y);
    return this.cache.has(key);
  }

  /**
   * Clears all cached sprites
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.logger.info("clear", `Cleared ${size} sprites from cache`);
  }

  /**
   * Gets cache performance statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate =
      totalRequests > 0
        ? (this.hitCount / totalRequests * 100).toFixed(2) + "%"
        : "0%";

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate,
      totalRequests: totalRequests
    };
  }
}

/**
 * @class Tileset
 * @description Main tileset class managing sprites, image data, and tile mapping
 */
class Tileset {
  /**
   * Creates a new Tileset instance
   * @param {Object} [data={}] - Tileset configuration data
   * @param {string} [data.name] - Tileset name/identifier
   * @param {string} [data.source_image] - Source image URL or path
   * @param {number} [data.tile_width=16] - Width of individual tiles in pixels
   * @param {number} [data.tile_height=16] - Height of individual tiles in pixels
   * @param {number} [data.tiles_per_row] - Number of tiles per row (auto-calculated if not provided)
   * @param {number} [data.total_tiles] - Total number of tiles (auto-calculated if not provided)
   * @param {Array} [data.sprites] - Array of sprite definitions
   * @param {Object} [data.metadata] - Additional tileset metadata
   */
  constructor(data = {}) {
    this.logger = createLogger("Tileset", LogLevel.INFO);

    // Basic properties
    this.name = data.name || "unnamed";
    this.source_image = data.source_image || null;
    this.tile_width = Math.max(1, data.tile_width || 16);
    this.tile_height = Math.max(1, data.tile_height || 16);
    this.tiles_per_row = data.tiles_per_row || null;
    this.total_tiles = data.total_tiles || null;
    this.metadata = data.metadata || {};

    // Image and loading state
    this.imageElement = null;
    this.imageLoaded = false;
    this.imageWidth = 0;
    this.imageHeight = 0;

    // Sprite management
    this.sprites = new Map();
    this.spriteCache = new SpriteCache(1000);
    this.defaultSprite = null;

    // Loading state
    this.loadPromise = null;
    this.loadAttempts = 0;
    this.lastLoadTime = 0;

    // Load initial sprites if provided
    if (Array.isArray(data.sprites)) {
      this._loadSprites(data.sprites);
    }

    this.logger.info(
      "constructor",
      `Tileset created: ${this.name}, tile size: ${this.tile_width}x${
        this.tile_height
      }`
    );
  }

  /**
   * Loads sprite definitions into the tileset
   * @param {Array} spriteData - Array of sprite definition objects
   * @private
   */
  _loadSprites(spriteData) {
    this.logger.enter("_loadSprites", { spriteCount: spriteData.length });

    let loadedCount = 0;

    for (const data of spriteData) {
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        const sprite = new TileSprite(data);
        sprite.width = sprite.width || this.tile_width;
        sprite.height = sprite.height || this.tile_height;

        const key = `${sprite.x},${sprite.y}`;
        this.sprites.set(key, sprite);
        loadedCount++;

        // Set default sprite if specified or use first sprite
        if (data.isDefault || (!this.defaultSprite && loadedCount === 1)) {
          this.defaultSprite = sprite;
        }
      }
    }

    this.logger.exit("_loadSprites", { loadedCount });
  }

  /**
   * Calculates tileset grid dimensions from image size
   * @private
   */
  _calculateGridDimensions() {
    if (!this.imageLoaded || !this.imageElement) {
      this.logger.warn(
        "_calculateGridDimensions",
        "Cannot calculate dimensions: image not loaded"
      );
      return;
    }

    this.imageWidth = this.imageElement.naturalWidth;
    this.imageHeight = this.imageElement.naturalHeight;

    // Calculate grid dimensions
    const calculatedTilesPerRow = Math.floor(this.imageWidth / this.tile_width);
    const calculatedTotalRows = Math.floor(this.imageHeight / this.tile_height);
    const calculatedTotalTiles = calculatedTilesPerRow * calculatedTotalRows;

    // Use calculated values if not explicitly set
    if (!this.tiles_per_row) {
      this.tiles_per_row = calculatedTilesPerRow;
    }
    if (!this.total_tiles) {
      this.total_tiles = calculatedTotalTiles;
    }

    this.logger.info(
      "_calculateGridDimensions",
      `Grid calculated: ${this.tiles_per_row}x${calculatedTotalRows} (${
        this.total_tiles
      } tiles)`
    );
  }

  /**
   * Loads the tileset image asynchronously
   * @param {string} [imageUrl] - Override image URL (uses source_image if not provided)
   * @returns {Promise<void>} Promise that resolves when image is loaded
   */
  async loadImage(imageUrl = null) {
    const url = imageUrl || this.source_image;

    if (!url) {
      throw new Error("No image URL provided for tileset");
    }

    // Return existing promise if already loading
    if (this.loadPromise) {
      this.logger.debug(
        "loadImage",
        "Image load already in progress, returning existing promise"
      );
      return this.loadPromise;
    }

    this.logger.enter("loadImage", { url, attempt: this.loadAttempts + 1 });

    this.loadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      const startTime = Date.now();

      img.onload = () => {
        const loadTime = Date.now() - startTime;
        this.imageElement = img;
        this.imageLoaded = true;
        this.lastLoadTime = Date.now();
        this.loadAttempts++;

        this._calculateGridDimensions();

        this.logger.info(
          "loadImage",
          `Image loaded successfully in ${loadTime}ms`,
          {
            dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
            gridSize: `${this.tiles_per_row}x${Math.floor(
              this.imageHeight / this.tile_height
            )}`
          }
        );

        this.loadPromise = null;
        resolve();
      };

      img.onerror = () => {
        const loadTime = Date.now() - startTime;
        this.loadAttempts++;
        const error = new Error(`Failed to load tileset image: ${url}`);

        this.logger.error(
          "loadImage",
          `Image load failed after ${loadTime}ms`,
          error
        );

        this.loadPromise = null;
        reject(error);
      };

      img.src = url;
    });

    return this.loadPromise;
  }

  /**
   * Gets a sprite at the specified tile coordinates
   * @param {number} x - X coordinate in tile grid
   * @param {number} y - Y coordinate in tile grid
   * @returns {TileSprite|null} Sprite at coordinates or null if not found
   */
  getSprite(x, y) {
    // Check cache first
    let sprite = this.spriteCache.get(x, y);
    if (sprite) {
      return sprite;
    }

    // Check stored sprites
    const key = `${x},${y}`;
    sprite = this.sprites.get(key);

    if (sprite) {
      this.spriteCache.set(x, y, sprite);
      sprite.recordUsage();
      return sprite;
    }

    // Create default sprite if coordinates are valid
    if (this.isValidCoordinate(x, y)) {
      sprite = new TileSprite({ x, y });
      sprite.width = this.tile_width;
      sprite.height = this.tile_height;

      this.spriteCache.set(x, y, sprite);
      this.logger.debug("getSprite", `Created default sprite at (${x}, ${y})`);
      return sprite;
    }

    this.logger.warn(
      "getSprite",
      `Invalid coordinates or sprite not found: (${x}, ${y})`
    );
    return null;
  }

  /**
   * Checks if tile coordinates are valid for this tileset
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if coordinates are valid
   */
  isValidCoordinate(x, y) {
    if (!this.tiles_per_row) {
      return false; // Can't validate without grid dimensions
    }

    const maxRows = this.imageHeight
      ? Math.floor(this.imageHeight / this.tile_height)
      : Infinity;
    return x >= 0 && x < this.tiles_per_row && y >= 0 && y < maxRows;
  }

  /**
   * Adds or updates a sprite definition
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} spriteData - Sprite configuration data
   * @returns {TileSprite} Created or updated sprite
   */
  setSprite(x, y, spriteData) {
    const sprite = new TileSprite({ ...spriteData, x, y });
    sprite.width = sprite.width || this.tile_width;
    sprite.height = sprite.height || this.tile_height;

    const key = `${x},${y}`;
    this.sprites.set(key, sprite);

    // Update cache if sprite exists there
    if (this.spriteCache.has(x, y)) {
      this.spriteCache.set(x, y, sprite);
    }

    this.logger.debug("setSprite", `Sprite updated at (${x}, ${y})`);
    return sprite;
  }

  /**
   * Gets the default sprite for fallback rendering
   * @returns {TileSprite|null} Default sprite or null if none set
   */
  getDefaultSprite() {
    return this.defaultSprite;
  }

  /**
   * Sets the default sprite
   * @param {number} x - X coordinate of default sprite
   * @param {number} y - Y coordinate of default sprite
   */
  setDefaultSprite(x, y) {
    const sprite = this.getSprite(x, y);
    if (sprite) {
      this.defaultSprite = sprite;
      this.logger.info(
        "setDefaultSprite",
        `Default sprite set to (${x}, ${y})`
      );
    } else {
      this.logger.warn(
        "setDefaultSprite",
        `Cannot set default sprite: invalid coordinates (${x}, ${y})`
      );
    }
  }

  /**
   * Gets tileset statistics and performance metrics
   * @returns {Object} Tileset statistics
   */
  getStats() {
    const stats = {
      name: this.name,
      imageLoaded: this.imageLoaded,
      imageDimensions: this.imageLoaded
        ? `${this.imageWidth}x${this.imageHeight}`
        : "not loaded",
      tileDimensions: `${this.tile_width}x${this.tile_height}`,
      gridSize: this.tiles_per_row
        ? `${this.tiles_per_row}x${Math.floor(
            this.imageHeight / this.tile_height
          )}`
        : "unknown",
      totalTiles: this.total_tiles || "unknown",
      definedSprites: this.sprites.size,
      loadAttempts: this.loadAttempts,
      lastLoadTime: this.lastLoadTime,
      cacheStats: this.spriteCache.getStats(),
      hasDefaultSprite: !!this.defaultSprite
    };

    this.logger.debug("getStats", "Retrieved tileset statistics", stats);
    return stats;
  }

  /**
   * Clears all cached data and resets state
   */
  reset() {
    this.logger.info("reset", "Resetting tileset state");

    this.imageElement = null;
    this.imageLoaded = false;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.loadPromise = null;
    this.spriteCache.clear();

    // Keep sprite definitions but clear cache
    for (const sprite of this.sprites.values()) {
      sprite.useCount = 0;
      sprite.lastUsed = 0;
    }
  }

  /**
   * Converts tileset to JSON representation
   * @param {boolean} [includeSprites=false] - Whether to include sprite definitions
   * @returns {Object} JSON-serializable tileset data
   */
  toJSON(includeSprites = false) {
    const result = {
      name: this.name,
      source_image: this.source_image,
      tile_width: this.tile_width,
      tile_height: this.tile_height,
      tiles_per_row: this.tiles_per_row,
      total_tiles: this.total_tiles,
      metadata: this.metadata,
      imageLoaded: this.imageLoaded,
      imageWidth: this.imageWidth,
      imageHeight: this.imageHeight
    };

    if (includeSprites) {
      result.sprites = Array.from(this.sprites.values()).map(sprite =>
        sprite.toJSON()
      );
      result.defaultSprite = this.defaultSprite
        ? this.defaultSprite.toJSON()
        : null;
    }

    return result;
  }
}

/**
 * @class TilesetLoader
 * @description Utility class for loading and managing multiple tilesets
 */
class TilesetLoader {
  /**
   * Creates a new TilesetLoader instance
   */
  constructor() {
    this.logger = createLogger("TilesetLoader", LogLevel.INFO);
    this.tilesets = new Map();
    this.loadingPromises = new Map();

    this.logger.info("constructor", "Tileset loader initialized");
  }

  /**
   * Loads a tileset from configuration data
   * @param {Object} config - Tileset configuration
   * @param {string} [config.name] - Tileset identifier
   * @param {string} config.source_image - Image URL
   * @param {boolean} [preloadImage=true] - Whether to preload the image
   * @returns {Promise<Tileset>} Loaded tileset
   */
  async loadTileset(config, preloadImage = true) {
    const name = config.name || "default";

    this.logger.enter("loadTileset", { name, preloadImage });

    // Check if already loading
    if (this.loadingPromises.has(name)) {
      this.logger.debug(
        "loadTileset",
        `Tileset ${name} already loading, returning existing promise`
      );
      return this.loadingPromises.get(name);
    }

    // Check if already loaded
    if (this.tilesets.has(name)) {
      const existing = this.tilesets.get(name);
      this.logger.debug("loadTileset", `Tileset ${name} already loaded`);
      return existing;
    }

    const loadPromise = this._performLoad(config, name, preloadImage);
    this.loadingPromises.set(name, loadPromise);

    try {
      const tileset = await loadPromise;
      this.tilesets.set(name, tileset);
      this.logger.exit("loadTileset", { name, success: true });
      return tileset;
    } catch (error) {
      this.logger.error("loadTileset", `Failed to load tileset ${name}`, error);
      throw error;
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * Performs the actual tileset loading
   * @param {Object} config - Tileset configuration
   * @param {string} name - Tileset name
   * @param {boolean} preloadImage - Whether to preload image
   * @returns {Promise<Tileset>} Loaded tileset
   * @private
   */
  async _performLoad(config, name, preloadImage) {
    this.logger.debug("_performLoad", `Creating tileset: ${name}`);

    const tileset = new Tileset({ ...config, name });

    if (preloadImage && tileset.source_image) {
      await tileset.loadImage();
    }

    return tileset;
  }

  /**
   * Gets a loaded tileset by name
   * @param {string} name - Tileset name
   * @returns {Tileset|null} Tileset or null if not found
   */
  getTileset(name) {
    const tileset = this.tilesets.get(name);
    if (tileset) {
      this.logger.debug("getTileset", `Retrieved tileset: ${name}`);
    } else {
      this.logger.warn("getTileset", `Tileset not found: ${name}`);
    }
    return tileset || null;
  }

  /**
   * Checks if a tileset is loaded
   * @param {string} name - Tileset name
   * @returns {boolean} True if tileset is loaded
   */
  hasTileset(name) {
    return this.tilesets.has(name);
  }

  /**
   * Unloads a tileset and frees resources
   * @param {string} name - Tileset name to unload
   * @returns {boolean} True if tileset was unloaded
   */
  unloadTileset(name) {
    if (this.tilesets.has(name)) {
      const tileset = this.tilesets.get(name);
      tileset.reset();
      this.tilesets.delete(name);
      this.logger.info("unloadTileset", `Tileset unloaded: ${name}`);
      return true;
    }

    this.logger.warn(
      "unloadTileset",
      `Tileset not found for unloading: ${name}`
    );
    return false;
  }

  /**
   * Gets loader statistics
   * @returns {Object} Loader statistics
   */
  getStats() {
    const tilesetStats = {};
    for (const [name, tileset] of this.tilesets) {
      tilesetStats[name] = tileset.getStats();
    }

    return {
      loadedTilesets: this.tilesets.size,
      loadingTilesets: this.loadingPromises.size,
      tilesets: tilesetStats
    };
  }

  /**
   * Unloads all tilesets and clears loader state
   */
  clear() {
    this.logger.info("clear", `Clearing ${this.tilesets.size} loaded tilesets`);

    for (const tileset of this.tilesets.values()) {
      tileset.reset();
    }

    this.tilesets.clear();
    this.loadingPromises.clear();
  }
}

// Export public interface
export { Tileset, TileSprite, TilesetLoader, SpriteCache };

console.log("[Tileset] Tileset model module loaded successfully");
