/**
 * @fileoverview JSON-RPC 2.0 client implementation for communicating with the game server
 * @module api/rpc-client
 * @requires utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";

/**
 * @class RPCError
 * @extends Error
 * @description Custom error class for RPC-specific errors with enhanced context
 */
class RPCError extends Error {
  /**
   * Creates a new RPCError instance
   * @param {number} code - RPC error code
   * @param {string} message - Error message
   * @param {*} [data] - Additional error data
   * @param {string} [method] - RPC method that caused the error
   */
  constructor(code, message, data = null, method = null) {
    super(`RPC Error ${code}: ${message}`);
    this.name = "RPCError";
    this.code = code;
    this.rpcMessage = message;
    this.data = data;
    this.method = method;
    this.timestamp = Date.now();
  }

  /**
   * Converts the error to a JSON-serializable object
   * @returns {Object} Error details for logging or transmission
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.rpcMessage,
      data: this.data,
      method: this.method,
      timestamp: this.timestamp
    };
  }
}

/**
 * @class RPCRequest
 * @description Represents a single RPC request with tracking capabilities
 */
class RPCRequest {
  /**
   * Creates a new RPCRequest instance
   * @param {string} method - RPC method name
   * @param {Object} [params={}] - Method parameters
   * @param {number|string} [id] - Request ID (auto-generated if not provided)
   */
  constructor(method, params = {}, id = null) {
    this.jsonrpc = "2.0";
    this.method = method;
    this.params = params;
    this.id = id || Date.now() + Math.random();
    this.timestamp = Date.now();
    this.attempts = 0;
  }

  /**
   * Converts the request to a JSON-RPC 2.0 compliant object
   * @returns {Object} JSON-RPC request object
   */
  toJSON() {
    return {
      jsonrpc: this.jsonrpc,
      method: this.method,
      params: this.params,
      id: this.id
    };
  }

  /**
   * Creates a copy of the request for retry attempts
   * @returns {RPCRequest} New request instance with incremented attempt count
   */
  clone() {
    const cloned = new RPCRequest(this.method, this.params, this.id);
    cloned.attempts = this.attempts + 1;
    return cloned;
  }
}

/**
 * @class RPCClient
 * @description JSON-RPC 2.0 client with connection management, error handling, and retry logic
 */
class RPCClient {
  /**
   * Creates a new RPCClient instance
   * @param {string} [endpoint='/rpc'] - RPC endpoint URL
   * @param {Object} [options={}] - Client configuration options
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   * @param {number} [options.retryAttempts=3] - Number of retry attempts for failed requests
   * @param {number} [options.retryDelay=1000] - Delay between retry attempts in milliseconds
   * @param {Object} [options.headers={}] - Additional HTTP headers
   */
  constructor(endpoint = "/rpc", options = {}) {
    this.endpoint = endpoint;
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.headers = {
      "Content-Type": "application/json",
      ...options.headers
    };

    this.logger = createLogger("RPCClient", LogLevel.INFO);
    this.pendingRequests = new Map();
    this.requestCount = 0;
    this.errorCount = 0;

    this.logger.info(
      "constructor",
      `RPC client initialized with endpoint: ${endpoint}`
    );
  }

  /**
   * Performs a single RPC call
   * @param {string} method - RPC method name
   * @param {Object} [params={}] - Method parameters
   * @param {Object} [options={}] - Call-specific options
   * @param {number} [options.timeout] - Override default timeout
   * @param {boolean} [options.retryOnError=true] - Whether to retry on error
   * @returns {Promise<*>} RPC result
   * @throws {RPCError} When RPC call fails
   * @throws {Error} When network or other errors occur
   */
  async call(method, params = {}, options = {}) {
    this.logger.enter("call", { method, params: Object.keys(params) });

    const request = new RPCRequest(method, params);
    const callOptions = {
      timeout: options.timeout || this.timeout,
      retryOnError: options.retryOnError !== false,
      ...options
    };

    try {
      const result = await this._executeRequest(request, callOptions);
      this.logger.exit("call", { method, success: true });
      return result;
    } catch (error) {
      this.errorCount++;
      this.logger.error("call", `RPC call failed for method: ${method}`, error);
      throw error;
    }
  }

