/**
 * @fileoverview Connection status display component with history tracking and statistics
 * @module components/connection-status
 * @requires utils/logger
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

import { createLogger, LogLevel } from "../utils/logger.js";

/**
 * @enum {string}
 * @readonly
 * @description Connection status states for display and tracking
 */
const StatusState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  AUTHENTICATED: "authenticated",
  PLAYING: "playing",
  ERROR: "error",
  RECONNECTING: "reconnecting"
};

/**
 * @class StatusIndicator
 * @description Visual status indicator component showing connection state with color and animation
 */
class StatusIndicator {
  /**
   * Creates a new StatusIndicator instance
   * @param {Object} [options={}] - Indicator configuration options
   * @param {boolean} [options.showText=true] - Whether to show status text
   * @param {boolean} [options.showIcon=true] - Whether to show status icon
   * @param {boolean} [options.animated=true] - Whether to enable animations
   */
  constructor(options = {}) {
    this.logger = createLogger("StatusIndicator", LogLevel.DEBUG);

    this.options = {
      showText: options.showText !== false,
      showIcon: options.showIcon !== false,
      animated: options.animated !== false,
      ...options
    };

    // Current state
    this.currentState = StatusState.DISCONNECTED;
    this.lastStateChange = Date.now();

    // DOM elements
    this.element = null;
    this.iconElement = null;
    this.textElement = null;

    // Animation management
    this.animationFrame = null;
    this.pulseStartTime = 0;

    this._createElement();

    this.logger.info("constructor", "Status indicator initialized", {
      showText: this.options.showText,
      showIcon: this.options.showIcon,
      animated: this.options.animated
    });
  }

  /**
   * Creates the DOM element structure for the indicator
   * @private
   */
  _createElement() {
    this.element = document.createElement("div");
    this.element.className = "status-indicator";

    // Apply base styles
    Object.assign(this.element.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontFamily: "monospace",
      transition: "all 0.3s ease"
    });

    // Create icon element if enabled
    if (this.options.showIcon) {
      this.iconElement = document.createElement("div");
      this.iconElement.className = "status-indicator__icon";
      Object.assign(this.iconElement.style, {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        transition: "all 0.3s ease"
      });
      this.element.appendChild(this.iconElement);
    }

    // Create text element if enabled
    if (this.options.showText) {
      this.textElement = document.createElement("span");
      this.textElement.className = "status-indicator__text";
      this.element.appendChild(this.textElement);
    }

    // Set initial state
    this.updateState(this.currentState);

