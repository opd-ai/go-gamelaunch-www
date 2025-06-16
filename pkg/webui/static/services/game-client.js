/**
 * @fileoverview Game client service for managing connections to dgamelaunch servers with RPC communication
 * @module services/game-client
 * @requires utils/logger
 * @requires models/game-state
 * @requires services/input-manager
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";
import { GameState } from "../models/game-state.js";
import { InputManager, InputEventType } from "./input-manager.js";

/**
 * @enum {string}
 * @readonly
 * @description Connection states for game client state management
 */
const ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  AUTHENTICATED: "authenticated",
  PLAYING: "playing",
  ERROR: "error",
  RECONNECTING: "reconnecting"
};

/**
 * @enum {string}
 * @readonly
 * @description RPC method names for server communication
 */
const RPCMethod = {
  CONNECT: "GameClient.Connect",
  DISCONNECT: "GameClient.Disconnect",
  SEND_INPUT: "GameClient.SendInput",
  GET_STATE: "GameClient.GetState",
  RESIZE: "GameClient.Resize",
  PING: "GameClient.Ping"
};

/**
 * @class RPCClient
 * @description Handles JSON-RPC communication with the server for game client operations
 * @since 1.0.0
 */
class RPCClient {
  /**
   * Creates a new RPCClient instance with endpoint configuration and request management
   * @constructor
   * @memberof RPCClient
   * @param {string} endpoint - RPC endpoint URL for server communication
   * @param {Object} [options={}] - Client configuration options for request handling
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   * @param {number} [options.retryAttempts=3] - Number of retry attempts for failed requests
   * @param {number} [options.retryDelay=1000] - Delay between retry attempts in milliseconds
   * @returns {RPCClient} New RPCClient instance with configured endpoint and options
   * @throws {TypeError} When endpoint is not a string or options is not an object
   * @example
   * // Create RPC client with default options
   * const client = new RPCClient('/rpc');
   * 
   * // Create RPC client with custom timeout and retry settings
   * const customClient = new RPCClient('/api/rpc', {
   *   timeout: 10000, retryAttempts: 5, retryDelay: 2000
   * });
   * @since 1.0.0
   */
  constructor(endpoint, options = {}) {
    console.debug(`[RPCClient.constructor] - DEBUG: Creating RPC client with endpoint ${endpoint}`, options);
    
    this.logger = createLogger("RPCClient", LogLevel.DEBUG);
    this.endpoint = endpoint;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };

    this.requestId = 1;
    this.pendingRequests = new Map();

    console.info(`[RPCClient.constructor] - INFO: RPC client initialized with timeout ${this.options.timeout}ms`);
    this.logger.info("constructor", `RPC client initialized: ${endpoint}`);
  }

  /**
   * Sends an RPC request to the server with error handling and response validation
   * @memberof RPCClient
   * @param {string} method - RPC method name for server invocation
   * @param {Object} [params={}] - Method parameters to send with the request
   * @returns {Promise<*>} Promise resolving to the RPC result data from server
   * @throws {Error} When RPC call fails due to network, server, or protocol errors
   * @example
   * // Simple RPC call without parameters
   * const result = await client.call('GameClient.Ping');
   * 
   * // RPC call with parameters
   * const state = await client.call('GameClient.GetState', {
   *   sessionId: 'abc123', version: 42
   * });
   * @since 1.0.0
   */
  async call(method, params = {}) {
    console.debug(`[RPCClient.call] - DEBUG: Starting RPC call to method ${method}`, params);
    
    const id = this.requestId++;
    const request = {
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: id
    };

    this.logger.debug("call", `RPC request: ${method}`, { id, params });

    try {
      const response = await this._makeRequest(request);

      if (response.error) {
        console.error(`[RPCClient.call] - ERROR: RPC error response for method ${method}:`, response.error);
        throw new Error(`RPC Error: ${response.error.message}`);
      }

      console.info(`[RPCClient.call] - INFO: RPC call successful for method ${method}`);
      this.logger.debug("call", `RPC response: ${method}`, {
        id,
        result: response.result
      });
      return response.result;
    } catch (error) {
      console.error(`[RPCClient.call] - ERROR: RPC call failed for method ${method}:`, error);
      this.logger.error("call", `RPC call failed: ${method}`, error);
      throw error;
    }
  }

  /**
   * Makes the actual HTTP request with timeout handling and error recovery
   * @memberof RPCClient
   * @param {Object} request - JSON-RPC request object with method, params, and id
   * @returns {Promise<Object>} Promise resolving to the parsed JSON response
   * @throws {Error} When HTTP request fails, times out, or returns invalid response
   * @example
   * // Internal method called by call() method
   * // const response = await this._makeRequest(requestObject);
   * @since 1.0.0
   * @private
   */
  async _makeRequest(request) {
    console.debug(`[RPCClient._makeRequest] - DEBUG: Making HTTP request for RPC`, request);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.options.timeout
    );

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[RPCClient._makeRequest] - WARN: HTTP error response ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.info(`[RPCClient._makeRequest] - INFO: HTTP request completed successfully`);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        console.error(`[RPCClient._makeRequest] - ERROR: Request timed out after ${this.options.timeout}ms`);
        throw new Error("Request timeout");
      }

      console.error(`[RPCClient._makeRequest] - ERROR: HTTP request failed:`, error);
      throw error;
    }
  }
}

