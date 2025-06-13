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
 * @description Handles JSON-RPC communication with the server
 */
class RPCClient {
  /**
   * Creates a new RPCClient instance
   * @param {string} endpoint - RPC endpoint URL
   * @param {Object} [options={}] - Client configuration options
   */
  constructor(endpoint, options = {}) {
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

    this.logger.info("constructor", `RPC client initialized: ${endpoint}`);
  }

  /**
   * Sends an RPC request to the server
   * @param {string} method - RPC method name
   * @param {Object} [params={}] - Method parameters
   * @returns {Promise<*>} Promise resolving to the result
   */
  async call(method, params = {}) {
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
        throw new Error(`RPC Error: ${response.error.message}`);
      }

      this.logger.debug("call", `RPC response: ${method}`, {
        id,
        result: response.result
      });
      return response.result;
    } catch (error) {
      this.logger.error("call", `RPC call failed: ${method}`, error);
      throw error;
    }
  }

  /**
   * Makes the actual HTTP request
   * @param {Object} request - JSON-RPC request object
   * @returns {Promise<Object>} Promise resolving to the response
   * @private
   */
  async _makeRequest(request) {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timeout");
      }

      throw error;
    }
  }
}

/**
 * @class ConnectionManager
 * @description Manages connection state and reconnection logic
 */
class ConnectionManager {
  /**
   * Creates a new ConnectionManager instance
   * @param {Object} [options={}] - Connection configuration options
   */
  constructor(options = {}) {
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

    this.logger.info(
      "constructor",
      "Connection manager initialized",
      this.options
    );
  }

  /**
   * Sets the connection state and notifies listeners
   * @param {string} newState - New connection state
   * @param {string} [reason] - Reason for state change
   * @param {Object} [metadata] - Additional state metadata
   */
  setState(newState, reason = null, metadata = {}) {
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

    this.logger.info(
      "setState",
      `Connection state: ${previousState} -> ${newState}`,
      { reason }
    );

    if (this.onStateChange) {
      try {
        this.onStateChange(stateChange);
      } catch (error) {
        this.logger.error("setState", "State change callback error", error);
      }
    }
  }

