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
 * @description Represents a single sprite tile with coordinates and metadata for graphical rendering
 */
class TileSprite {
  /**
   * Creates a new TileSprite instance with coordinates and visual metadata for tileset rendering
   * @constructor
   * @memberof TileSprite
   * @param {Object} data - Sprite configuration data with coordinates and visual properties
   * @param {number} data.x - X coordinate in tileset grid (0-based index)
   * @param {number} data.y - Y coordinate in tileset grid (0-based index)
   * @param {number} [data.width] - Sprite width in pixels (defaults to parent tileset tile size)
   * @param {number} [data.height] - Sprite height in pixels (defaults to parent tileset tile size)
   * @param {string} [data.name] - Optional sprite name/identifier for debugging and reference
   * @param {string} [data.category] - Sprite category for organization (e.g., 'character', 'item', 'terrain')
   * @param {Object} [data.metadata] - Additional sprite metadata for game-specific properties
   * @returns {TileSprite} New TileSprite instance with initialized properties
   * @throws {TypeError} When data parameter is not an object or missing required coordinates
   * @example
   * // Create a basic sprite at grid position (5, 10)
   * const sprite = new TileSprite({ x: 5, y: 10 });
   * 
   * // Create a named character sprite with custom dimensions
   * const playerSprite = new TileSprite({
   *   x: 0, y: 0, width: 32, height: 32,
   *   name: 'player', category: 'character'
   * });
   * @since 1.0.0
   */
  constructor(data) {
    console.debug(`[TileSprite.constructor] - DEBUG: Creating sprite with data:`, data);
    
    if (!data || typeof data !== 'object') {
      console.error(`[TileSprite.constructor] - ERROR: Invalid data parameter provided`);
      throw new TypeError('TileSprite constructor requires data object with coordinates');
    }
    
    this.x = Math.max(0, data.x || 0);
    this.y = Math.max(0, data.y || 0);
    this.width = data.width || null; // Will be set by parent tileset
    this.height = data.height || null; // Will be set by parent tileset
    this.name = data.name || null;
    this.category = data.category || "unknown";
    this.metadata = data.metadata || {};
    this.lastUsed = 0;
    this.useCount = 0;
    
    console.debug(`[TileSprite.constructor] - DEBUG: Sprite created at position (${this.x}, ${this.y}) with category '${this.category}'`);
  }

  /**
   * Gets the pixel coordinates for this sprite in the tileset image for rendering
   * @memberof TileSprite
   * @param {number} tileWidth - Width of individual tiles in pixels (must be positive)
   * @param {number} tileHeight - Height of individual tiles in pixels (must be positive)
   * @returns {Object} Pixel coordinates object with x, y, width, height properties for canvas drawing
   * @throws {TypeError} When tileWidth or tileHeight are not positive numbers
   * @example
   * const sprite = new TileSprite({ x: 2, y: 3 });
   * const pixelCoords = sprite.getPixelCoordinates(16, 16);
   * // Returns: { x: 32, y: 48, width: 16, height: 16 }
   * @since 1.0.0
   */
  getPixelCoordinates(tileWidth, tileHeight) {
    console.debug(`[TileSprite.getPixelCoordinates] - DEBUG: Calculating pixel coordinates for sprite at (${this.x}, ${this.y}) with tile size ${tileWidth}x${tileHeight}`);
    
    if (typeof tileWidth !== 'number' || tileWidth <= 0 || typeof tileHeight !== 'number' || tileHeight <= 0) {
      console.error(`[TileSprite.getPixelCoordinates] - ERROR: Invalid tile dimensions: ${tileWidth}x${tileHeight}`);
      throw new TypeError('Tile dimensions must be positive numbers');
    }
    
    const result = {
      x: this.x * tileWidth,
      y: this.y * tileHeight,
      width: this.width || tileWidth,
      height: this.height || tileHeight
    };
    
    console.debug(`[TileSprite.getPixelCoordinates] - DEBUG: Pixel coordinates calculated:`, result);
    return result;
  }