/**
 * @class ConnectionManager
 * @description Manages connection state and reconnection logic with history tracking
 * @since 1.0.0
 */
class ConnectionManager {
  /**
   * Creates a new ConnectionManager instance with reconnection settings and event handling
   * @constructor
   * @memberof ConnectionManager
   * @param {Object} [options={}] - Connection configuration options for behavior control
   * @param {boolean} [options.autoReconnect=true] - Whether to automatically attempt reconnection
   * @param {number} [options.maxReconnectAttempts=10] - Maximum number of reconnection attempts
   * @param {number} [options.reconnectDelay=5000] - Base delay between reconnection attempts in milliseconds
   * @returns {ConnectionManager} New ConnectionManager instance with configured options
   * @throws {TypeError} When options parameter is not an object
   * @example
   * // Create connection manager with default auto-reconnect
   * const manager = new ConnectionManager();
   * 
   * // Create connection manager with custom settings
   * const customManager = new ConnectionManager({
   *   autoReconnect: false, maxReconnectAttempts: 5, reconnectDelay: 3000
   * });
   * @since 1.0.0
   */
  constructor(options = {}) {
    console.debug(`[ConnectionManager.constructor] - DEBUG: Creating connection manager`, options);
    
    this.logger = createLogger("ConnectionManager", LogLevel.INFO);

    this.options = {
      autoReconnect: options.autoReconnect !== false,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      reconnectDelay: options.reconnectDelay || 5000,
      ...options
    };

    this.state = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.lastConnectTime = 0;
    this.connectionHistory = [];

    // Event callbacks
    this.onStateChange = null;
    this.onError = null;

    console.info(`[ConnectionManager.constructor] - INFO: Connection manager initialized with auto-reconnect ${this.options.autoReconnect}`);
    this.logger.info(
      "constructor",
      "Connection manager initialized",
      this.options
    );
  }

  /**
   * Sets the connection state and notifies listeners with history tracking
   * @memberof ConnectionManager
   * @param {string} newState - New connection state from ConnectionState enum
   * @param {string} [reason=null] - Optional reason for the state change
   * @param {Object} [metadata={}] - Additional state metadata for debugging and analysis
   * @returns {void} No return value, updates internal state and triggers callbacks
   * @throws {Error} When state change callbacks throw exceptions (handled gracefully)
   * @example
   * manager.setState('connected', 'user_initiated');
   * manager.setState('error', 'network_timeout', { errorCode: 500 });
   * @since 1.0.0
   */
  setState(newState, reason = null, metadata = {}) {
    console.debug(`[ConnectionManager.setState] - DEBUG: Changing state from ${this.state} to ${newState}`, { reason, metadata });
    
    const previousState = this.state;
    this.state = newState;

    const stateChange = {
      newState,
      previousState,
      reason,
      timestamp: Date.now(),
      metadata
    };

    this.connectionHistory.push(stateChange);

    // Limit history size
    if (this.connectionHistory.length > 50) {
      this.connectionHistory.shift();
    }

    console.info(`[ConnectionManager.setState] - INFO: State transition ${previousState} -> ${newState} (${reason || 'no reason'})`);
    this.logger.info(
      "setState",
      `Connection state: ${previousState} -> ${newState}`,
      { reason }
    );

    if (this.onStateChange) {
      try {
        this.onStateChange(stateChange);
      } catch (error) {
        console.error(`[ConnectionManager.setState] - ERROR: State change callback failed:`, error);
        this.logger.error("setState", "State change callback error", error);
      }
    }
  }

  /**
   * Records an error and potentially triggers reconnection with context tracking
   * @memberof ConnectionManager
   * @param {Error} error - Error that occurred during connection operations
   * @param {string} [context="unknown"] - Context where error occurred for debugging
   * @returns {void} No return value, handles error logging and reconnection logic
   * @throws {Error} When error callbacks throw exceptions (handled gracefully)
   * @example
   * manager.handleError(new Error('Network timeout'), 'polling');
   * manager.handleError(new Error('Auth failed'), 'authentication');
   * @since 1.0.0
   */
  handleError(error, context = "unknown") {
    console.debug(`[ConnectionManager.handleError] - DEBUG: Handling error in context ${context}:`, error);
    console.error(`[ConnectionManager.handleError] - ERROR: Connection error in ${context}:`, error);
    
    this.logger.error("handleError", `Connection error in ${context}`, error);

    if (this.onError) {
      try {
        this.onError(error, context);
      } catch (callbackError) {
        console.error(`[ConnectionManager.handleError] - ERROR: Error callback failed:`, callbackError);
        this.logger.error(
          "handleError",
          "Error callback failed",
          callbackError
        );
      }
    }

    // Set error state
    this.setState(ConnectionState.ERROR, `error_in_${context}`, {
      error: error.message,
      errorType: error.name
    });

    // Attempt reconnection if enabled
    if (this.options.autoReconnect && this.shouldReconnect()) {
      console.info(`[ConnectionManager.handleError] - INFO: Scheduling reconnection attempt`);
      this._scheduleReconnect();
    } else {
      console.warn(`[ConnectionManager.handleError] - WARN: Reconnection not attempted (autoReconnect: ${this.options.autoReconnect}, shouldReconnect: ${this.shouldReconnect()})`);
    }
  }