  /**
   * Records an error and potentially triggers reconnection
   * @param {Error} error - Error that occurred
   * @param {string} [context] - Context where error occurred
   */
  handleError(error, context = "unknown") {
    this.logger.error("handleError", `Connection error in ${context}`, error);

    if (this.onError) {
      try {
        this.onError(error, context);
      } catch (callbackError) {
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
      this._scheduleReconnect();
    }
  }

  /**
   * Determines if reconnection should be attempted
   * @returns {boolean} True if reconnection should be attempted
   */
  shouldReconnect() {
    return (
      this.reconnectAttempts < this.options.maxReconnectAttempts &&
      this.state !== ConnectionState.DISCONNECTED
    );
  }

  /**
   * Schedules a reconnection attempt
   * @private
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;

    this.setState(ConnectionState.RECONNECTING, "scheduled_reconnect", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts
    });

    const delay =
      this.options.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    this.logger.info(
      "_scheduleReconnect",
      `Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (this.state === ConnectionState.RECONNECTING) {
        this._attemptReconnect();
      }
    }, delay);
  }

  /**
   * Attempts to reconnect
   * @private
   */
  _attemptReconnect() {
    this.logger.info(
      "_attemptReconnect",
      `Attempting reconnection (${this.reconnectAttempts}/${
        this.options.maxReconnectAttempts
      })`
    );

    // This will be called by the GameClient
    if (this.onReconnectAttempt) {
      this.onReconnectAttempt();
    }
  }

  /**
   * Resets reconnection state after successful connection
   */
  resetReconnection() {
    this.reconnectAttempts = 0;
    this.lastConnectTime = Date.now();
    this.logger.debug("resetReconnection", "Reconnection state reset");
  }

  /**
   * Gets connection statistics
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.options.maxReconnectAttempts,
      lastConnectTime: this.lastConnectTime,
      historyLength: this.connectionHistory.length,
      autoReconnect: this.options.autoReconnect
    };
  }
}

/**
 * @class GameClient
 * @description Main game client class coordinating server communication and state management
 */
class GameClient {
  /**
   * Creates a new GameClient instance
   * @param {Object} [options={}] - Client configuration options
   */
  constructor(options = {}) {
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

    this.logger.info("constructor", "Game client initialized", {
      rpcEndpoint: this.options.rpcEndpoint,
      pollInterval: this.options.pollInterval
    });
  }

  /**
   * Sets up connection manager event handlers
   * @private
   */
  _setupConnectionManager() {
    this.connectionManager.onStateChange = stateChange => {
      if (this.onConnectionChange) {
        this.onConnectionChange(stateChange);
      }

      // Adjust polling based on connection state
      this._adjustPolling(stateChange.newState);
    };

    this.connectionManager.onError = (error, context) => {
      if (this.onError) {
        this.onError(error, context);
      }
    };

    this.connectionManager.onReconnectAttempt = () => {
      this._attemptReconnection();
    };
  }

  /**
   * Adjusts polling interval based on connection state
   * @param {string} state - Current connection state
   * @private
   */
  _adjustPolling(state) {
    if (state === ConnectionState.PLAYING) {
      this.pollInterval = this.options.fastPollInterval;
    } else {
      this.pollInterval = this.options.pollInterval;
    }

    this.logger.debug(
      "_adjustPolling",
      `Poll interval adjusted to ${this.pollInterval}ms for state: ${state}`
    );
  }

  /**
   * Connects to the game server
   * @param {Object} connectionParams - Connection parameters
   * @param {string} connectionParams.host - Server hostname
   * @param {number} connectionParams.port - Server port
   * @param {string} connectionParams.username - Username
   * @param {string} connectionParams.password - Password
   * @returns {Promise<void>} Promise that resolves when connected
   */
  async connect(connectionParams) {
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

      this.logger.exit("connect", { sessionId: this.sessionId });
    } catch (error) {
      this.connectionManager.handleError(error, "connect");
      throw error;
    }
  }

  /**
   * Disconnects from the game server
   * @returns {Promise<void>} Promise that resolves when disconnected
   */
  async disconnect() {
    this.logger.enter("disconnect");

    this._stopPolling();

    if (this.sessionId) {
      try {
        await this.rpcClient.call(RPCMethod.DISCONNECT, {
          sessionId: this.sessionId
        });
      } catch (error) {
        this.logger.warn("disconnect", "Disconnect RPC failed", error);
      }
    }

    this.sessionId = null;
    this.connectionManager.setState(
      ConnectionState.DISCONNECTED,
      "user_initiated"
    );

    this.logger.exit("disconnect");
  }

  /**
   * Starts the state polling loop
   * @private
   */
  _startPolling() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this._scheduleNextPoll();

    this.logger.debug(
      "_startPolling",
      `State polling started with ${this.pollInterval}ms interval`
    );
  }

  /**
   * Stops the state polling loop
   * @private
   */
  _stopPolling() {
    this.isPolling = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.logger.debug("_stopPolling", "State polling stopped");
  }

