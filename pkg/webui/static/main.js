/**
 * @fileoverview Main application entry point for dgamelaunch web client interface
 * @module main
 * @requires utils/logger
 * @requires components/game-display
 * @requires components/connection-status
 * @requires services/game-client
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel, setGlobalLogLevel } from "./utils/logger.js";
import { GameDisplay, RenderMode } from "./components/game-display.js";
import {
  ConnectionStatus,
  StatusState
} from "./components/connection-status.js";
import { GameClient, ConnectionState } from "./services/game-client.js";

/**
 * @enum {string}
 * @readonly
 * @description Application initialization states for startup tracking
 */
const AppState = {
  UNINITIALIZED: "uninitialized",
  INITIALIZING: "initializing",
  INITIALIZED: "initialized",
  CONNECTING: "connecting",
  RUNNING: "running",
  ERROR: "error",
  SHUTDOWN: "shutdown"
};

/**
 * @class ConfigurationManager
 * @description Manages application configuration including server settings, display preferences, and user options
 */
class ConfigurationManager {
  /**
   * Creates a new ConfigurationManager instance
   */
  constructor() {
    this.logger = createLogger("ConfigurationManager", LogLevel.INFO);

    // Default configuration with dgamelaunch-compatible settings
    this.defaultConfig = {
      server: {
        rpcEndpoint: "/rpc",
        reconnectAttempts: 10,
        reconnectDelay: 5000,
        connectionTimeout: 30000,
        autoReconnect: true
      },
      display: {
        renderMode: RenderMode.HYBRID,
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, "Liberation Mono", monospace',
        antialiasing: false,
        showConnectionStatus: true,
        showPerformanceStats: false,
        allowViewportControl: true
      },
      input: {
        captureKeyboard: true,
        captureMouse: false,
        captureFocus: true,
        preventDefaultKeys: [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Space",
          "Enter",
          "Escape",
          "Home",
          "End",
          "PageUp",
          "PageDown"
        ]
      },
      logging: {
        level: "INFO",
        enableConsole: true,
        enablePerformanceMetrics: false
      },
      advanced: {
        pollInterval: 100,
        fastPollInterval: 50,
        inputBufferSize: 100,
        maxLatencyHistory: 50
      }
    };

    this.config = { ...this.defaultConfig };
    this.configSource = "default";

    this.logger.info(
      "constructor",
      "Configuration manager initialized with defaults"
    );
  }

  /**
   * Loads configuration from various sources in priority order
   * @returns {Promise<Object>} Loaded configuration object
   */
  async loadConfiguration() {
    this.logger.enter("loadConfiguration");

    try {
      // Try to load from server-provided configuration endpoint
      const serverConfig = await this._loadServerConfig();
      if (serverConfig) {
        this.config = this._mergeConfig(this.config, serverConfig);
        this.configSource = "server";
        this.logger.info(
          "loadConfiguration",
          "Configuration loaded from server"
        );
      }

      // Try to load from localStorage for user preferences
      const localConfig = this._loadLocalConfig();
      if (localConfig) {
        this.config = this._mergeConfig(this.config, localConfig);
        this.configSource =
          this.configSource === "server" ? "server+local" : "local";
        this.logger.info(
          "loadConfiguration",
          "Local configuration preferences applied"
        );
      }

      // Try to load from URL parameters for session overrides
      const urlConfig = this._loadUrlConfig();
      if (urlConfig) {
        this.config = this._mergeConfig(this.config, urlConfig);
        this.configSource += "+url";
        this.logger.info(
          "loadConfiguration",
          "URL parameter overrides applied"
        );
      }

      // Validate final configuration
      this._validateConfiguration();

      this.logger.exit("loadConfiguration", {
        source: this.configSource,
        renderMode: this.config.display.renderMode
      });

      return this.config;
    } catch (error) {
      this.logger.error(
        "loadConfiguration",
        "Configuration loading failed",
        error
      );
      // Fall back to defaults on any error
      this.config = { ...this.defaultConfig };
      this.configSource = "default (fallback)";
      return this.config;
    }
  }