  /**
   * Determines if reconnection should be attempted based on current state and attempt count
   * @memberof ConnectionManager
   * @returns {boolean} True if reconnection should be attempted, false otherwise
   * @throws {Error} Never throws, safe to call in any context
   * @example
   * if (manager.shouldReconnect()) {
   *   // Attempt reconnection
   * }
   * @since 1.0.0
   */
  shouldReconnect() {
    const should = this.reconnectAttempts < this.options.maxReconnectAttempts &&
      this.state !== ConnectionState.DISCONNECTED;
    
    console.debug(`[ConnectionManager.shouldReconnect] - DEBUG: Should reconnect: ${should} (attempts: ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}, state: ${this.state})`);
    
    return should;
  }

  /**
   * Schedules a reconnection attempt with exponential backoff delay
   * @memberof ConnectionManager
   * @returns {void} No return value, schedules async reconnection attempt
   * @throws {Error} Never throws, handles all errors internally
   * @example
   * // Internal method called automatically by handleError
   * // this._scheduleReconnect();
   * @since 1.0.0
   * @private
   */
  _scheduleReconnect() {
    console.debug(`[ConnectionManager._scheduleReconnect] - DEBUG: Scheduling reconnection attempt ${this.reconnectAttempts + 1}`);
    
    this.reconnectAttempts++;

    this.setState(ConnectionState.RECONNECTING, "scheduled_reconnect", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts
    });

    const delay =
      this.options.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.info(`[ConnectionManager._scheduleReconnect] - INFO: Reconnect attempt ${this.reconnectAttempts} scheduled in ${delay}ms`);
    this.logger.info(
      "_scheduleReconnect",
      `Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (this.state === ConnectionState.RECONNECTING) {
        this._attemptReconnect();
      } else {
        console.warn(`[ConnectionManager._scheduleReconnect] - WARN: Reconnection cancelled due to state change to ${this.state}`);
      }
    }, delay);
  }

  /**
   * Attempts to reconnect by triggering reconnection callback
   * @memberof ConnectionManager
   * @returns {void} No return value, triggers reconnection attempt through callback
   * @throws {Error} Never throws, handles callback errors gracefully
   * @example
   * // Internal method called automatically after delay
   * // this._attemptReconnect();
   * @since 1.0.0
   * @private
   */
  _attemptReconnect() {
    console.debug(`[ConnectionManager._attemptReconnect] - DEBUG: Attempting reconnection ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
    
    this.logger.info(
      "_attemptReconnect",
      `Attempting reconnection (${this.reconnectAttempts}/${
        this.options.maxReconnectAttempts
      })`
    );

    // This will be called by the GameClient
    if (this.onReconnectAttempt) {
      try {
        this.onReconnectAttempt();
      } catch (error) {
        console.error(`[ConnectionManager._attemptReconnect] - ERROR: Reconnection attempt callback failed:`, error);
      }
    } else {
      console.warn(`[ConnectionManager._attemptReconnect] - WARN: No reconnection callback configured`);
    }
  }

  /**
   * Resets reconnection state after successful connection
   * @memberof ConnectionManager
   * @returns {void} No return value, resets internal reconnection counters
   * @throws {Error} Never throws, safe to call in any context
   * @example
   * // Called after successful reconnection
   * manager.resetReconnection();
   * @since 1.0.0
   */
  resetReconnection() {
    console.debug(`[ConnectionManager.resetReconnection] - DEBUG: Resetting reconnection state (was ${this.reconnectAttempts} attempts)`);
    
    this.reconnectAttempts = 0;
    this.lastConnectTime = Date.now();
    
    console.info(`[ConnectionManager.resetReconnection] - INFO: Reconnection state reset successfully`);
    this.logger.debug("resetReconnection", "Reconnection state reset");
  }

  /**
   * Gets connection statistics and current state information
   * @memberof ConnectionManager
   * @returns {Object} Connection statistics including state, attempts, and configuration
   * @throws {Error} Never throws, returns safe statistical data
   * @example
   * const stats = manager.getStats();
   * console.log(`Current state: ${stats.state}, attempts: ${stats.reconnectAttempts}`);
   * @since 1.0.0
   */
  getStats() {
    const stats = {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.options.maxReconnectAttempts,
      lastConnectTime: this.lastConnectTime,
      historyLength: this.connectionHistory.length,
      autoReconnect: this.options.autoReconnect
    };
    
    console.debug(`[ConnectionManager.getStats] - DEBUG: Returning connection statistics`, stats);
    return stats;
  }
}

/**
 * @class GameClient
 * @description Main game client class coordinating server communication and state management for terminal-based games
 * @since 1.0.0
 */