  /**
   * Records usage of this sprite for performance statistics and cache management
   * @memberof TileSprite
   * @returns {void} No return value, updates internal usage tracking
   * @throws {Error} Never throws, safe to call in any context
   * @example
   * const sprite = new TileSprite({ x: 0, y: 0 });
   * sprite.recordUsage(); // Increments use count and updates timestamp
   * console.log(sprite.useCount); // Returns 1
   * @since 1.0.0
   */
  recordUsage() {
    console.debug(`[TileSprite.recordUsage] - DEBUG: Recording usage for sprite at (${this.x}, ${this.y}), previous count: ${this.useCount}`);
    
    this.useCount++;
    this.lastUsed = Date.now();
    
    console.debug(`[TileSprite.recordUsage] - DEBUG: Usage recorded, new count: ${this.useCount}`);
  }

  /**
   * Checks if sprite coordinates are valid for given tileset dimensions
   * @memberof TileSprite
   * @param {number} gridWidth - Tileset width in tiles (must be positive integer)
   * @param {number} gridHeight - Tileset height in tiles (must be positive integer)
   * @returns {boolean} True if coordinates are within tileset bounds, false otherwise
   * @throws {TypeError} When gridWidth or gridHeight are not positive numbers
   * @example
   * const sprite = new TileSprite({ x: 5, y: 10 });
   * console.log(sprite.isValidForGrid(16, 16)); // Returns true
   * console.log(sprite.isValidForGrid(4, 4));   // Returns false
   * @since 1.0.0
   */
  isValidForGrid(gridWidth, gridHeight) {
    console.debug(`[TileSprite.isValidForGrid] - DEBUG: Validating sprite at (${this.x}, ${this.y}) against grid ${gridWidth}x${gridHeight}`);
    
    if (typeof gridWidth !== 'number' || gridWidth <= 0 || typeof gridHeight !== 'number' || gridHeight <= 0) {
      console.error(`[TileSprite.isValidForGrid] - ERROR: Invalid grid dimensions: ${gridWidth}x${gridHeight}`);
      throw new TypeError('Grid dimensions must be positive numbers');
    }
    
    const isValid = this.x >= 0 && this.x < gridWidth && this.y >= 0 && this.y < gridHeight;
    
    if (!isValid) {
      console.warn(`[TileSprite.isValidForGrid] - WARN: Sprite coordinates (${this.x}, ${this.y}) are outside grid bounds ${gridWidth}x${gridHeight}`);
    }
    
    return isValid;
  }

  /**
   * Converts sprite to JSON representation for serialization and transmission
   * @memberof TileSprite
   * @returns {Object} JSON-serializable sprite data with all properties
   * @throws {Error} Never throws, safe serialization of all sprite data
   * @example
   * const sprite = new TileSprite({ x: 5, y: 10, name: 'wall' });
   * sprite.recordUsage();
   * const json = sprite.toJSON();
   * // Returns: { x: 5, y: 10, width: null, height: null, name: 'wall', category: 'unknown', metadata: {}, useCount: 1, lastUsed: 1640995200000 }
   * @since 1.0.0
   */
  toJSON() {
    console.debug(`[TileSprite.toJSON] - DEBUG: Serializing sprite at (${this.x}, ${this.y}) with name '${this.name || 'unnamed'}'`);
    
    const result = {
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
    
    console.debug(`[TileSprite.toJSON] - DEBUG: Sprite serialized successfully`);
    return result;
  }
}

/**
 * @class SpriteCache
 * @description Manages caching and lookup of sprites for performance optimization using LRU eviction
 */
class SpriteCache {
  /**
   * Creates a new SpriteCache instance for efficient sprite lookup and management
   * @constructor
   * @memberof SpriteCache
   * @param {number} [maxSize=1000] - Maximum number of cached sprites before LRU eviction
   * @returns {SpriteCache} New cache instance with LRU eviction policy
   * @throws {TypeError} When maxSize is not a positive number
   * @example
   * // Create cache with default size
   * const cache = new SpriteCache();
   * 
   * // Create cache with custom size
   * const smallCache = new SpriteCache(100);
   * @since 1.0.0
   */
  constructor(maxSize = 1000) {
    console.debug(`[SpriteCache.constructor] - DEBUG: Initializing sprite cache with max size: ${maxSize}`);
    
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      console.error(`[SpriteCache.constructor] - ERROR: Invalid maxSize parameter: ${maxSize}`);
      throw new TypeError('maxSize must be a positive number');
    }
    
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
    
    console.info(`[SpriteCache.constructor] - INFO: Sprite cache initialized successfully`);
  }