  /**
   * Schedules the next poll
   * @private
   */
  _scheduleNextPoll() {
    if (!this.isPolling) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      this._pollGameState();
    }, this.pollInterval);
  }

  /**
   * Polls the server for game state updates
   * @private
   */
  async _pollGameState() {
    if (!this.isPolling || !this.sessionId) {
      return;
    }

    try {
      const result = await this.rpcClient.call(RPCMethod.GET_STATE, {
        sessionId: this.sessionId,
        version: this.lastStateVersion
      });

      if (result.state) {
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
      this.connectionManager.handleError(error, "poll");
    }

    // Schedule next poll
    this._scheduleNextPoll();
  }

  /**
   * Updates the local game state
   * @param {Object} stateData - State data from server
   * @private
   */
  _updateGameState(stateData) {
    if (stateData.version > this.lastStateVersion) {
      this.gameState.applyChanges(stateData);
      this.lastStateVersion = stateData.version;

      if (this.onStateUpdate) {
        try {
          this.onStateUpdate(this.gameState);
        } catch (error) {
          this.logger.error(
            "_updateGameState",
            "State update callback error",
            error
          );
        }
      }

      this.logger.debug(
        "_updateGameState",
        `Game state updated to version ${this.lastStateVersion}`
      );
    }
  }

  /**
   * Sets up input management for the specified element
   * @param {HTMLElement} element - Element to capture input from
   * @param {Object} [inputOptions={}] - Input manager options
   */
  setupInput(element, inputOptions = {}) {
    if (this.inputManager) {
      this.inputManager.destroy();
    }

    this.inputManager = new InputManager(element, inputOptions);

    // Set up input processing
    this.inputManager.setFlushCallback(events => {
      this._sendInputEvents(events);
    });

    this.inputManager.startListening();

    this.logger.info("setupInput", "Input management configured");
  }

  /**
   * Sends input events to the server
   * @param {Array<InputEvent>} events - Input events to send
   * @private
   */
  async _sendInputEvents(events) {
    if (!this.sessionId || events.length === 0) {
      return;
    }

    try {
      const inputData = events.map(event => event.toJSON());

      await this.rpcClient.call(RPCMethod.SEND_INPUT, {
        sessionId: this.sessionId,
        events: inputData
      });

      // Mark events as sent
      events.forEach(event => event.markProcessed(true));

      this.logger.debug(
        "_sendInputEvents",
        `Sent ${events.length} input events`
      );
    } catch (error) {
      this.logger.error(
        "_sendInputEvents",
        "Failed to send input events",
        error
      );

      // Mark events as failed
      events.forEach(event => event.markProcessed(false));

      this.connectionManager.handleError(error, "input");
    }
  }

  /**
   * Attempts reconnection to the server
   * @private
   */
  async _attemptReconnection() {
    // This would need to store original connection parameters
    // For now, just emit an event that the application can handle
    if (this.onReconnectionNeeded) {
      this.onReconnectionNeeded();
    }
  }

  /**
   * Resizes the terminal
   * @param {number} width - New width in characters
   * @param {number} height - New height in characters
   * @returns {Promise<void>} Promise that resolves when resize is complete
   */
  async resize(width, height) {
    if (!this.sessionId) {
      throw new Error("Not connected");
    }

    try {
      await this.rpcClient.call(RPCMethod.RESIZE, {
        sessionId: this.sessionId,
        width: width,
        height: height
      });

      this.logger.info("resize", `Terminal resized to ${width}x${height}`);
    } catch (error) {
      this.logger.error("resize", "Resize failed", error);
      throw error;
    }
  }

  /**
   * Gets the current connection state
   * @returns {string} Current connection state
   */
  getConnectionState() {
    return this.connectionManager.state;
  }

  /**
   * Gets the current game state
   * @returns {GameState} Current game state
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Gets comprehensive client statistics
   * @returns {Object} Client statistics
   */
  getStats() {
    return {
      connection: this.connectionManager.getStats(),
      session: {
        sessionId: this.sessionId,
        lastStateVersion: this.lastStateVersion,
        isPolling: this.isPolling,
        pollInterval: this.pollInterval
      },
      gameState: this.gameState.getStats(),
      input: this.inputManager ? this.inputManager.getStats() : null
    };
  }

  /**
   * Destroys the client and cleans up resources
   */
  destroy() {
    this.logger.enter("destroy");

    this._stopPolling();

    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }

    if (this.sessionId) {
      // Attempt to disconnect cleanly
      this.disconnect().catch(error => {
        this.logger.warn("destroy", "Clean disconnect failed", error);
      });
    }

    this.logger.info("destroy", "Game client destroyed");
  }
}

// Export public interface
export { GameClient, ConnectionState, RPCMethod, RPCClient, ConnectionManager };

console.log("[GameClient] Game client service module loaded successfully");