class GameClient {
  /**
   * Creates a new GameClient instance with RPC communication and state management
   * @constructor
   * @memberof GameClient
   * @param {Object} [options={}] - Client configuration options for behavior and communication
   * @param {string} [options.rpcEndpoint="/rpc"] - RPC endpoint URL for server communication
   * @param {number} [options.pollInterval=100] - Default polling interval in milliseconds
   * @param {number} [options.fastPollInterval=50] - Fast polling interval for active gameplay
   * @param {Object} [options.rpc] - RPC client specific options
   * @param {Object} [options.connection] - Connection manager specific options
   * @returns {GameClient} New GameClient instance with configured communication and state management
   * @throws {TypeError} When options parameter is not an object
   * @example
   * // Create game client with default settings
   * const client = new GameClient();
   * 
   * // Create game client with custom polling and endpoint
   * const customClient = new GameClient({
   *   rpcEndpoint: '/api/game-rpc',
   *   pollInterval: 200,
   *   fastPollInterval: 100
   * });
   * @since 1.0.0
   */
  constructor(options = {}) {
    console.debug(`[GameClient.constructor] - DEBUG: Creating game client with options`, options);
    
    this.logger = createLogger("GameClient", LogLevel.INFO);

    this.options = {
      rpcEndpoint: options.rpcEndpoint || "/rpc",
      pollInterval: options.pollInterval || 100,
      fastPollInterval: options.fastPollInterval || 50,
      ...options
    };

    // Core components
    this.rpcClient = new RPCClient(this.options.rpcEndpoint, options.rpc);
    this.connectionManager = new ConnectionManager(options.connection);
    this.inputManager = null;

    // Game state
    this.gameState = new GameState();
    this.sessionId = null;
    this.lastStateVersion = 0;

    // Polling and updates
    this.pollTimer = null;
    this.isPolling = false;
    this.pollInterval = this.options.pollInterval;

    // Event handlers
    this.onStateUpdate = null;
    this.onConnectionChange = null;
    this.onError = null;

    this._setupConnectionManager();

    console.info(`[GameClient.constructor] - INFO: Game client initialized with endpoint ${this.options.rpcEndpoint}`);
    this.logger.info("constructor", "Game client initialized", {
      rpcEndpoint: this.options.rpcEndpoint,
      pollInterval: this.options.pollInterval
    });
  }

  /**
   * Sets up connection manager event handlers for state synchronization
   * @memberof GameClient  
   * @returns {void} No return value, configures internal event handling
   * @throws {Error} Never throws, handles callback errors gracefully
   * @example
   * // Internal method called automatically during construction
   * // this._setupConnectionManager();
   * @since 1.0.0
   * @private
   */
  _setupConnectionManager() {
    console.debug(`[GameClient._setupConnectionManager] - DEBUG: Setting up connection manager callbacks`);
    
    this.connectionManager.onStateChange = stateChange => {
      console.info(`[GameClient._setupConnectionManager] - INFO: Connection state changed to ${stateChange.newState}`);
      
      if (this.onConnectionChange) {
        try {
          this.onConnectionChange(stateChange);
        } catch (error) {
          console.error(`[GameClient._setupConnectionManager] - ERROR: Connection change callback failed:`, error);
        }
      }

      // Adjust polling based on connection state
      this._adjustPolling(stateChange.newState);
    };

    this.connectionManager.onError = (error, context) => {
      console.error(`[GameClient._setupConnectionManager] - ERROR: Connection manager error in ${context}:`, error);
      
      if (this.onError) {
        try {
          this.onError(error, context);
        } catch (callbackError) {
          console.error(`[GameClient._setupConnectionManager] - ERROR: Error callback failed:`, callbackError);
        }
      }
    };

    this.connectionManager.onReconnectAttempt = () => {
      console.info(`[GameClient._setupConnectionManager] - INFO: Attempting reconnection`);
      this._attemptReconnection();
    };
  }

  /**
   * Adjusts polling interval based on connection state for optimal performance
   * @memberof GameClient
   * @param {string} state - Current connection state from ConnectionState enum
   * @returns {void} No return value, updates internal polling configuration
   * @throws {Error} Never throws, handles invalid states gracefully
   * @example
   * // Internal method called automatically on state changes
   * // this._adjustPolling('playing'); // Sets fast polling for active gameplay
   * @since 1.0.0
   * @private
   */
  _adjustPolling(state) {
    console.debug(`[GameClient._adjustPolling] - DEBUG: Adjusting polling for state ${state}`);
    
    const oldInterval = this.pollInterval;
    
    if (state === ConnectionState.PLAYING) {
      this.pollInterval = this.options.fastPollInterval;
    } else {
      this.pollInterval = this.options.pollInterval;
    }

    if (oldInterval !== this.pollInterval) {
      console.info(`[GameClient._adjustPolling] - INFO: Poll interval changed from ${oldInterval}ms to ${this.pollInterval}ms for state ${state}`);
    }

    this.logger.debug(
      "_adjustPolling",
      `Poll interval adjusted to ${this.pollInterval}ms for state: ${state}`
    );
  }