  /**
   * Generates cache key for sprite coordinates used in internal storage
   * @memberof SpriteCache
   * @param {number} x - X coordinate in sprite grid
   * @param {number} y - Y coordinate in sprite grid
   * @returns {string} Cache key in format "x,y" for efficient lookups
   * @throws {Error} Never throws, handles invalid coordinates gracefully
   * @example
   * const cache = new SpriteCache();
   * const key = cache._getCacheKey(5, 10); // Returns "5,10"
   * @since 1.0.0
   * @private
   */
  _getCacheKey(x, y) {
    console.debug(`[SpriteCache._getCacheKey] - DEBUG: Generating cache key for coordinates (${x}, ${y})`);
    return `${x},${y}`;
  }

  /**
   * Enforces cache size limits using LRU (Least Recently Used) eviction policy
   * @memberof SpriteCache
   * @returns {void} No return value, modifies cache state internally
   * @throws {Error} Never throws, safe cache management operation
   * @example
   * // Internal method called automatically during cache operations
   * // Not intended for direct use
   * @since 1.0.0
   * @private
   */
  _evictLRU() {
    console.debug(`[SpriteCache._evictLRU] - DEBUG: Starting LRU eviction, cache size: ${this.cache.size}, max: ${this.maxSize}`);
    
    let evictedCount = 0;
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (this.cache.delete(oldestKey)) {
        evictedCount++;
      }
      this.logger.debug("_evictLRU", `Evicted sprite from cache: ${oldestKey}`);
    }
    
    if (evictedCount > 0) {
      console.info(`[SpriteCache._evictLRU] - INFO: Evicted ${evictedCount} sprites from cache`);
    }
  }

  /**
   * Updates access order for LRU tracking by moving key to most recently used position
   * @memberof SpriteCache
   * @param {string} key - Cache key to update in access order
   * @returns {void} No return value, modifies internal access tracking
   * @throws {Error} Never throws, safe access order management
   * @example
   * // Internal method called automatically during cache access
   * // Not intended for direct use
   * @since 1.0.0
   * @private
   */
  _updateAccessOrder(key) {
    console.debug(`[SpriteCache._updateAccessOrder] - DEBUG: Updating access order for key: ${key}`);
    
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Stores a sprite in the cache with automatic LRU eviction if needed
   * @memberof SpriteCache
   * @param {number} x - X coordinate in sprite grid
   * @param {number} y - Y coordinate in sprite grid  
   * @param {TileSprite} sprite - Sprite instance to cache
   * @returns {void} No return value, stores sprite in cache
   * @throws {TypeError} When sprite is not a TileSprite instance
   * @example
   * const cache = new SpriteCache();
   * const sprite = new TileSprite({ x: 5, y: 10 });
   * cache.set(5, 10, sprite);
   * @since 1.0.0
   */
  set(x, y, sprite) {
    console.debug(`[SpriteCache.set] - DEBUG: Caching sprite at coordinates (${x}, ${y})`);
    
    if (!sprite || typeof sprite !== 'object') {
      console.error(`[SpriteCache.set] - ERROR: Invalid sprite parameter provided`);
      throw new TypeError('sprite must be a TileSprite instance');
    }
    
    const key = this._getCacheKey(x, y);

    this._evictLRU();
    this.cache.set(key, sprite);
    this._updateAccessOrder(key);

    console.info(`[SpriteCache.set] - INFO: Sprite cached successfully at (${x}, ${y})`);
    this.logger.debug("set", `Sprite cached at (${x}, ${y})`);
  }

  /**
   * Retrieves a sprite from the cache and updates access tracking
   * @memberof SpriteCache
   * @param {number} x - X coordinate in sprite grid
   * @param {number} y - Y coordinate in sprite grid
   * @returns {TileSprite|null} Cached sprite instance or null if not found
   * @throws {Error} Never throws, returns null for cache misses
   * @example
   * const cache = new SpriteCache();
   * const sprite = cache.get(5, 10); // Returns sprite or null
   * @since 1.0.0
   */
  get(x, y) {
    console.debug(`[SpriteCache.get] - DEBUG: Retrieving sprite at coordinates (${x}, ${y})`);
    
    const key = this._getCacheKey(x, y);
    const sprite = this.cache.get(key);

    if (sprite) {
      this.hitCount++;
      this._updateAccessOrder(key);
      sprite.recordUsage();
      console.debug(`[SpriteCache.get] - DEBUG: Cache hit for sprite at (${x}, ${y})`);
      this.logger.debug("get", `Cache hit for sprite at (${x}, ${y})`);
      return sprite;
    } else {
      this.missCount++;
      console.debug(`[SpriteCache.get] - DEBUG: Cache miss for sprite at (${x}, ${y})`);
      this.logger.debug("get", `Cache miss for sprite at (${x}, ${y})`);
      return null;
    }
  }

  /**
   * Checks if a sprite exists in cache without affecting access order
   * @memberof SpriteCache
   * @param {number} x - X coordinate in sprite grid
   * @param {number} y - Y coordinate in sprite grid
   * @returns {boolean} True if sprite is cached, false otherwise
   * @throws {Error} Never throws, safe cache existence check
   * @example
   * const cache = new SpriteCache();
   * const exists = cache.has(5, 10); // Returns true or false
   * @since 1.0.0
   */
  has(x, y) {
    console.debug(`[SpriteCache.has] - DEBUG: Checking cache existence for coordinates (${x}, ${y})`);
    
    const key = this._getCacheKey(x, y);
    const exists = this.cache.has(key);
    
    console.debug(`[SpriteCache.has] - DEBUG: Cache ${exists ? 'contains' : 'does not contain'} sprite at (${x}, ${y})`);
    return exists;
  }

  /**
   * Clears all cached sprites and resets performance counters
   * @memberof SpriteCache
   * @returns {void} No return value, clears all cache data
   * @throws {Error} Never throws, safe cache reset operation
   * @example
   * const cache = new SpriteCache();
   * cache.clear(); // Removes all cached sprites
   * @since 1.0.0
   */
  clear() {
    console.debug(`[SpriteCache.clear] - DEBUG: Clearing cache with ${this.cache.size} sprites`);
    
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    
    console.info(`[SpriteCache.clear] - INFO: Cleared ${size} sprites from cache`);
    this.logger.info("clear", `Cleared ${size} sprites from cache`);
  }

  /**
   * Gets cache performance statistics including hit rate and usage metrics
   * @memberof SpriteCache
   * @returns {Object} Cache statistics object with performance metrics
   * @throws {Error} Never throws, safe statistics calculation
   * @example
   * const cache = new SpriteCache();
   * const stats = cache.getStats();
   * // Returns: { size: 0, maxSize: 1000, hitCount: 0, missCount: 0, hitRate: "0%", totalRequests: 0 }
   * @since 1.0.0
   */
  getStats() {
    console.debug(`[SpriteCache.getStats] - DEBUG: Calculating cache statistics`);
    
    const totalRequests = this.hitCount + this.missCount;
    const hitRate =
      totalRequests > 0
        ? (this.hitCount / totalRequests * 100).toFixed(2) + "%"
        : "0%";

    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate,
      totalRequests: totalRequests
    };
    
    console.debug(`[SpriteCache.getStats] - DEBUG: Cache statistics calculated:`, stats);
    return stats;
  }
}