  /**
   * Attempts to load configuration from server endpoint
   * @returns {Promise<Object|null>} Server configuration or null if unavailable
   * @private
   */
  async _loadServerConfig() {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const serverConfig = await response.json();
        this.logger.debug(
          "_loadServerConfig",
          "Server configuration retrieved"
        );
        return serverConfig;
      }
    } catch (error) {
      this.logger.debug(
        "_loadServerConfig",
        "Server configuration not available",
        error
      );
    }
    return null;
  }

  /**
   * Loads configuration from localStorage
   * @returns {Object|null} Local configuration or null if unavailable
   * @private
   */
  _loadLocalConfig() {
    try {
      const stored = localStorage.getItem("dgamelaunch-config");
      if (stored) {
        const localConfig = JSON.parse(stored);
        this.logger.debug(
          "_loadLocalConfig",
          "Local configuration loaded from storage"
        );
        return localConfig;
      }
    } catch (error) {
      this.logger.warn(
        "_loadLocalConfig",
        "Failed to load local configuration",
        error
      );
    }
    return null;
  }

  /**
   * Loads configuration overrides from URL parameters
   * @returns {Object|null} URL configuration or null if no parameters
   * @private
   */
  _loadUrlConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfig = {};
    let hasParams = false;

    // Map URL parameters to configuration paths
    const paramMappings = {
      render_mode: "display.renderMode",
      font_size: "display.fontSize",
      debug: "logging.level",
      performance: "display.showPerformanceStats",
      rpc_endpoint: "server.rpcEndpoint"
    };

    for (const [param, configPath] of Object.entries(paramMappings)) {
      const value = urlParams.get(param);
      if (value !== null) {
        this._setNestedProperty(
          urlConfig,
          configPath,
          this._parseUrlValue(value)
        );
        hasParams = true;
      }
    }

    if (hasParams) {
      this.logger.debug("_loadUrlConfig", "URL parameters parsed", urlConfig);
      return urlConfig;
    }

    return null;
  }

  /**
   * Parses a URL parameter value to appropriate type
   * @param {string} value - Raw URL parameter value
   * @returns {*} Parsed value with correct type
   * @private
   */
  _parseUrlValue(value) {
    // Handle boolean values
    if (value === "true") return true;
    if (value === "false") return false;

    // Handle numeric values
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;

    // Handle special logging level conversion
    if (value.toUpperCase() === "DEBUG") return "DEBUG";

    // Return as string
    return value;
  }

  /**
   * Sets a nested property in an object using dot notation
   * @param {Object} obj - Target object
   * @param {string} path - Dot-separated property path
   * @param {*} value - Value to set
   * @private
   */
  _setNestedProperty(obj, path, value) {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Merges configuration objects with deep merge for nested properties
   * @param {Object} base - Base configuration object
   * @param {Object} override - Override configuration object
   * @returns {Object} Merged configuration
   * @private
   */
  _mergeConfig(base, override) {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = this._mergeConfig(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validates the final configuration for consistency and correctness
   * @private
   */
  _validateConfiguration() {
    const config = this.config;

    // Validate render mode
    if (!Object.values(RenderMode).includes(config.display.renderMode)) {
      this.logger.warn(
        "_validateConfiguration",
        `Invalid render mode: ${config.display.renderMode}, using default`
      );
      config.display.renderMode = RenderMode.HYBRID;
    }

    // Validate font size
    if (config.display.fontSize < 8 || config.display.fontSize > 32) {
      this.logger.warn(
        "_validateConfiguration",
        `Invalid font size: ${config.display.fontSize}, using default`
      );
      config.display.fontSize = 14;
    }

    // Validate poll intervals
    if (config.advanced.pollInterval < 50) {
      this.logger.warn(
        "_validateConfiguration",
        "Poll interval too low, adjusting to minimum"
      );
      config.advanced.pollInterval = 50;
    }

    // Validate logging level
    const validLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
    if (!validLevels.includes(config.logging.level)) {
      this.logger.warn(
        "_validateConfiguration",
        `Invalid log level: ${config.logging.level}, using INFO`
      );
      config.logging.level = "INFO";
    }

    this.logger.debug(
      "_validateConfiguration",
      "Configuration validation complete"
    );
  }

  /**
   * Saves user preferences to localStorage
   * @param {Object} preferences - User preference overrides to save
   */
  saveUserPreferences(preferences) {
    try {
      const currentLocal = this._loadLocalConfig() || {};
      const updatedLocal = this._mergeConfig(currentLocal, preferences);

      localStorage.setItem("dgamelaunch-config", JSON.stringify(updatedLocal));
      this.logger.info(
        "saveUserPreferences",
        "User preferences saved to local storage"
      );
    } catch (error) {
      this.logger.error(
        "saveUserPreferences",
        "Failed to save user preferences",
        error
      );
    }
  }

  /**
   * Gets the current configuration
   * @returns {Object} Current configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Gets configuration source information
   * @returns {string} Description of configuration sources used
   */
  getConfigSource() {
    return this.configSource;
  }
}

/**
 * @class ApplicationManager
 * @description Main application manager coordinating all subsystems and handling lifecycle events
 */
class ApplicationManager {
  /**
   * Creates a new ApplicationManager instance
   * @param {HTMLElement} containerElement - Main container element for the application
   */
  constructor(containerElement) {
    this.logger = createLogger("ApplicationManager", LogLevel.INFO);

    this.container = containerElement;
    this.state = AppState.UNINITIALIZED;
    this.stateChangeTime = Date.now();

    // Core components
    this.configManager = new ConfigurationManager();
    this.gameDisplay = null;
    this.connectionStatus = null;

    // Application state
    this.config = null;
    this.startTime = Date.now();
    this.errorHistory = [];

    // Event handling
    this.eventListeners = new Map();

    this.logger.info("constructor", "Application manager created");
  }

  /**
   * Sets the application state and notifies listeners
   * @param {string} newState - New application state from AppState enum
   * @param {string} [reason] - Optional reason for state change
   * @private
   */
  _setState(newState, reason = null) {
    const previousState = this.state;
    this.state = newState;
    this.stateChangeTime = Date.now();

    this.logger.info(
      "_setState",
      `Application state: ${previousState} -> ${newState}`,
      { reason }
    );

    // Emit state change event
    this._emitEvent("statechange", {
      newState,
      previousState,
      reason,
      timestamp: this.stateChangeTime
    });
  }

  /**
   * Emits application events to registered listeners
   * @param {string} eventType - Type of event to emit
   * @param {Object} eventData - Event data payload
   * @private
   */
  _emitEvent(eventType, eventData) {
    const listeners = this.eventListeners.get(eventType) || [];

    for (const listener of listeners) {
      try {
        listener(eventData);
      } catch (error) {
        this.logger.error(
          "_emitEvent",
          `Error in ${eventType} event listener`,
          error
        );
      }
    }
  }

  /**
   * Registers an event listener for application events
   * @param {string} eventType - Type of event to listen for
   * @param {Function} listener - Listener function to call
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType).push(listener);
    this.logger.debug(
      "addEventListener",
      `Event listener registered for: ${eventType}`
    );
  }

  /**
   * Removes an event listener
   * @param {string} eventType - Type of event to remove listener from
   * @param {Function} listener - Listener function to remove
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(listener);

    if (index !== -1) {
      listeners.splice(index, 1);
      this.logger.debug(
        "removeEventListener",
        `Event listener removed for: ${eventType}`
      );
    }
  }

  /**
   * Initializes the application and all subsystems
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {
    this.logger.enter("initialize");
    this._setState(AppState.INITIALIZING, "application_startup");

    try {
      // Load configuration first
      this.config = await this.configManager.loadConfiguration();

      // Apply logging configuration
      setGlobalLogLevel(LogLevel[this.config.logging.level] || LogLevel.INFO);

      this.logger.info("initialize", "Configuration loaded", {
        source: this.configManager.getConfigSource(),
        renderMode: this.config.display.renderMode
      });

      // Initialize display components
      await this._initializeDisplay();

      // Set up global error handling
      this._setupErrorHandling();

      // Set up window event handlers
      this._setupWindowHandlers();

      this._setState(AppState.INITIALIZED, "initialization_complete");

      this.logger.exit("initialize", {
        success: true,
        initTime: Date.now() - this.startTime
      });
    } catch (error) {
      this._setState(AppState.ERROR, "initialization_failed");
      this.logger.error(
        "initialize",
        "Application initialization failed",
        error
      );
      this._recordError(error, "initialization");
      throw error;
    }
  }

  /**
   * Initializes the game display and related UI components
   * @returns {Promise<void>} Promise that resolves when display is ready
   * @private
   */
  async _initializeDisplay() {
    this.logger.enter("_initializeDisplay");

    try {
      // Create game display with configuration
      const displayOptions = {
        client: {
          rpcEndpoint: this.config.server.rpcEndpoint,
          pollInterval: this.config.advanced.pollInterval,
          fastPollInterval: this.config.advanced.fastPollInterval,
          connection: {
            maxReconnectAttempts: this.config.server.reconnectAttempts,
            reconnectDelay: this.config.server.reconnectDelay,
            connectionTimeout: this.config.server.connectionTimeout,
            autoReconnect: this.config.server.autoReconnect
          }
        },
        renderer: {
          mode: this.config.display.renderMode,
          fontSize: this.config.display.fontSize,
          fontFamily: this.config.display.fontFamily,
          antialiasing: this.config.display.antialiasing
        },
        viewport: {
          allowScroll: this.config.display.allowViewportControl,
          autoResize: true
        },
        input: this.config.input,
        showConnectionStatus: this.config.display.showConnectionStatus,
        showPerformanceStats: this.config.display.showPerformanceStats
      };

      this.gameDisplay = new GameDisplay(this.container, displayOptions);

      // Initialize the display
      await this.gameDisplay.init();

      this.logger.info(
        "_initializeDisplay",
        "Game display initialized successfully"
      );
    } catch (error) {
      this.logger.error(
        "_initializeDisplay",
        "Display initialization failed",
        error
      );
      throw error;
    }
  }

  /**
   * Sets up global error handling for uncaught errors
   * @private
   */
  _setupErrorHandling() {
    // Handle uncaught JavaScript errors
    window.addEventListener("error", event => {
      this.logger.error("_setupErrorHandling", "Uncaught error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });

      this._recordError(event.error || new Error(event.message), "uncaught");
    });

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", event => {
      this.logger.error(
        "_setupErrorHandling",
        "Unhandled promise rejection",
        event.reason
      );
      this._recordError(event.reason, "unhandled_promise");
    });

    this.logger.debug(
      "_setupErrorHandling",
      "Global error handlers configured"
    );
  }

  /**
   * Sets up window-level event handlers
   * @private
   */
  _setupWindowHandlers() {
    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      const isVisible = !document.hidden;
      this.logger.debug(
        "_setupWindowHandlers",
        `Page visibility: ${isVisible ? "visible" : "hidden"}`
      );

      this._emitEvent("visibilitychange", { visible: isVisible });
    });

    // Handle beforeunload for cleanup
    window.addEventListener("beforeunload", event => {
      this.logger.info(
        "_setupWindowHandlers",
        "Page unloading, performing cleanup"
      );
      this._shutdown();
    });

    // Handle focus changes for input management
    window.addEventListener("focus", () => {
      this._emitEvent("windowfocus", { focused: true });
    });

    window.addEventListener("blur", () => {
      this._emitEvent("windowfocus", { focused: false });
    });

    this.logger.debug(
      "_setupWindowHandlers",
      "Window event handlers configured"
    );
  }

  /**
   * Records an error in the error history for debugging
   * @param {Error} error - Error object to record
   * @param {string} context - Context where error occurred
   * @private
   */
  _recordError(error, context) {
    const errorRecord = {
      timestamp: Date.now(),
      context: context,
      message: error.message,
      stack: error.stack,
      name: error.name
    };

    this.errorHistory.push(errorRecord);

    // Limit error history size
    if (this.errorHistory.length > 50) {
      this.errorHistory.shift();
    }

    this._emitEvent("error", errorRecord);
  }

  /**
   * Starts the application and begins normal operation
   * @returns {Promise<void>} Promise that resolves when application is running
   */
  async start() {
    this.logger.enter("start");

    if (this.state !== AppState.INITIALIZED) {
      throw new Error(`Cannot start application in state: ${this.state}`);
    }

    try {
      this._setState(AppState.CONNECTING, "start_requested");

      // The game display will handle connection establishment
      // Just transition to running state
      this._setState(AppState.RUNNING, "application_started");

      this.logger.exit("start", { success: true });
    } catch (error) {
      this._setState(AppState.ERROR, "start_failed");
      this.logger.error("start", "Application start failed", error);
      this._recordError(error, "start");
      throw error;
    }
  }

  /**
   * Stops the application gracefully
   */
  stop() {
    this.logger.enter("stop");

    if (this.gameDisplay) {
      this.gameDisplay.stop();
    }

    this._setState(AppState.SHUTDOWN, "stop_requested");

    this.logger.info("stop", "Application stopped");
  }

  /**
   * Performs complete application shutdown and cleanup
   * @private
   */
  _shutdown() {
    this.logger.enter("_shutdown");

    if (this.gameDisplay) {
      this.gameDisplay.destroy();
      this.gameDisplay = null;
    }

    // Clear event listeners
    this.eventListeners.clear();

    this._setState(AppState.SHUTDOWN, "shutdown_complete");

    this.logger.info("_shutdown", "Application shutdown complete");
  }

  /**
   * Gets current application status and statistics
   * @returns {Object} Application status information
   */
  getStatus() {
    const uptime = Date.now() - this.startTime;
    const stateAge = Date.now() - this.stateChangeTime;

    return {
      state: this.state,
      stateAge: stateAge,
      uptime: uptime,
      startTime: this.startTime,
      configSource: this.configManager.getConfigSource(),
      errorCount: this.errorHistory.length,
      gameDisplay: this.gameDisplay ? this.gameDisplay.getStats() : null,
      config: this.config
        ? {
            renderMode: this.config.display.renderMode,
            fontSize: this.config.display.fontSize,
            rpcEndpoint: this.config.server.rpcEndpoint
          }
        : null
    };
  }

  /**
   * Gets error history for debugging
   * @returns {Array} Array of error records
   */
  getErrorHistory() {
    return [...this.errorHistory];
  }

  /**
   * Updates user preferences and applies them
   * @param {Object} preferences - User preference updates
   */
  updatePreferences(preferences) {
    this.logger.info(
      "updatePreferences",
      "Updating user preferences",
      preferences
    );

    // Save to local storage
    this.configManager.saveUserPreferences(preferences);

    // Apply immediate changes that don't require restart
    if (preferences.logging && preferences.logging.level) {
      setGlobalLogLevel(LogLevel[preferences.logging.level] || LogLevel.INFO);
    }

    this._emitEvent("preferenceschanged", preferences);
  }
}