  /**
   * Executes an RPC request with retry logic
   * @param {RPCRequest} request - Request to execute
   * @param {Object} options - Execution options
   * @returns {Promise<*>} RPC result
   * @private
   */
  async _executeRequest(request, options) {
    this.logger.enter("_executeRequest", {
      method: request.method,
      attempt: request.attempts + 1,
      maxAttempts: this.retryAttempts
    });

    let lastError = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      request.attempts = attempt;

      try {
        const result = await this._performHTTPRequest(request, options);
        this.logger.info(
          "_executeRequest",
          `Request succeeded on attempt ${attempt + 1}`,
          { method: request.method }
        );
        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on RPC errors (server processed the request)
        if (error instanceof RPCError) {
          this.logger.warn(
            "_executeRequest",
            `RPC error on attempt ${attempt + 1}, not retrying`,
            error.toJSON()
          );
          break;
        }

        // Don't retry if retries are disabled
        if (!options.retryOnError) {
          this.logger.warn(
            "_executeRequest",
            `Network error on attempt ${attempt + 1}, retries disabled`
          );
          break;
        }

        // Don't retry on the last attempt
        if (attempt >= this.retryAttempts) {
          this.logger.error(
            "_executeRequest",
            `Network error on final attempt ${attempt + 1}`
          );
          break;
        }

        // Exponential backoff with jitter
        const baseDelay = this.retryDelay * Math.pow(2, attempt);
        const jitterDelay = baseDelay + Math.random() * 1000;

        this.logger.warn(
          "_executeRequest",
          `Network error on attempt ${attempt + 1}, retrying in ${jitterDelay.toFixed(
            0
          )}ms`,
          error
        );
        await this._delay(jitterDelay);
      }
    }

    this.logger.error(
      "_executeRequest",
      "All retry attempts exhausted",
      lastError
    );
    throw lastError;
  }

  /**
   * Performs the actual HTTP request
   * @param {RPCRequest} request - Request to send
   * @param {Object} options - Request options
   * @returns {Promise<*>} RPC result
   * @private
   */
  async _performHTTPRequest(request, options) {
    this.logger.enter("_performHTTPRequest", {
      method: request.method,
      id: request.id
    });

    this.requestCount++;
    this.pendingRequests.set(request.id, request);

    try {
      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, options.timeout);

      this.logger.debug(
        "_performHTTPRequest",
        `Sending HTTP request to ${this.endpoint}`,
        request.toJSON()
      );

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(request.toJSON()),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.logger.debug("_performHTTPRequest", "Received response", {
        hasError: !!result.error,
        hasResult: !!result.result
      });

      // Handle RPC error response
      if (result.error) {
        throw new RPCError(
          result.error.code,
          result.error.message,
          result.error.data,
          request.method
        );
      }

      // Validate response format
      if (result.jsonrpc !== "2.0" || result.id !== request.id) {
        throw new Error("Invalid JSON-RPC response format");
      }

      this.logger.exit("_performHTTPRequest", {
        method: request.method,
        success: true
      });
      return result.result;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error(
          `Request timeout after ${options.timeout}ms`
        );
        this.logger.error(
          "_performHTTPRequest",
          "Request timed out",
          timeoutError
        );
        throw timeoutError;
      }