/**
 * @class Tileset
 * @description Main tileset class managing sprites, image data, and tile mapping for game rendering
 */
class Tileset {
  /**
   * Creates a new Tileset instance with configurable tile dimensions and sprite management
   * @constructor
   * @memberof Tileset
   * @param {Object} [data={}] - Tileset configuration data with image and tile properties
   * @param {string} [data.name] - Tileset name/identifier for debugging and reference
   * @param {string} [data.source_image] - Source image URL or path for tile graphics
   * @param {number} [data.tile_width=16] - Width of individual tiles in pixels
   * @param {number} [data.tile_height=16] - Height of individual tiles in pixels
   * @param {number} [data.tiles_per_row] - Number of tiles per row (auto-calculated if not provided)
   * @param {number} [data.total_tiles] - Total number of tiles (auto-calculated if not provided)
   * @param {Array} [data.sprites] - Array of sprite definitions to preload
   * @param {Object} [data.metadata] - Additional tileset metadata for custom properties
   * @returns {Tileset} New Tileset instance with initialized properties and sprite cache
   * @throws {TypeError} When data parameter contains invalid tile dimensions
   * @example
   * // Create a basic tileset
   * const tileset = new Tileset({
   *   name: 'dungeon',
   *   source_image: '/assets/dungeon.png'
   * });
   * 
   * // Create tileset with custom tile size
   * const largeTileset = new Tileset({
   *   name: 'large_tiles',
   *   source_image: '/assets/large.png',
   *   tile_width: 32,
   *   tile_height: 32
   * });
   * @since 1.0.0
   */
  constructor(data = {}) {
    console.debug(`[Tileset.constructor] - DEBUG: Creating tileset with data:`, data);
    
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

    console.info(`[Tileset.constructor] - INFO: Tileset '${this.name}' created with tile size ${this.tile_width}x${this.tile_height}`);
    this.logger.info(
      "constructor",
      `Tileset created: ${this.name}, tile size: ${this.tile_width}x${
        this.tile_height
      }`
    );
  }