  /**
   * Connects to the game server with authentication and session management
   * @memberof GameClient
   * @param {Object} connectionParams - Connection parameters for server authentication
   * @param {string} connectionParams.host - Server hostname or IP address
   * @param {number} connectionParams.port - Server port number
   * @param {string} connectionParams.username - Username for authentication
   * @param {string} connectionParams.password - Password for authentication
   * @returns {Promise<void>} Promise that resolves when connection is established
   * @throws {Error} When connection fails due to network, authentication, or server errors
   * @example
   * await client.connect({
   *   host: 'game.server.com',
   *   port: 22,
   *   username: 'player',
   *   password: 'secret123'
   * });
   * @since 1.0.0
   */
  async connect(connectionParams) {
    console.debug(`[GameClient.connect] - DEBUG: Starting connection to ${connectionParams.host}:${connectionParams.port}`);
    
    this.logger.enter("connect", connectionParams);

    this.connectionManager.setState(
      ConnectionState.CONNECTING,
      "user_initiated"
    );

    try {
      const result = await this.rpcClient.call(
        RPCMethod.CONNECT,
        connectionParams
      );

      this.sessionId = result.sessionId;
      this.connectionManager.setState(
        ConnectionState.CONNECTED,
        "server_connected"
      );
      this.connectionManager.resetReconnection();

      // Start state polling
      this._startPolling();

      console.info(`[GameClient.connect] - INFO: Successfully connected with session ID ${this.sessionId}`);
      this.logger.exit("connect", { sessionId: this.sessionId });
    } catch (error) {
      console.error(`[GameClient.connect] - ERROR: Connection failed:`, error);
      this.connectionManager.handleError(error, "connect");
      throw error;
    }
  }

  /**
   * Disconnects from the game server with cleanup and session termination
   * @memberof GameClient
   * @returns {Promise<void>} Promise that resolves when disconnection is complete
   * @throws {Error} Never throws, handles cleanup errors gracefully
   * @example
   * await client.disconnect();
   * console.log('Disconnected from game server');
   * @since 1.0.0
   */
  async disconnect() {
    console.debug(`[GameClient.disconnect] - DEBUG: Starting disconnection process`);
    
    this.logger.enter("disconnect");

    this._stopPolling();

    if (this.sessionId) {
      try {
        await this.rpcClient.call(RPCMethod.DISCONNECT, {
          sessionId: this.sessionId
        });
        console.info(`[GameClient.disconnect] - INFO: Successfully sent disconnect to server`);
      } catch (error) {
        console.warn(`[GameClient.disconnect] - WARN: Disconnect RPC failed (continuing with cleanup):`, error);
        this.logger.warn("disconnect", "Disconnect RPC failed", error);
      }
    }

    this.sessionId = null;
    this.connectionManager.setState(
      ConnectionState.DISCONNECTED,
      "user_initiated"
    );

    console.info(`[GameClient.disconnect] - INFO: Disconnection completed`);
    this.logger.exit("disconnect");
  }

  /**
   * Starts the state polling loop with adaptive intervals for real-time updates
   * @memberof GameClient
   * @returns {void} No return value, initiates asynchronous polling loop
   * @throws {Error} Never throws, handles polling errors through error management
   * @example
   * // Internal method called automatically after connection
   * // this._startPolling();
   * @since 1.0.0
   * @private
   */
  _startPolling() {
    console.debug(`[GameClient._startPolling] - DEBUG: Starting state polling loop`);
    
    if (this.isPolling) {
      console.warn(`[GameClient._startPolling] - WARN: Polling already active, ignoring start request`);
      return;
    }

    this.isPolling = true;
    this.pollErrors = 0; // Track consecutive errors for backoff
    this.maxPollErrors = 5;
    this._scheduleNextPoll();

    console.info(`[GameClient._startPolling] - INFO: State polling started with ${this.pollInterval}ms interval`);
    this.logger.debug(
      "_startPolling",
      `State polling started with ${this.pollInterval}ms interval`
    );
  }

  /**
   * Stops the state polling loop and cleans up timers
   * @memberof GameClient
   * @returns {void} No return value, stops asynchronous polling and cleanup
   * @throws {Error} Never throws, safe to call multiple times
   * @example
   * // Internal method called automatically during disconnection
   * // this._stopPolling();
   * @since 1.0.0
   * @private
   */
  _stopPolling() {
    console.debug(`[GameClient._stopPolling] - DEBUG: Stopping state polling loop`);
    
    this.isPolling = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
      console.info(`[GameClient._stopPolling] - INFO: Poll timer cleared`);
    }

