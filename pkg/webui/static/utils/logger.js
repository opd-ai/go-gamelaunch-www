/**
 * @fileoverview Centralized logging utilities with configurable levels and consistent formatting
 * @module utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

/**
 * @enum {number}
 * @readonly
 * @description Log level constants for controlling output verbosity
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * @class Logger
 * @description Provides structured logging with consistent formatting and level control
 */
class Logger {
  /**
   * Creates a new Logger instance
   * @param {string} moduleName - Name of the module/component using this logger
   * @param {number} [level=LogLevel.INFO] - Minimum log level to output
   */
  constructor(moduleName, level = LogLevel.INFO) {
    this.moduleName = moduleName;
    this.level = level;
    this.startTime = Date.now();

    console.log(
      `[Logger] Logger created for module: ${moduleName}, level: ${this.getLevelName(
        level
      )}`
    );
  }

  /**
   * Gets the string representation of a log level
   * @param {number} level - Log level number
   * @returns {string} Human-readable level name
   * @private
   */
  getLevelName(level) {
    const names = ["ERROR", "WARN", "INFO", "DEBUG"];
    return names[level] || "UNKNOWN";
  }

  /**
   * Formats a timestamp for log messages
   * @returns {string} Formatted timestamp
   * @private
   */
  getTimestamp() {
    const elapsed = Date.now() - this.startTime;
    return `+${elapsed}ms`;
  }

  /**
   * Formats a log message with consistent structure
   * @param {string} level - Log level name
   * @param {string} method - Method or function name
   * @param {string} message - Primary log message
   * @param {*} [data] - Additional data to log
   * @returns {string} Formatted log message
   * @private
   */
  formatMessage(level, method, message, data) {
    const timestamp = this.getTimestamp();
    const prefix = `[${this.moduleName}] ${method}: ${message}`;

    if (data !== undefined) {
      return `${timestamp} ${level} ${prefix}`;
    }
    return `${timestamp} ${level} ${prefix}`;
  }

  /**
   * Logs an error message
   * @param {string} method - Method name where error occurred
   * @param {string} message - Error description
   * @param {Error|*} [error] - Error object or additional data
   */
  error(method, message, error) {
    if (this.level >= LogLevel.ERROR) {
      const formattedMsg = this.formatMessage("ERROR", method, message);
      if (error) {
        console.error(formattedMsg, error);
        if (error instanceof Error && error.stack) {
          console.error(`[${this.moduleName}] Stack trace:`, error.stack);
        }
      } else {
        console.error(formattedMsg);
      }
    }
  }

  /**
   * Logs a warning message
   * @param {string} method - Method name
   * @param {string} message - Warning description
   * @param {*} [data] - Additional data to log
   */
  warn(method, message, data) {
    if (this.level >= LogLevel.WARN) {
      const formattedMsg = this.formatMessage("WARN", method, message);
      if (data !== undefined) {
        console.warn(formattedMsg, data);
      } else {
        console.warn(formattedMsg);
      }
    }
  }

  /**
   * Logs an informational message
   * @param {string} method - Method name
   * @param {string} message - Information description
   * @param {*} [data] - Additional data to log
   */
  info(method, message, data) {
    if (this.level >= LogLevel.INFO) {
      const formattedMsg = this.formatMessage("INFO", method, message);
      if (data !== undefined) {
        console.log(formattedMsg, data);
      } else {
        console.log(formattedMsg);
      }
    }
  }

  /**
   * Logs a debug message
   * @param {string} method - Method name
   * @param {string} message - Debug information
   * @param {*} [data] - Additional data to log
   */
  debug(method, message, data) {
    if (this.level >= LogLevel.DEBUG) {
      const formattedMsg = this.formatMessage("DEBUG", method, message);
      if (data !== undefined) {
        console.log(formattedMsg, data);
      } else {
        console.log(formattedMsg);
      }
    }
  }

  /**
   * Logs method entry with optional parameters
   * @param {string} method - Method name being entered
   * @param {*} [params] - Method parameters
   */
  enter(method, params) {
    if (this.level >= LogLevel.DEBUG) {
      const message =
        params !== undefined ? "entering with params" : "entering";
      this.debug(method, message, params);
    }
  }

  /**
   * Logs method exit with optional return value
   * @param {string} method - Method name being exited
   * @param {*} [result] - Return value
   */
  exit(method, result) {
    if (this.level >= LogLevel.DEBUG) {
      const message = result !== undefined ? "exiting with result" : "exiting";
      this.debug(method, message, result);
    }
  }

  /**
   * Creates a performance timing wrapper for methods
   * @param {string} method - Method name
   * @param {Function} fn - Function to time
   * @returns {*} Function result
   */
  time(method, fn) {
    const startTime = performance.now();
    this.debug(method, "performance timing started");

    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.info(method, `completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(method, `failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Creates an async performance timing wrapper for methods
   * @param {string} method - Method name
   * @param {Function} fn - Async function to time
   * @returns {Promise<*>} Function result
   */
  async timeAsync(method, fn) {
    const startTime = performance.now();
    this.debug(method, "async performance timing started");

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.info(method, `async completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(method, `async failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }
}

/**
 * Creates a new logger instance for a module
 * @param {string} moduleName - Name of the module/component
 * @param {number} [level=LogLevel.INFO] - Minimum log level to output
 * @returns {Logger} New logger instance
 */
function createLogger(moduleName, level = LogLevel.INFO) {
  console.log(`[LoggerFactory] Creating logger for module: ${moduleName}`);
  return new Logger(moduleName, level);
}

/**
 * Sets the global log level for all new loggers
 * @param {number} level - New global log level
 */
function setGlobalLogLevel(level) {
  console.log(`[LoggerFactory] Setting global log level to: ${level}`);
  Logger.defaultLevel = level;
}

// Export public interface
export { createLogger, setGlobalLogLevel, LogLevel, Logger };

console.log("[Logger] Logger module loaded successfully");