    this.logger.debug("_createElement", "Status indicator DOM created");
  }

  /**
   * Updates the indicator state and appearance
   * @param {string} state - New state from StatusState enum
   * @param {Object} [metadata={}] - Additional state metadata
   */
  updateState(state, metadata = {}) {
    if (!Object.values(StatusState).includes(state)) {
      this.logger.warn("updateState", `Invalid state: ${state}`);
      return;
    }

    const previousState = this.currentState;
    this.currentState = state;
    this.lastStateChange = Date.now();

    this.logger.debug(
      "updateState",
      `State updated: ${previousState} -> ${state}`,
      metadata
    );

    // Update visual appearance
    this._updateAppearance();

    // Start animation if needed
    if (this.options.animated && this._shouldAnimate(state)) {
      this._startAnimation();
    } else {
      this._stopAnimation();
    }
  }

  /**
   * Updates the visual appearance based on current state
   * @private
   */
  _updateAppearance() {
    const stateConfig = this._getStateConfig(this.currentState);

    // Update icon appearance
    if (this.iconElement) {
      Object.assign(this.iconElement.style, {
        backgroundColor: stateConfig.color,
        boxShadow: stateConfig.glow ? `0 0 6px ${stateConfig.color}` : "none"
      });
    }

    // Update text
    if (this.textElement) {
      this.textElement.textContent = stateConfig.text;
      this.textElement.style.color = stateConfig.textColor;
    }

    // Update container appearance
    Object.assign(this.element.style, {
      backgroundColor: stateConfig.backgroundColor,
      borderLeft: `3px solid ${stateConfig.color}`
    });

    // Add state-specific CSS class
    this.element.className = `status-indicator status-indicator--${
      this.currentState
    }`;
  }

  /**
   * Gets configuration for a specific state
   * @param {string} state - State to get configuration for
   * @returns {Object} State configuration
   * @private
   */
  _getStateConfig(state) {
    const configs = {
      [StatusState.DISCONNECTED]: {
        color: "#6c757d",
        backgroundColor: "#f8f9fa",
        textColor: "#495057",
        text: "Disconnected",
        glow: false
      },
      [StatusState.CONNECTING]: {
        color: "#ffc107",
        backgroundColor: "#fff3cd",
        textColor: "#856404",
        text: "Connecting...",
        glow: true
      },
      [StatusState.CONNECTED]: {
        color: "#17a2b8",
        backgroundColor: "#d1ecf1",
        textColor: "#0c5460",
        text: "Connected",
        glow: false
      },
      [StatusState.AUTHENTICATED]: {
        color: "#28a745",
        backgroundColor: "#d4edda",
        textColor: "#155724",
        text: "Authenticated",
        glow: false
      },
      [StatusState.PLAYING]: {
        color: "#007bff",
        backgroundColor: "#cce5ff",
        textColor: "#004085",
        text: "Playing",
        glow: true
      },
      [StatusState.ERROR]: {
        color: "#dc3545",
        backgroundColor: "#f8d7da",
        textColor: "#721c24",
        text: "Error",
        glow: true
      },
      [StatusState.RECONNECTING]: {
        color: "#fd7e14",
        backgroundColor: "#fff2e6",
        textColor: "#8a4a00",
        text: "Reconnecting...",
        glow: true
      }
    };

    return configs[state] || configs[StatusState.DISCONNECTED];
  }

  /**
   * Determines if animation should be active for the given state
   * @param {string} state - State to check
   * @returns {boolean} True if animation should be active
   * @private
   */
  _shouldAnimate(state) {
    const animatedStates = [
      StatusState.CONNECTING,
      StatusState.PLAYING,
      StatusState.ERROR,
      StatusState.RECONNECTING
    ];
    return animatedStates.includes(state);
  }

  /**
   * Starts the pulse animation
   * @private
   */
  _startAnimation() {
    if (this.animationFrame) {
      return; // Already animating
    }

    this.pulseStartTime = Date.now();
    this._animateFrame();

    this.logger.debug("_startAnimation", "Animation started");
  }

  /**
   * Stops the pulse animation
   * @private
   */
  _stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Reset any animation styles
    if (this.iconElement) {
      this.iconElement.style.transform = "scale(1)";
      this.iconElement.style.opacity = "1";
    }

    this.logger.debug("_stopAnimation", "Animation stopped");
  }

  /**
   * Renders a single animation frame
   * @private
   */
  _animateFrame() {
    if (!this._shouldAnimate(this.currentState)) {
      this._stopAnimation();
      return;
    }

    const elapsed = Date.now() - this.pulseStartTime;
    const cycle = 1500; // 1.5 second cycle
    const progress = (elapsed % cycle) / cycle;

    // Calculate pulse effect
    const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2);
    const scale = 1 + pulse * 0.2;
    const opacity = 0.7 + pulse * 0.3;

    // Apply animation to icon
    if (this.iconElement) {
      this.iconElement.style.transform = `scale(${scale})`;
      this.iconElement.style.opacity = opacity.toString();
    }

    this.animationFrame = requestAnimationFrame(() => this._animateFrame());
  }

  /**
   * Gets the current state
   * @returns {string} Current state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Gets the main DOM element
   * @returns {HTMLElement} The indicator element
   */
  getElement() {
    return this.element;
  }

  /**
   * Gets indicator statistics
   * @returns {Object} Indicator status and metrics
   */
  getStats() {
    return {
      currentState: this.currentState,
      lastStateChange: this.lastStateChange,
      stateAge: Date.now() - this.lastStateChange,
      isAnimated: !!this.animationFrame,
      options: this.options
    };
  }

  /**
   * Destroys the indicator and cleans up resources
   */
  destroy() {
    this.logger.enter("destroy");

    // Stop animation
    this._stopAnimation();

    // Remove from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // Clear references
    this.element = null;
    this.iconElement = null;
    this.textElement = null;

    this.logger.info("destroy", "Status indicator destroyed");
  }
}

/**
 * @class ConnectionHistory
 * @description Tracks and manages connection state change history
 */
class ConnectionHistory {
  /**
   * Creates a new ConnectionHistory instance
   */
  constructor() {
    this.logger = createLogger("ConnectionHistory", LogLevel.DEBUG);
    this.entries = [];
    this.maxEntries = 100;
    this.sessionStartTime = Date.now();

    this.logger.info("constructor", "Connection history tracker initialized");
  }

  /**
   * Records a state change in history
   * @param {string} state - New connection state
   * @param {string} [reason] - Reason for state change
   * @param {Object} [metadata] - Additional metadata
   */
  recordStateChange(state, reason = null, metadata = {}) {
    const entry = {
      timestamp: Date.now(),
      state: state,
      reason: reason,
      metadata: metadata,
      relativeTime: this._formatRelativeTime(Date.now())
    };

    this.entries.push(entry);

    // Limit history size
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    this.logger.debug(
      "recordStateChange",
      `Recorded state change: ${state}`,
      entry
    );
  }