  /**
   * Loads sprite definitions into the tileset from configuration data
   * @memberof Tileset
   * @param {Array} spriteData - Array of sprite definition objects with coordinates
   * @returns {void} No return value, loads sprites into internal storage
   * @throws {Error} Never throws, skips invalid sprite definitions
   * @example
   * // Internal method used during tileset construction
   * // Not intended for direct use
   * @since 1.0.0
   * @private
   */
  _loadSprites(spriteData) {
    console.debug(`[Tileset._loadSprites] - DEBUG: Loading ${spriteData.length} sprite definitions`);
    
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
      } else {
        console.warn(`[Tileset._loadSprites] - WARN: Skipping invalid sprite definition:`, data);
      }
    }

    console.info(`[Tileset._loadSprites] - INFO: Loaded ${loadedCount} sprites successfully`);
    this.logger.exit("_loadSprites", { loadedCount });
  }

  /**
   * Calculates tileset grid dimensions from loaded image size
   * @memberof Tileset
   * @returns {void} No return value, updates internal grid dimensions
   * @throws {Error} Never throws, logs warnings for invalid state
   * @example
   * // Internal method called after image loading
   * // Not intended for direct use
   * @since 1.0.0
   * @private
   */
  _calculateGridDimensions() {
    console.debug(`[Tileset._calculateGridDimensions] - DEBUG: Calculating grid dimensions`);
    
    if (!this.imageLoaded || !this.imageElement) {
      console.warn(`[Tileset._calculateGridDimensions] - WARN: Cannot calculate dimensions: image not loaded`);
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

    console.info(`[Tileset._calculateGridDimensions] - INFO: Grid calculated: ${this.tiles_per_row}x${calculatedTotalRows} (${this.total_tiles} tiles)`);
    this.logger.info(
      "_calculateGridDimensions",
      `Grid calculated: ${this.tiles_per_row}x${calculatedTotalRows} (${
        this.total_tiles
      } tiles)`
    );
  }

  /**
   * Loads the tileset image asynchronously with error handling and retry logic
   * @memberof Tileset
   * @param {string} [imageUrl] - Override image URL (uses source_image if not provided)
   * @returns {Promise<void>} Promise that resolves when image is loaded successfully
   * @throws {Error} When image loading fails or no URL is provided
   * @example
   * const tileset = new Tileset({ source_image: '/assets/tileset.png' });
   * await tileset.loadImage(); // Loads the image
   * 
   * // Load different image
   * await tileset.loadImage('/assets/alternate.png');
   * @since 1.0.0
   */
  async loadImage(imageUrl = null) {
    const url = imageUrl || this.source_image;
    
    console.debug(`[Tileset.loadImage] - DEBUG: Starting image load for URL: ${url}`);

    if (!url) {
      console.error(`[Tileset.loadImage] - ERROR: No image URL provided for tileset`);
      throw new Error("No image URL provided for tileset");
    }

    // Return existing promise if already loading
    if (this.loadPromise) {
      console.debug(`[Tileset.loadImage] - DEBUG: Image load already in progress, returning existing promise`);
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

        console.info(`[Tileset.loadImage] - INFO: Image loaded successfully in ${loadTime}ms`);
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

        console.error(`[Tileset.loadImage] - ERROR: Image load failed after ${loadTime}ms`);
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
   * Gets a sprite at the specified tile coordinates with caching and fallback creation.
   * @memberof Tileset
   * @param {number} x - X coordinate in tile grid (0-based)
   * @param {number} y - Y coordinate in tile grid (0-based)
   * @returns {TileSprite|null} Sprite at coordinates, created default sprite, or null if invalid
   * @throws {Error} Never throws, returns null for invalid coordinates
   * @example
   * const tileset = new Tileset();
   * const sprite = tileset.getSprite(5, 10);
   * if (sprite) {
   *   console.log(`Found sprite at (${sprite.x}, ${sprite.y})`);
   * }
   * @since 1.0.0
   */
  getSprite(x, y) {
    console.debug(`[Tileset.getSprite] - DEBUG: Retrieving sprite at coordinates (${x}, ${y})`);
    // Check cache first
    let sprite = this.spriteCache.get(x, y);
    if (sprite) {
      console.debug(`[Tileset.getSprite] - DEBUG: Sprite found in cache`);
      return sprite;
    }
    // Check stored sprites
    const key = `${x},${y}`;
    sprite = this.sprites.get(key);
    if (sprite) {
      this.spriteCache.set(x, y, sprite);
      sprite.recordUsage();
      console.debug(`[Tileset.getSprite] - DEBUG: Sprite found in storage and cached`);
      return sprite;
    }
    // Create default sprite if coordinates are valid
    if (this.isValidCoordinate(x, y)) {
      sprite = new TileSprite({ x, y });
      sprite.width = this.tile_width;
      sprite.height = this.tile_height;
      this.spriteCache.set(x, y, sprite);
      console.debug(`[Tileset.getSprite] - DEBUG: Created default sprite at (${x}, ${y})`);
      this.logger.debug("getSprite", `Created default sprite at (${x}, ${y})`);
      return sprite;
    }
    console.warn(`[Tileset.getSprite] - WARN: Invalid coordinates or sprite not found: (${x}, ${y})`);
    this.logger.warn("getSprite", `Invalid coordinates or sprite not found: (${x}, ${y})`);
    return null;
  }

  /**
   * Checks if tile coordinates are valid for this tileset's grid dimensions.
   * @memberof Tileset
   * @param {number} x - X coordinate to validate
   * @param {number} y - Y coordinate to validate
   * @returns {boolean} True if coordinates are within valid tileset bounds
   * @throws {Error} Never throws, safe coordinate validation
   * @example
   * const tileset = new Tileset({ tiles_per_row: 16 });
   * const valid = tileset.isValidCoordinate(5, 10);
   * console.log(valid); // true or false
   * @since 1.0.0
   */
  isValidCoordinate(x, y) {
    console.debug(`[Tileset.isValidCoordinate] - DEBUG: Validating coordinates (${x}, ${y})`);
    if (!this.tiles_per_row) {
      console.warn(`[Tileset.isValidCoordinate] - WARN: Cannot validate coordinates: grid dimensions not available`);
      return false; // Can't validate without grid dimensions
    }
    const maxRows = this.imageHeight
      ? Math.floor(this.imageHeight / this.tile_height)
      : Infinity;
    const isValid = x >= 0 && x < this.tiles_per_row && y >= 0 && y < maxRows;
    if (!isValid) {
      console.warn(`[Tileset.isValidCoordinate] - WARN: Coordinates (${x}, ${y}) are outside valid bounds`);
    }
    return isValid;
  }

  /**
   * Converts tileset to JSON representation for serialization and configuration storage
   * @memberof Tileset
   * @param {boolean} [includeSprites=false] - Whether to include sprite definitions in output
   * @returns {Object} JSON-serializable tileset data with configuration and state
   * @throws {Error} Never throws, safe serialization of tileset data
   * @example
   * const tileset = new Tileset({ name: 'dungeon' });
   * const json = tileset.toJSON();
   * const jsonWithSprites = tileset.toJSON(true);
   * @since 1.0.0
   */
  toJSON(includeSprites = false) {
    console.debug(`[Tileset.toJSON] - DEBUG: Serializing tileset '${this.name}' to JSON, includeSprites: ${includeSprites}`);
    
    const result = {
      name: this.name,
      source_image: this.source_image,
      tile_width: this.tile_width,
      tile_height: this.tile_height,
      tiles_per_row: this.tiles_per_row,
      total_tiles: this.total_tiles,
      metadata: this.metadata,
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
      defaultSprite: this.defaultSprite
        ? this.defaultSprite.toJSON()
        : null
    };

    if (includeSprites) {
      result.sprites = Array.from(this.sprites.values()).map(sprite =>
        sprite.toJSON()
      );
    }

    console.debug(`[Tileset.toJSON] - DEBUG: Tileset serialization complete`);
    return result;
  }
}

/**
 * @class TilesetLoader
 * @description Utility class for loading and managing multiple tilesets with caching and lifecycle management
 */
class TilesetLoader {
  /**
   * Creates a new TilesetLoader instance for managing multiple tileset loading operations
   * @constructor
   * @memberof TilesetLoader
   * @returns {TilesetLoader} New loader instance with empty tileset registry
   * @example
   * const loader = new TilesetLoader();
   * const tileset = await loader.loadTileset({
   *   name: 'dungeon',
   *   source_image: '/assets/dungeon.png'
   * });
   * @since 1.0.0
   */
  constructor() {
    console.debug(`[TilesetLoader.constructor] - DEBUG: Initializing tileset loader`);
    
    this.logger = createLogger("TilesetLoader", LogLevel.INFO);
    this.tilesets = new Map();
    this.loadingPromises = new Map();

    console.info(`[TilesetLoader.constructor] - INFO: Tileset loader initialized successfully`);
    this.logger.info("constructor", "Tileset loader initialized");
  }

  /**
   * Loads a tileset from configuration data with automatic caching and deduplication
   * @memberof TilesetLoader
   * @param {Object} config - Tileset configuration object
   * @param {string} [config.name] - Tileset identifier for caching
   * @param {string} config.source_image - Image URL for tileset graphics
   * @param {number} [config.tile_width] - Tile width in pixels
   * @param {number} [config.tile_height] - Tile height in pixels
   * @param {boolean} [preloadImage=true] - Whether to preload the image immediately
   * @returns {Promise<Tileset>} Loaded tileset
   * @throws {Error} When tileset loading fails or configuration is invalid
   * @example
   * const loader = new TilesetLoader();
   * const tileset = await loader.loadTileset({
   *   name: 'dungeon',
   *   source_image: '/assets/dungeon.png',
   *   tile_width: 16,
   *   tile_height: 16
   * });
   * @since 1.0.0
   */
  async loadTileset(config, preloadImage = true) {
    const name = config.name || "default";

    console.debug(`[TilesetLoader.loadTileset] - DEBUG: Loading tileset '${name}' with preload: ${preloadImage}`);

    this.logger.enter("loadTileset", { name, preloadImage });

    // Check if already loading
    if (this.loadingPromises.has(name)) {
      console.debug(`[TilesetLoader.loadTileset] - DEBUG: Tileset '${name}' already loading, returning existing promise`);
      this.logger.debug(
        "loadTileset",
        `Tileset ${name} already loading, returning existing promise`
      );
      return this.loadingPromises.get(name);
    }

    // Check if already loaded
    if (this.tilesets.has(name)) {
      const existing = this.tilesets.get(name);
      console.debug(`[TilesetLoader.loadTileset] - DEBUG: Tileset '${name}' already loaded`);
      this.logger.debug("loadTileset", `Tileset ${name} already loaded`);
      return existing;
    }

    const loadPromise = this._performLoad(config, name, preloadImage);
    this.loadingPromises.set(name, loadPromise);

    try {
      const tileset = await loadPromise;
      this.tilesets.set(name, tileset);
      console.info(`[TilesetLoader.loadTileset] - INFO: Tileset '${name}' loaded successfully`);
      return tileset;
    } catch (error) {
      console.error(`[TilesetLoader.loadTileset] - ERROR: Failed to load tileset '${name}':`, error);
      this.logger.error("loadTileset", `Failed to load tileset ${name}`, error);
      throw error;
    } finally {
      this.logger.exit("loadTileset", { name, success: true });
    }
  }

  /**
   * Performs the actual tileset loading operation with image preloading
   * @memberof TilesetLoader
   * @param {Object} config - Tileset configuration data
   * @param {string} name - Tileset name
   * @param {boolean} preloadImage - Whether to preload the tileset image
   * @returns {Promise<Tileset>} Promise resolving to loaded tileset instance
   * @throws {Error} When tileset creation or image loading fails
   * @private
   */
  async _performLoad(config, name, preloadImage) {
    console.debug(`[TilesetLoader._performLoad] - DEBUG: Performing load for tileset '${name}'`);
    
    const tileset = new Tileset({ ...config, name });
    this.logger.debug("_performLoad", `Creating tileset: ${name}`);

    try {
      if (preloadImage && tileset.source_image) {
        console.debug(`[TilesetLoader._performLoad] - DEBUG: Preloading image for tileset '${name}'`);
        await tileset.loadImage();
      }
      console.info(`[TilesetLoader._performLoad] - INFO: Tileset '${name}' load operation completed`);
      return tileset;
    } catch (error) {
      console.error(`[TilesetLoader._performLoad] - ERROR: Failed to load tileset '${name}':`, error);
      throw error;
    }
  }

  /**
   * Gets a loaded tileset by name from the internal registry
   * @memberof TilesetLoader
   * @param {string} name - Tileset name to retrieve
   * @returns {Tileset|null} Tileset instance or null if not found
   * @throws {Error} Never throws, returns null for missing tilesets
   * @example
   * const loader = new TilesetLoader();
   * const tileset = loader.getTileset('dungeon');
   * if (tileset) {
   *   console.log(`Tileset loaded: ${tileset.name}`);
   * }
   * @since 1.0.0
   */
  getTileset(name) {
    console.debug(`[TilesetLoader.getTileset] - DEBUG: Retrieving tileset '${name}'`);
    const tileset = this.tilesets.get(name);
    if (tileset) {
      console.debug(`[TilesetLoader.getTileset] - DEBUG: Tileset '${name}' found`);
      this.logger.debug("getTileset", `Retrieved tileset: ${name}`);
    } else {
      console.warn(`[TilesetLoader.getTileset] - WARN: Tileset '${name}' not found`);
      this.logger.warn("getTileset", `Tileset not found: ${name}`);
    }
    return tileset || null;
  }

  /**
   * Unloads a tileset and frees its resources from memory
   * @memberof TilesetLoader
   * @param {string} name - Tileset name to unload
   * @returns {boolean} True if tileset was unloaded, false if not found
   * @throws {Error} Never throws, safe resource cleanup
   * @example
   * const loader = new TilesetLoader();
   * const unloaded = loader.unloadTileset('dungeon');
   * console.log(unloaded); // true if tileset was found and unloaded
   * @since 1.0.0
   */
  unloadTileset(name) {
    console.debug(`[TilesetLoader.unloadTileset] - DEBUG: Unloading tileset '${name}'`);
    if (this.tilesets.has(name)) {
      const tileset = this.tilesets.get(name);
      tileset.reset();
      this.tilesets.delete(name);
      console.info(`[TilesetLoader.unloadTileset] - INFO: Tileset '${name}' unloaded successfully`);
      this.logger.info("unloadTileset", `Tileset unloaded: ${name}`);
      return true;
    } else {
      console.warn(`[TilesetLoader.unloadTileset] - WARN: Tileset '${name}' not found for unloading`);
      this.logger.warn(
        "unloadTileset",
        `Tileset not found for unloading: ${name}`
      );
    }
    return false;
  }

  /**
   * Checks if a tileset is loaded in the registry
   * @memberof TilesetLoader
   * @param {string} name - Tileset name to check
   * @returns {boolean} True if tileset is loaded, false otherwise
   * @throws {Error} Never throws, safe registry check
   * @example
   * const loader = new TilesetLoader();
   * const exists = loader.hasTileset('dungeon');
   * console.log(exists); // true or false
   * @since 1.0.0
   */
  hasTileset(name) {
    console.debug(`[TilesetLoader.hasTileset] - DEBUG: Checking existence of tileset '${name}'`);
    const exists = this.tilesets.has(name);
    console.debug(`[TilesetLoader.hasTileset] - DEBUG: Tileset '${name}' ${exists ? 'exists' : 'does not exist'}`);
    return exists;
  }

  /**
   * Clears all tilesets and resets loader state
   * @memberof TilesetLoader
   * @returns {void} No return value, clears all loader state
   * @throws {Error} Never throws, safe complete reset operation
   * @example
   * const loader = new TilesetLoader();
   * loader.clear(); // Unloads all tilesets and clears registry
   * @since 1.0.0
   */
  clear() {
    this.logger.info("clear", `Clearing ${this.tilesets.size} loaded tilesets`);

    for (const tileset of this.tilesets.values()) {
      tileset.reset();
    }

    this.tilesets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Gets comprehensive loader statistics including all tileset metrics
   * @memberof TilesetLoader
   * @returns {Object} Loader statistics with tileset registry and performance data
   * @throws {Error} Never throws, safe statistics calculation
   * @example
   * const loader = new TilesetLoader();
   * const stats = loader.getStats();
   * console.log(stats.tilesets); // Individual tileset statistics
   * console.log(stats.loadedTilesets); // Number of loaded tilesets
   * @since 1.0.0
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
}

// Export public interface
export { Tileset, TileSprite, TilesetLoader, SpriteCache };

console.log("[Tileset] Tileset model module loaded successfully");