/**
 * @class WebGameClient
 * @description Main web game client class providing the public API for integration
 */
class WebGameClient {
  /**
   * Creates a new WebGameClient instance
   * @param {HTMLElement|string} container - Container element or selector for the game interface
   * @param {Object} [options={}] - Client configuration options
   */
  constructor(container, options = {}) {
    // Resolve container element
    if (typeof container === "string") {
      container = document.querySelector(container);
    }

    if (!container) {
      throw new Error("Container element not found");
    }

    this.logger = createLogger("WebGameClient", LogLevel.INFO);
    this.appManager = new ApplicationManager(container);
    this.options = options;

    // Public event interface
    this.onStateChange = null;
    this.onError = null;
    this.onReady = null;

    this._setupEventForwarding();

    this.logger.info("constructor", "Web game client created");
  }

  /**
   * Sets up event forwarding from application manager to public interface
   * @private
   */
  _setupEventForwarding() {
    // Forward state changes
    this.appManager.addEventListener("statechange", data => {
      if (this.onStateChange) {
        this.onStateChange(data);
      }
    });

    // Forward errors
    this.appManager.addEventListener("error", data => {
      if (this.onError) {
        this.onError(data);
      }
    });

    // Notify when ready
    this.appManager.addEventListener("statechange", data => {
      if (data.newState === AppState.RUNNING && this.onReady) {
        this.onReady();
      }
    });
  }