      this.logger.error("_performHTTPRequest", "HTTP request failed", error);
      throw error;
    } finally {
      this.pendingRequests.delete(request.id);
    }
  }

  /**
   * Performs multiple RPC calls in batch
   * @param {Array<{method: string, params: Object}>} requests - Array of request specifications
   * @param {Object} [options={}] - Batch options
   * @returns {Promise<Array<*>>} Array of results (same order as requests)
   */
  async batch(requests, options = {}) {
    this.logger.enter("batch", { requestCount: requests.length });

    try {
      const promises = requests.map((req, index) =>
        this.call(req.method, req.params, options).catch(error => ({
          error,
          index
        }))
      );

      const results = await Promise.all(promises);

      // Check for any errors in the batch
      const errors = results.filter(r => r && r.error);
      if (errors.length > 0) {
        this.logger.warn("batch", `${errors.length} requests failed in batch`);
      }

      this.logger.exit("batch", {
        total: requests.length,
        succeeded: results.length - errors.length,
        failed: errors.length
      });

      return results.map(r => (r && r.error ? null : r));
    } catch (error) {
      this.logger.error("batch", "Batch execution failed", error);
      throw error;
    }
  }

  /**
   * Creates a long-polling request for real-time updates with enhanced timeout handling
   * @param {string} method - RPC method name
   * @param {Object} params - Method parameters
   * @param {Object} [options={}] - Polling options
   * @param {number} [options.timeout=30000] - Long-poll timeout
   * @param {number} [options.version] - Current state version
   * @returns {Promise<*>} Poll result
   */
  async longPoll(method, params = {}, options = {}) {
    const longPollOptions = {
      timeout: options.timeout || 30000,
      retryOnError: false, // Let caller handle polling retry logic
      ...options
    };

    // Add version parameter for efficient polling
    if (options.version !== undefined) {
      params.version = options.version;
    }

    // Add long-poll specific parameters
    params.longPoll = true;
    params.pollTimeout = longPollOptions.timeout - 5000; // Server timeout slightly less than client

    this.logger.debug("longPoll", `Starting long-poll for ${method}`, {
      timeout: longPollOptions.timeout,
      version: params.version
    });

    return this.call(method, params, longPollOptions);
  }

  /**
   * Performs efficient state polling with change detection
   * @param {string} method - RPC method name
   * @param {Object} params - Method parameters including version
   * @param {Object} [options={}] - Polling options
   * @returns {Promise<*>} Poll result with change detection
   */
  async pollWithChangeDetection(method, params = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.longPoll(method, params, options);
      
      // Check if we got new data or just a timeout
      const hasChanges = result && (
        !params.version || 
        (result.version && result.version > params.version)
      );
      
      this.logger.debug("pollWithChangeDetection", 
        `Poll completed in ${Date.now() - startTime}ms`, {
          hasChanges,
          oldVersion: params.version,
          newVersion: result?.version
        });
      
      return {
        ...result,
        hasChanges,
        pollTime: Date.now() - startTime
      };
    } catch (error) {
      // Handle timeout as normal for long-polling
      if (error.message.includes('timeout')) {
        this.logger.debug("pollWithChangeDetection", "Long-poll timeout (normal)");
        return {
          hasChanges: false,
          pollTime: Date.now() - startTime,
          timeout: true
        };
      }
      throw error;
    }
  }

  /**
   * Gets client statistics
   * @returns {Object} Client performance and usage statistics
   */
  getStats() {
    const stats = {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate:
        this.requestCount > 0
          ? (
              (this.requestCount - this.errorCount) /
              this.requestCount *
              100
            ).toFixed(2) + "%"
          : "0%",
      pendingRequests: this.pendingRequests.size,
      endpoint: this.endpoint,
      uptime: Date.now() - this.logger.startTime
    };

    this.logger.debug("getStats", "Retrieved client statistics", stats);
    return stats;
  }

  /**
   * Cancels all pending requests
   */
  cancelAllRequests() {
    this.logger.info(
      "cancelAllRequests",
      `Cancelling ${this.pendingRequests.size} pending requests`
    );
    this.pendingRequests.clear();
  }

  /**
   * Utility method for creating delays
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export public interface
export { RPCClient, RPCError, RPCRequest };

console.log("[RPCClient] RPC client module loaded successfully");