  /**
   * Gets recent history entries
   * @param {number} [count=10] - Number of recent entries to return
   * @returns {Array} Recent history entries
   */
  getRecentHistory(count = 10) {
    return this.entries.slice(-count).reverse();
  }

  /**
   * Gets connection statistics
   * @returns {Object} Connection statistics
   */
  getStatistics() {
    const now = Date.now();
    const sessionDuration = now - this.sessionStartTime;

    // Count state occurrences
    const stateCount = {};
    let totalUptime = 0;
    let currentSession = null;

    for (const entry of this.entries) {
      stateCount[entry.state] = (stateCount[entry.state] || 0) + 1;

      if (entry.state === StatusState.PLAYING) {
        currentSession = { startTime: entry.timestamp };
      }
    }

    // Calculate success rate
    const totalConnections = stateCount[StatusState.CONNECTING] || 0;
    const successfulConnections =
      (stateCount[StatusState.CONNECTED] || 0) +
      (stateCount[StatusState.AUTHENTICATED] || 0) +
      (stateCount[StatusState.PLAYING] || 0);
    const connectionSuccessRate =
      totalConnections > 0 ? successfulConnections / totalConnections * 100 : 0;

    return {
      totalSessions: Math.max(1, totalConnections),
      connectionSuccessRate: connectionSuccessRate,
      totalUptime: totalUptime,
      sessionDuration: sessionDuration,
      currentSession: currentSession,
      stateCount: stateCount
    };
  }