  /**
   * Initializes and starts the web game client
   * @returns {Promise<void>} Promise that resolves when client is ready
   */
  async start() {
    this.logger.enter("start");

    try {
      await this.appManager.initialize();
      await this.appManager.start();

      this.logger.exit("start", { success: true });
    } catch (error) {
      this.logger.error("start", "Client start failed", error);
      throw error;
    }
  }

  /**
   * Stops the web game client
   */
  stop() {
    this.logger.info("stop", "Stopping web game client");
    this.appManager.stop();
  }

  /**
   * Gets current client status
   * @returns {Object} Client status information
   */
  getStatus() {
    return this.appManager.getStatus();
  }

  /**
   * Updates user preferences
   * @param {Object} preferences - Preference updates
   */
  updatePreferences(preferences) {
    this.appManager.updatePreferences(preferences);
  }

  /**
   * Gets error history for debugging
   * @returns {Array} Error history
   */
  getErrors() {
    return this.appManager.getErrorHistory();
  }
}

// Auto-initialization if container element exists
document.addEventListener("DOMContentLoaded", () => {
  const logger = createLogger("AutoInit", LogLevel.INFO);

  // Look for auto-init container
  const autoContainer = document.querySelector("#dgamelaunch-client");
  if (autoContainer) {
    logger.info("DOMContentLoaded", "Auto-initializing dgamelaunch client");

    const client = new WebGameClient(autoContainer);

    // Set up basic event handlers
    client.onStateChange = data => {
      logger.info("AutoInit", `Client state: ${data.newState}`, {
        reason: data.reason
      });
    };

    client.onError = error => {
      logger.error("AutoInit", "Client error", error);
    };

    client.onReady = () => {
      logger.info("AutoInit", "Client ready for use");
    };

    // Start the client
    client.start().catch(error => {
      logger.error("AutoInit", "Auto-initialization failed", error);

      // Display error to user
      autoContainer.innerHTML = `
        <div style="
          padding: 20px; 
          background: #f8d7da; 
          color: #721c24; 
          border: 1px solid #f5c6cb; 
          border-radius: 4px;
          font-family: monospace;
        ">
          <h3>dgamelaunch Client Error</h3>
          <p>Failed to initialize the game client: ${error.message}</p>
          <p>Please check the console for detailed error information.</p>
        </div>
      `;
    });

    // Make client available globally for debugging
    window.dgamelaunhClient = client;
  }
});

// Export public interface
export { WebGameClient, ApplicationManager, ConfigurationManager, AppState };

// Global logging for module load
console.log(
  "[WebGameClient] dgamelaunch web client main module loaded successfully"
);