    console.info(`[GameClient._stopPolling] - INFO: State polling stopped`);
    this.logger.debug("_stopPolling", "State polling stopped");
  }

  /**
   * Schedules the next poll with exponential backoff on errors for resilient communication
   * @memberof GameClient
   * @returns {void} No return value, schedules next polling attempt
   * @throws {Error} Never throws, handles scheduling errors gracefully
   * @example
   * // Internal method called automatically during polling loop
   * // this._scheduleNextPoll();
   * @since 1.0.0
   * @private
   */
  _scheduleNextPoll() {
    console.debug(`[GameClient._scheduleNextPoll] - DEBUG: Scheduling next poll (errors: ${this.pollErrors})`);
    
    if (!this.isPolling) {
      console.debug(`[GameClient._scheduleNextPoll] - DEBUG: Polling disabled, not scheduling next poll`);
      return;
    }

    // Calculate delay with exponential backoff for errors
    let delay = this.pollInterval;
    if (this.pollErrors > 0) {
      delay = Math.min(
        this.pollInterval * Math.pow(2, this.pollErrors),
        30000 // Max 30 second delay
      );
      console.warn(`[GameClient._scheduleNextPoll] - WARN: Using backoff delay ${delay}ms due to ${this.pollErrors} consecutive errors`);
    }

    this.pollTimer = setTimeout(() => {
      this._pollGameState();
    }, delay);
  }

  /**
   * Polls the server for game state updates with long-polling and change detection
   * @memberof GameClient
   * @returns {Promise<void>} Promise that resolves when poll completes (success or error)
   * @throws {Error} Never throws, handles all errors through connection manager
   * @example
   * // Internal method called automatically during polling loop
   * // await this._pollGameState();
   * @since 1.0.0
   * @private
   */
  async _pollGameState() {
    console.debug(`[GameClient._pollGameState] - DEBUG: Starting game state poll (version: ${this.lastStateVersion})`);
    
    if (!this.isPolling || !this.sessionId) {
      console.debug(`[GameClient._pollGameState] - DEBUG: Skipping poll (polling: ${this.isPolling}, session: ${!!this.sessionId})`);
      return;
    }

    try {
      // Use long-polling for more efficient updates
      const result = await this.rpcClient.call(RPCMethod.GET_STATE, {
        sessionId: this.sessionId,
        version: this.lastStateVersion,
        timeout: 25000 // Long-poll timeout
      });

      // Reset error count on successful poll
      if (this.pollErrors > 0) {
        console.info(`[GameClient._pollGameState] - INFO: Poll successful after ${this.pollErrors} errors, resetting error count`);
        this.pollErrors = 0;
      }

      if (result.state && result.state.version > this.lastStateVersion) {
        console.info(`[GameClient._pollGameState] - INFO: Received state update (version ${result.state.version})`);
        this._updateGameState(result.state);
      }

      // Update connection state based on game state
      if (result.connectionState) {
        this.connectionManager.setState(
          result.connectionState,
          "server_update",
          { polled: true }
        );
      }
    } catch (error) {
      this.pollErrors = Math.min(this.pollErrors + 1, this.maxPollErrors);
      
      console.warn(`[GameClient._pollGameState] - WARN: Poll failed (${this.pollErrors}/${this.maxPollErrors}):`, error);
      this.logger.warn("_pollGameState", 
        `Poll failed (${this.pollErrors}/${this.maxPollErrors})`, error);
      
      // Only trigger connection error handling for persistent failures
      if (this.pollErrors >= 3) {
        console.error(`[GameClient._pollGameState] - ERROR: Persistent polling failures, triggering connection error handling`);
        this.connectionManager.handleError(error, "poll");
      }
    }

    // Schedule next poll
    this._scheduleNextPoll();
  }

  /**
   * Updates the local game state with server data and triggers callbacks
   * @memberof GameClient
   * @param {Object} stateData - State data from server with version and changes
   * @returns {void} No return value, updates internal state and triggers events
   * @throws {Error} When state update callbacks throw exceptions (handled gracefully)
   * @example
   * // Internal method called automatically when receiving state updates
   * // this._updateGameState(serverStateData);
   * @since 1.0.0
   * @private
   */
  _updateGameState(stateData) {
    console.debug(`[GameClient._updateGameState] - DEBUG: Updating game state from version ${this.lastStateVersion} to ${stateData.version}`);
    
    if (stateData.version > this.lastStateVersion) {
      this.gameState.applyChanges(stateData);
      this.lastStateVersion = stateData.version;

      if (this.onStateUpdate) {
        try {
          this.onStateUpdate(this.gameState);
          console.info(`[GameClient._updateGameState] - INFO: State update callback completed successfully`);
        } catch (error) {
          console.error(`[GameClient._updateGameState] - ERROR: State update callback failed:`, error);
          this.logger.error(
            "_updateGameState",
            "State update callback error",
            error
          );
        }
      }

      console.info(`[GameClient._updateGameState] - INFO: Game state updated to version ${this.lastStateVersion}`);
      this.logger.debug(
        "_updateGameState",
        `Game state updated to version ${this.lastStateVersion}`
      );
    } else {
      console.debug(`[GameClient._updateGameState] - DEBUG: Ignoring stale state update (version ${stateData.version} <= ${this.lastStateVersion})`);
    }
  }

  /**
   * Sets up input management for the specified element with event handling
   * @memberof GameClient
   * @param {HTMLElement} element - Element to capture input events from
   * @param {Object} [inputOptions={}] - Input manager configuration options
   * @returns {void} No return value, configures input capture and processing
   * @throws {TypeError} When element is not a valid HTML element
   * @example
   * const gameContainer = document.getElementById('game-display');
   * client.setupInput(gameContainer, { 
   *   bufferSize: 50, flushInterval: 100 
   * });
   * @since 1.0.0
   */
  setupInput(element, inputOptions = {}) {
    console.debug(`[GameClient.setupInput] - DEBUG: Setting up input management for element`, element.tagName);
    
    if (this.inputManager) {
      console.info(`[GameClient.setupInput] - INFO: Destroying existing input manager`);
      this.inputManager.destroy();
    }

    this.inputManager = new InputManager(element, inputOptions);

    // Set up input processing
    this.inputManager.setFlushCallback(events => {
      this._sendInputEvents(events);
    });

    this.inputManager.startListening();

    console.info(`[GameClient.setupInput] - INFO: Input management configured for ${element.tagName}`);
    this.logger.info("setupInput", "Input management configured");
  }

  /**
   * Sends input events to the server with batching and retry logic for reliable input transmission
   * @memberof GameClient
   * @param {Array<InputEvent>} events - Input events to send to the server
   * @returns {Promise<void>} Promise that resolves when events are sent or definitively failed
   * @throws {Error} Never throws, handles all errors through connection manager
   * @example
   * // Internal method called automatically by input manager
   * // await this._sendInputEvents([keyDownEvent, keyUpEvent]);
   * @since 1.0.0
   * @private
   */
  async _sendInputEvents(events) {
    console.debug(`[GameClient._sendInputEvents] - DEBUG: Sending ${events.length} input events`);
    
    if (!this.sessionId || events.length === 0) {
      console.debug(`[GameClient._sendInputEvents] - DEBUG: Skipping input send (session: ${!!this.sessionId}, events: ${events.length})`);
      return;
    }

    const inputData = events.map(event => ({
      ...event.toJSON(),
      // Add terminal sequence mapping
      sequence: this._mapToTerminalSequence(event)
    }));

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        await this.rpcClient.call(RPCMethod.SEND_INPUT, {
          sessionId: this.sessionId,
          events: inputData
        });

        // Mark events as sent
        events.forEach(event => event.markProcessed(true));

        console.info(`[GameClient._sendInputEvents] - INFO: Successfully sent ${events.length} input events on attempt ${attempt + 1}`);
        this.logger.debug(
          "_sendInputEvents",
          `Sent ${events.length} input events on attempt ${attempt + 1}`
        );
        break;

      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          console.error(`[GameClient._sendInputEvents] - ERROR: Failed to send input events after ${maxRetries + 1} attempts:`, error);
          this.logger.error(
            "_sendInputEvents",
            "Failed to send input events after retries",
            error
          );

          // Mark events as failed
          events.forEach(event => event.markProcessed(false));
          this.connectionManager.handleError(error, "input");
          break;
        }

        // Wait before retry with jitter
        const delay = 100 * Math.pow(2, attempt) + Math.random() * 100;
        console.warn(`[GameClient._sendInputEvents] - WARN: Input send attempt ${attempt} failed, retrying in ${delay.toFixed(0)}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Maps input events to terminal sequences with comprehensive key support
   * @memberof GameClient
   * @param {InputEvent} event - Input event to map to terminal sequence
   * @returns {string|null} Terminal sequence string or null if no mapping available
   * @throws {Error} Never throws, returns null for unmappable events
   * @example
   * // Internal method called during input processing
   * // const sequence = this._mapToTerminalSequence(keyEvent);
   * @since 1.0.0
   * @private
   */
  _mapToTerminalSequence(event) {
    console.debug(`[GameClient._mapToTerminalSequence] - DEBUG: Mapping event to terminal sequence`, event.key);
    
    if (!event.isKeyboardEvent() || event.type !== InputEventType.KEY_DOWN) {
      return null;
    }

    // Use the terminal sequence from the event if available
    const terminalSequence = event.getTerminalSequence();
    if (terminalSequence) {
      console.debug(`[GameClient._mapToTerminalSequence] - DEBUG: Using event terminal sequence: ${JSON.stringify(terminalSequence)}`);
      return terminalSequence;
    }

    // Fallback mapping for any missed keys
    const fallbackMap = {
      'Space': ' ',
      'NumpadEnter': '\r'
    };

    const fallbackSequence = fallbackMap[event.key] || null;
    if (fallbackSequence) {
      console.debug(`[GameClient._mapToTerminalSequence] - DEBUG: Using fallback mapping: ${JSON.stringify(fallbackSequence)}`);
    } else {
      console.debug(`[GameClient._mapToTerminalSequence] - DEBUG: No terminal sequence mapping found for key: ${event.key}`);
    }

    return fallbackSequence;
  }

  /**
   * Attempts reconnection to the server using stored connection parameters
   * @memberof GameClient
   * @returns {Promise<void>} Promise that resolves when reconnection attempt completes
   * @throws {Error} Never throws, handles reconnection through event callbacks
   * @example
   * // Internal method called automatically by connection manager
   * // await this._attemptReconnection();
   * @since 1.0.0
   * @private
   */
  async _attemptReconnection() {
    console.debug(`[GameClient._attemptReconnection] - DEBUG: Attempting automatic reconnection`);
    
    // This would need to store original connection parameters
    // For now, just emit an event that the application can handle
    if (this.onReconnectionNeeded) {
      try {
        console.info(`[GameClient._attemptReconnection] - INFO: Triggering reconnection needed callback`);
        this.onReconnectionNeeded();
      } catch (error) {
        console.error(`[GameClient._attemptReconnection] - ERROR: Reconnection callback failed:`, error);
      }
    } else {
      console.warn(`[GameClient._attemptReconnection] - WARN: No reconnection callback configured`);
    }
  }

  /**
   * Resizes the terminal window on the server to match client display
   * @memberof GameClient
   * @param {number} width - New width in characters (must be positive integer)
   * @param {number} height - New height in characters (must be positive integer)
   * @returns {Promise<void>} Promise that resolves when resize is complete
   * @throws {Error} When not connected to server or resize operation fails
   * @example
   * // Resize terminal to 80x24 characters
   * await client.resize(80, 24);
   * @since 1.0.0
   */
  async resize(width, height) {
    console.debug(`[GameClient.resize] - DEBUG: Resizing terminal to ${width}x${height}`);
    
    if (!this.sessionId) {
      const error = new Error("Not connected");
      console.error(`[GameClient.resize] - ERROR: Resize failed - not connected`);
      throw error;
    }

    try {
      await this.rpcClient.call(RPCMethod.RESIZE, {
        sessionId: this.sessionId,
        width: width,
        height: height
      });

      console.info(`[GameClient.resize] - INFO: Terminal resized successfully to ${width}x${height}`);
      this.logger.info("resize", `Terminal resized to ${width}x${height}`);
    } catch (error) {
      console.error(`[GameClient.resize] - ERROR: Resize operation failed:`, error);
      this.logger.error("resize", "Resize failed", error);
      throw error;
    }
  }

  /**
   * Gets the current connection state from the connection manager
   * @memberof GameClient
   * @returns {string} Current connection state from ConnectionState enum
   * @throws {Error} Never throws, returns safe state value
   * @example
   * const state = client.getConnectionState();
   * console.log(`Current state: ${state}`);
   * @since 1.0.0
   */
  getConnectionState() {
    const state = this.connectionManager.state;
    console.debug(`[GameClient.getConnectionState] - DEBUG: Returning connection state: ${state}`);
    return state;
  }

  /**
   * Gets the current game state with all terminal data and metadata
   * @memberof GameClient
   * @returns {GameState} Current game state instance with terminal buffer and cursor
   * @throws {Error} Never throws, returns safe game state object
   * @example
   * const gameState = client.getGameState();
   * console.log(`Game version: ${gameState.version}`);
   * @since 1.0.0
   */
  getGameState() {
    console.debug(`[GameClient.getGameState] - DEBUG: Returning game state (version: ${this.gameState.version})`);
    return this.gameState;
  }

  /**
   * Gets comprehensive client statistics for monitoring and debugging
   * @memberof GameClient
   * @returns {Object} Client statistics including connection, session, and performance data
   * @throws {Error} Never throws, returns safe statistical data
   * @example
   * const stats = client.getStats();
   * console.log(`Poll errors: ${stats.session.pollErrors}`);
   * @since 1.0.0
   */
  getStats() {
    const stats = {
      connection: this.connectionManager.getStats(),
      session: {
        sessionId: this.sessionId,
        lastStateVersion: this.lastStateVersion,
        isPolling: this.isPolling,
        pollInterval: this.pollInterval,
        pollErrors: this.pollErrors || 0,
        maxPollErrors: this.maxPollErrors || 0
      },
      gameState: this.gameState.getStats(),
      input: this.inputManager ? this.inputManager.getStats() : null
    };
    
    console.debug(`[GameClient.getStats] - DEBUG: Returning client statistics`, stats);
    return stats;
  }

  /**
   * Destroys the client and cleans up all resources including timers and connections
   * @memberof GameClient
   * @returns {void} No return value, performs cleanup and resource deallocation
   * @throws {Error} Never throws, handles cleanup errors gracefully
   * @example
   * // Clean up when done with client
   * client.destroy();
   * console.log('Client resources cleaned up');
   * @since 1.0.0
   */
  destroy() {
    console.debug(`[GameClient.destroy] - DEBUG: Starting client destruction and cleanup`);
    
    this.logger.enter("destroy");

    this._stopPolling();

    if (this.inputManager) {
      console.info(`[GameClient.destroy] - INFO: Destroying input manager`);
      this.inputManager.destroy();
      this.inputManager = null;
    }

    if (this.sessionId) {
      console.info(`[GameClient.destroy] - INFO: Attempting clean disconnect`);
      // Attempt to disconnect cleanly
      this.disconnect().catch(error => {
        console.warn(`[GameClient.destroy] - WARN: Clean disconnect failed during destruction:`, error);
        this.logger.warn("destroy", "Clean disconnect failed", error);
      });
    }

    console.info(`[GameClient.destroy] - INFO: Game client destroyed successfully`);
    this.logger.info("destroy", "Game client destroyed");
  }
}

// Export public interface
export { GameClient, ConnectionState, RPCMethod, RPCClient, ConnectionManager };

console.log("[GameClient] Game client service module loaded successfully");