  /**
   * Formats timestamp as relative time
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted relative time
   * @private
   */
  _formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}s ago`;
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return `${Math.floor(diff / 3600000)}h ago`;
    }
  }

  /**
   * Clears all history entries
   */
  clear() {
    this.entries = [];
    this.sessionStartTime = Date.now();
    this.logger.info("clear", "Connection history cleared");
  }
}

/**
 * @class ConnectionStatus
 * @description Main connection status component managing multiple indicators and history
 */
class ConnectionStatus {
  /**
   * Creates a new ConnectionStatus instance
   * @param {Object} [options={}] - Component configuration options
   * @param {HTMLElement} [options.container] - Container element for status display
   * @param {Object} [options.indicator] - Status indicator options
   * @param {boolean} [options.showHistory=false] - Whether to show connection history
   * @param {boolean} [options.showStatistics=false] - Whether to show connection statistics
   * @param {number} [options.updateInterval=1000] - Update interval for statistics in milliseconds
   */
  constructor(options = {}) {
    this.logger = createLogger("ConnectionStatus", LogLevel.INFO);

    this.options = {
      showHistory: options.showHistory === true,
      showStatistics: options.showStatistics === true,
      updateInterval: options.updateInterval || 1000,
      ...options
    };

    this.container = options.container || null;
    this.indicator = new StatusIndicator(options.indicator);
    this.history = new ConnectionHistory();

    // DOM elements
    this.element = null;
    this.historyElement = null;
    this.statisticsElement = null;

    // Update management
    this.updateTimer = null;
    this.lastUpdateTime = 0;

    this._createElement();
    this._startUpdates();

    this.logger.info("constructor", "Connection status component initialized", {
      showHistory: this.options.showHistory,
      showStatistics: this.options.showStatistics
    });
  }

  /**
   * Creates the DOM element structure for the component
   * @private
   */
  _createElement() {
    this.element = document.createElement("div");
    this.element.className = "connection-status";

    // Apply base styles to the main element
    Object.assign(this.element.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "8px",
      backgroundColor: "#f8f9fa",
      border: "1px solid #dee2e6",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontSize: "12px"
    });

    // Add the status indicator
    const indicatorContainer = document.createElement("div");
    indicatorContainer.className = "connection-status__indicator";
    indicatorContainer.appendChild(this.indicator.getElement());
    this.element.appendChild(indicatorContainer);

    // Create history display if enabled
    if (this.options.showHistory) {
      this.historyElement = document.createElement("div");
      this.historyElement.className = "connection-status__history";
      Object.assign(this.historyElement.style, {
        padding: "4px",
        backgroundColor: "#ffffff",
        border: "1px solid #e9ecef",
        borderRadius: "2px",
        maxHeight: "150px",
        overflowY: "auto"
      });
      this.element.appendChild(this.historyElement);
    }

    // Create statistics display if enabled
    if (this.options.showStatistics) {
      this.statisticsElement = document.createElement("div");
      this.statisticsElement.className = "connection-status__statistics";
      Object.assign(this.statisticsElement.style, {
        padding: "4px",
        backgroundColor: "#ffffff",
        border: "1px solid #e9ecef",
        borderRadius: "2px"
      });
      this.element.appendChild(this.statisticsElement);
    }

    // Append to container if provided
    if (this.container) {
      this.container.appendChild(this.element);
    }

    this.logger.debug("_createElement", "DOM element structure created");
  }

  /**
   * Starts periodic updates for statistics and history
   * @private
   */
  _startUpdates() {
    if (this.options.showStatistics || this.options.showHistory) {
      this.updateTimer = setInterval(() => {
        this._updateDisplay();
      }, this.options.updateInterval);

      this.logger.debug(
        "_startUpdates",
        `Updates started with ${this.options.updateInterval}ms interval`
      );
    }
  }

  /**
   * Updates the connection status display
   * @param {string} state - New connection state
   * @param {string} [reason] - Optional reason for state change
   * @param {Object} [metadata] - Additional metadata about the connection
   */
  updateStatus(state, reason = null, metadata = {}) {
    this.logger.debug("updateStatus", `Status update: ${state}`, {
      reason,
      metadata
    });

    // Update indicator
    this.indicator.updateState(state, metadata);

    // Record in history
    this.history.recordStateChange(state, reason, metadata);

    // Update display elements
    this._updateDisplay();

    this.lastUpdateTime = Date.now();
  }

  /**
   * Updates statistics and history display elements
   * @private
   */
  _updateDisplay() {
    if (this.statisticsElement) {
      this._updateStatistics();
    }

    if (this.historyElement) {
      this._updateHistory();
    }
  }

  /**
   * Updates the statistics display
   * @private
   */
  _updateStatistics() {
    const stats = this.history.getStatistics();

    const statisticsHTML = `
      <div><strong>Connection Statistics</strong></div>
      <div>Sessions: ${stats.totalSessions}</div>
      <div>Success Rate: ${stats.connectionSuccessRate.toFixed(1)}%</div>
      <div>Total Uptime: ${this._formatDuration(stats.totalUptime)}</div>
      ${
        stats.currentSession
          ? `<div>Current Session: ${this._formatDuration(
              Date.now() - stats.currentSession.startTime
            )}</div>`
          : ""
      }
      <div>Last Update: ${new Date(
        this.lastUpdateTime
      ).toLocaleTimeString()}</div>
    `;

    this.statisticsElement.innerHTML = statisticsHTML;
  }

  /**
   * Updates the history display
   * @private
   */
  _updateHistory() {
    const recentHistory = this.history.getRecentHistory(5);

    if (recentHistory.length === 0) {
      this.historyElement.innerHTML = `
        <div><strong>Recent History</strong></div>
        <div>No connection history available</div>
      `;
      return;
    }

    const historyHTML = recentHistory
      .map(entry => {
        const stateClass = `history-entry--${entry.state}`;
        return `
          <div class="history-entry ${stateClass}">
            <span class="history-time">${entry.relativeTime}</span>
            <span class="history-state">${entry.state}</span>
            ${
              entry.reason
                ? `<span class="history-reason">${entry.reason}</span>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    this.historyElement.innerHTML = `
      <div><strong>Recent History</strong></div>
      ${historyHTML}
    `;
  }

  /**
   * Formats duration in milliseconds to human-readable string
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   * @private
   */
  _formatDuration(ms) {
    if (ms < 60000) {
      return `${Math.floor(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Gets the main DOM element for this component
   * @returns {HTMLElement} The component element
   */
  getElement() {
    return this.element;
  }

  /**
   * Gets current connection statistics
   * @returns {Object} Connection statistics and status information
   */
  getStatistics() {
    return {
      currentState: this.indicator.currentState,
      lastUpdate: this.lastUpdateTime,
      history: this.history.getStatistics(),
      options: this.options
    };
  }

  /**
   * Clears connection history and resets statistics
   */
  reset() {
    this.logger.info("reset", "Resetting connection status component");

    this.history.clear();
    this.indicator.updateState(StatusState.DISCONNECTED);
    this.lastUpdateTime = Date.now();
    this._updateDisplay();
  }

  /**
   * Destroys the component and cleans up resources
   */
  destroy() {
    this.logger.enter("destroy");

    // Stop updates
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Destroy indicator
    this.indicator.destroy();

    // Remove from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // Clear references
    this.element = null;
    this.historyElement = null;
    this.statisticsElement = null;
    this.container = null;

    this.logger.info("destroy", "Connection status component destroyed");
  }
}

// Export the ConnectionStatus class and related components
export { ConnectionStatus, StatusState };

console.log(
  "[ConnectionStatus] Connection status component module loaded successfully"
);
