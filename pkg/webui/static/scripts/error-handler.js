/**
 * @fileoverview Error handling utilities for dgamelaunch web client
 * Provides comprehensive error handling, display, and debugging utilities
 * for the dgamelaunch web interface including global error handlers,
 * user-friendly error displays, and diagnostic information collection.
 * @module scripts/error-handler
 * @author go-gamelaunch-client
 * @version 1.0.0
 * @since 1.0.0
 */

(function() {
  "use strict";

  console.debug("[ErrorHandler] - debug: Initializing error handler module");

  // Module state
  let errorDisplayed = false;
  let errorCount = 0;
  const maxErrors = 5;

  console.debug("[ErrorHandler] - debug: Module state initialized", { 
    errorDisplayed, 
    errorCount, 
    maxErrors 
  });

  /**
   * Shows an error screen with the provided message to the user.
   * Displays a user-friendly error interface with options to reload,
   * view details, or access developer console. Only shows one error
   * at a time to prevent multiple overlapping error displays.
   * 
   * @function showError
   * @param {string} message - Error message to display to the user
   * @param {Error} [error=null] - Optional error object for additional details
   * @throws {TypeError} If message is not a string
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Show a simple error message
   * showError("Connection failed");
   * 
   * @example
   * // Show error with details
   * try {
   *   riskyOperation();
   * } catch (err) {
   *   showError("Operation failed", err);
   * }
   */
  function showError(message, error = null) {
    console.debug("[showError] - debug: Function called", { message, error: error?.message });

    if (typeof message !== 'string') {
      console.error("[showError] - error: Invalid message type", typeof message);
      throw new TypeError('Message must be a string');
    }

    if (errorDisplayed) {
      console.warn("[showError] - warn: Multiple errors detected, ignoring subsequent error display");
      return;
    }

    console.info("[showError] - info: Displaying error to user", { 
      message, 
      errorCount: errorCount + 1 
    });

    errorDisplayed = true;
    errorCount++;

    console.error("[showError] - error: Error being displayed", { message, error });

    try {
      // Hide loading screen
      console.debug("[showError] - debug: Hiding loading screen");
      const loadingScreen = document.getElementById("initial-loading");
      if (loadingScreen) {
        loadingScreen.style.display = "none";
        console.debug("[showError] - debug: Loading screen hidden successfully");
      } else {
        console.warn("[showError] - warn: Loading screen element not found");
      }

      // Get error template and client container
      console.debug("[showError] - debug: Retrieving error template and client container");
      const template = document.getElementById("error-template");
      const clientContainer = document.getElementById("dgamelaunch-client");

      if (!template) {
        console.error("[showError] - error: Error template not found");
        throw new Error("Error template not found in DOM");
      }

      if (!clientContainer) {
        console.error("[showError] - error: Client container not found");
        throw new Error("Client container not found in DOM");
      }

      console.debug("[showError] - debug: Template and container found, creating error display");

      // Clone error template
      const errorElement = template.content.cloneNode(true);
      const errorMessage = errorElement.querySelector(".error-message");

      if (errorMessage) {
        errorMessage.textContent = message;
        console.debug("[showError] - debug: Error message set in template");
      } else {
        console.warn("[showError] - warn: Error message element not found in template");
      }

      // Add event listeners to buttons
      console.debug("[showError] - debug: Setting up button event listeners");
      const reloadButton = errorElement.querySelector("#reload-button");
      const detailsButton = errorElement.querySelector("#details-button");
      const consoleButton = errorElement.querySelector("#console-button");

      if (reloadButton) {
        reloadButton.addEventListener("click", handleReload);
        console.debug("[showError] - debug: Reload button listener attached");
      } else {
        console.warn("[showError] - warn: Reload button not found");
      }

      if (detailsButton) {
        detailsButton.addEventListener("click", function() {
          console.debug("[showError] - debug: Details button clicked");
          showErrorDetails(error);
        });
        console.debug("[showError] - debug: Details button listener attached");
      } else {
        console.warn("[showError] - warn: Details button not found");
      }

      if (consoleButton) {
        consoleButton.addEventListener("click", openConsole);
        console.debug("[showError] - debug: Console button listener attached");
      } else {
        console.warn("[showError] - warn: Console button not found");
      }

      // Append to client container
      console.debug("[showError] - debug: Appending error element to container");
      clientContainer.appendChild(errorElement);

      // Announce error to screen readers
      console.debug("[showError] - debug: Announcing error to screen readers");
      announceToScreenReader(`Error: ${message}`);

      // Focus the reload button for accessibility
      console.debug("[showError] - debug: Setting focus for accessibility");
      setTimeout(() => {
        const focusButton = clientContainer.querySelector("#reload-button");
        if (focusButton) {
          focusButton.focus();
          console.debug("[showError] - debug: Focus set on reload button");
        } else {
          console.warn("[showError] - warn: Could not find reload button for focus");
        }
      }, 100);

      console.info("[showError] - info: Error display setup completed successfully");

    } catch (displayError) {
      console.error("[showError] - error: Failed to display error interface", displayError);
      // Fallback to basic alert if error display fails
      alert(`Error: ${message}\n\nAdditional error occurred while displaying error interface: ${displayError.message}`);
    }
  }

  /**
   * Handles page reload with error prevention and user confirmation.
   * Prevents infinite reload loops by confirming with user when multiple
   * errors have occurred. Provides safety mechanism against continuous
   * reload attempts that might not resolve underlying issues.
   * 
   * @function handleReload
   * @throws {Error} If window.location is not available
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Called automatically by reload button click
   * handleReload();
   */
  function handleReload() {
    console.debug("[handleReload] - debug: Function called", { errorCount, maxErrors });

    try {
      if (errorCount >= maxErrors) {
        console.warn("[handleReload] - warn: Maximum error count reached, requesting user confirmation");
        const confirmReload = confirm(
          "Multiple errors have occurred. Reloading may not resolve the issue.\n\n" +
            "Continue with reload anyway?"
        );
        if (!confirmReload) {
          console.info("[handleReload] - info: User cancelled reload operation");
          return;
        }
        console.info("[handleReload] - info: User confirmed reload despite multiple errors");
      }

      console.info("[handleReload] - info: User requested page reload");
      
      if (!window.location) {
        console.error("[handleReload] - error: window.location not available");
        throw new Error("Cannot reload: window.location not available");
      }

      console.debug("[handleReload] - debug: Initiating page reload");
      window.location.reload();
      
    } catch (reloadError) {
      console.error("[handleReload] - error: Failed to reload page", reloadError);
      alert("Failed to reload the page. Please manually refresh your browser.");
    }
  }

  /**
   * Shows detailed error information in browser console for debugging.
   * Collects comprehensive diagnostic information including browser details,
   * performance metrics, network status, and application state. Groups
   * all information in the console and shows user instructions for access.
   * 
   * @function showErrorDetails
   * @param {Error} [originalError=null] - Original error that triggered display
   * @throws {Error} If console operations fail
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Show details for a specific error
   * showErrorDetails(new Error("Connection failed"));
   * 
   * @example
   * // Show general error details
   * showErrorDetails();
   */
  function showErrorDetails(originalError = null) {
    console.debug("[showErrorDetails] - debug: Function called", { 
      hasOriginalError: !!originalError 
    });

    try {
      console.group("[dgamelaunch] Error Details");
      console.info("[showErrorDetails] - info: Generating detailed error report");

      // Basic information
      console.debug("[showErrorDetails] - debug: Collecting basic diagnostic information");
      console.log("Timestamp:", new Date().toISOString());
      console.log("User Agent:", navigator.userAgent);
      console.log("Location:", window.location.href);
      console.log("Error Count:", errorCount);
      console.log(
        "Page Load Time:",
        Date.now() - performance.timing.navigationStart,
        "ms"
      );

      // Browser capability checks
      console.debug("[showErrorDetails] - debug: Checking browser capabilities");
      console.log("ES6 Modules:", "import" in document.createElement("script"));
      console.log("Service Workers:", "serviceWorker" in navigator);
      console.log("Local Storage:", typeof Storage !== "undefined");

      // Network status
      if ("onLine" in navigator) {
        const networkStatus = navigator.onLine ? "Online" : "Offline";
        console.log("Network Status:", networkStatus);
        console.debug("[showErrorDetails] - debug: Network status checked", { networkStatus });
      } else {
        console.warn("[showErrorDetails] - warn: Network status not available");
      }

      // Original error details
      if (originalError) {
        console.debug("[showErrorDetails] - debug: Processing original error details");
        console.log("Original Error:", originalError);
        if (originalError.stack) {
          console.log("Stack Trace:", originalError.stack);
        }
      } else {
        console.debug("[showErrorDetails] - debug: No original error provided");
      }

      // Client instance error details
      console.debug("[showErrorDetails] - debug: Checking client instance details");
      if (window.dgamelaunhClient) {
        try {
          const errors = window.dgamelaunhClient.getErrors();
          console.log("Client Errors:", errors);

          const status = window.dgamelaunhClient.getStatus();
          console.log("Client Status:", status);
          console.debug("[showErrorDetails] - debug: Client details retrieved successfully");
        } catch (clientError) {
          console.warn("[showErrorDetails] - warn: Cannot retrieve client details", clientError);
          console.log("Cannot retrieve client details:", clientError);
        }
      } else {
        console.debug("[showErrorDetails] - debug: Client instance not available");
      }

      // Performance metrics
      console.debug("[showErrorDetails] - debug: Collecting performance metrics");
      if (window.performance && window.performance.getEntriesByType) {
        try {
          const navigationEntries = window.performance.getEntriesByType("navigation");
          if (navigationEntries.length > 0) {
            console.log("Navigation Timing:", navigationEntries[0]);
            console.debug("[showErrorDetails] - debug: Navigation timing collected");
          }

          const resourceEntries = window.performance.getEntriesByType("resource");
          console.log(
            "Resource Load Times:",
            resourceEntries.map(entry => ({
              name: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize
            }))
          );
          console.debug("[showErrorDetails] - debug: Resource timing collected", { 
            resourceCount: resourceEntries.length 
          });
        } catch (perfError) {
          console.warn("[showErrorDetails] - warn: Failed to collect performance metrics", perfError);
        }
      } else {
        console.warn("[showErrorDetails] - warn: Performance API not available");
      }

      console.groupEnd();
      console.info("[showErrorDetails] - info: Error details report completed");

      alert(
        "Detailed error information has been logged to the browser console.\n\n" +
          "To view:\n" +
          "1. Open Developer Tools (F12 or Ctrl+Shift+I)\n" +
          "2. Go to the Console tab\n" +
          '3. Look for the "dgamelaunch Error Details" group'
      );

    } catch (detailsError) {
      console.error("[showErrorDetails] - error: Failed to generate error details", detailsError);
      alert("Failed to generate error details. Please check the browser console manually.");
    }
  }

  /**
   * Opens browser developer console with platform-specific instructions.
   * Provides user-friendly guidance for accessing developer tools across
   * different browsers and operating systems. Logs diagnostic information
   * and displays modal with keyboard shortcuts for console access.
   * 
   * @function openConsole
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Called automatically by console button click
   * openConsole();
   */
  function openConsole() {
    console.debug("[openConsole] - debug: Function called");

    try {
      console.info("[openConsole] - info: Developer console access requested by user");
      
      const browserInfo = getBrowserInfo();
      const platform = navigator.platform;
      
      console.log("Browser:", browserInfo);
      console.log("Platform:", platform);
      console.debug("[openConsole] - debug: Platform and browser detected", { browserInfo, platform });

      const instructions = {
        "Windows/Linux": {
          "Chrome/Edge": "F12 or Ctrl+Shift+I",
          Firefox: "F12 or Ctrl+Shift+K",
          Opera: "Ctrl+Shift+I"
        },
        macOS: {
          "Chrome/Edge": "Cmd+Option+I",
          Firefox: "Cmd+Option+K",
          Safari: "Cmd+Option+I"
        }
      };

      const detectedPlatform = navigator.platform.toLowerCase().includes("mac")
        ? "macOS"
        : "Windows/Linux";
      const platformInstructions = instructions[detectedPlatform];

      console.debug("[openConsole] - debug: Instructions selected for platform", { 
        detectedPlatform, 
        availableInstructions: Object.keys(platformInstructions) 
      });

      let instructionText = "Open the browser Developer Tools:\n\n";
      for (const [browser, shortcut] of Object.entries(platformInstructions)) {
        instructionText += `${browser}: ${shortcut}\n`;
      }
      instructionText +=
        "\nThen check the Console tab for detailed error information.";

      console.info("[openConsole] - info: Displaying console access instructions to user");
      alert(instructionText);

    } catch (consoleError) {
      console.error("[openConsole] - error: Failed to show console instructions", consoleError);
      alert("Failed to show console instructions. Please try F12 or right-click and select 'Inspect Element'.");
    }
  }

  /**
   * Gets basic browser information for debugging purposes.
   * Analyzes the user agent string to identify the browser type,
   * providing simplified browser identification for diagnostic
   * and compatibility purposes.
   * 
   * @function getBrowserInfo
   * @returns {string} Browser identification string (Chrome, Edge, Firefox, Safari, Opera, or Unknown)
   * @since 1.0.0
   * @example
   * const browser = getBrowserInfo();
   * console.log(`User is using: ${browser}`);
   * // Output: "User is using: Chrome"
   */
  function getBrowserInfo() {
    console.debug("[getBrowserInfo] - debug: Function called");

    try {
      const userAgent = navigator.userAgent;
      console.debug("[getBrowserInfo] - debug: Analyzing user agent", { 
        userAgent: userAgent.substring(0, 100) + '...' // Truncated for logging
      });

      let browserName;
      if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
        browserName = "Chrome";
      } else if (userAgent.includes("Edg")) {
        browserName = "Edge";
      } else if (userAgent.includes("Firefox")) {
        browserName = "Firefox";
      } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        browserName = "Safari";
      } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
        browserName = "Opera";
      } else {
        browserName = "Unknown";
        console.warn("[getBrowserInfo] - warn: Could not identify browser from user agent");
      }

      console.debug("[getBrowserInfo] - debug: Browser identified", { browserName });
      return browserName;

    } catch (browserError) {
      console.error("[getBrowserInfo] - error: Failed to get browser info", browserError);
      return "Unknown";
    }
  }

  /**
   * Announces messages to screen readers for accessibility support.
   * Uses ARIA live regions to communicate important information to
   * assistive technologies. Messages are announced and then cleared
   * to prevent repeated announcements.
   * 
   * @function announceToScreenReader
   * @param {string} message - Message to announce to screen readers
   * @throws {TypeError} If message is not a string
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Announce an error to screen readers
   * announceToScreenReader("Error: Connection failed");
   * 
   * @example
   * // Announce status updates
   * announceToScreenReader("Game loaded successfully");
   */
  function announceToScreenReader(message) {
    console.debug("[announceToScreenReader] - debug: Function called", { message });

    try {
      if (typeof message !== 'string') {
        console.error("[announceToScreenReader] - error: Invalid message type", typeof message);
        throw new TypeError('Message must be a string');
      }

      const announcer = document.getElementById("aria-announcements");
      if (announcer) {
        console.debug("[announceToScreenReader] - debug: ARIA announcer found, setting message");
        announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
          announcer.textContent = "";
          console.debug("[announceToScreenReader] - debug: ARIA announcement cleared");
        }, 1000);

        console.info("[announceToScreenReader] - info: Message announced to screen readers", { message });
      } else {
        console.warn("[announceToScreenReader] - warn: ARIA announcements element not found in DOM");
      }

    } catch (announceError) {
      console.error("[announceToScreenReader] - error: Failed to announce to screen reader", announceError);
    }
  }

  /**
   * Handles early application errors before main module loads.
   * Global error handler that catches unhandled JavaScript errors
   * and provides user-friendly error messages with specific guidance
   * based on error type and context.
   * 
   * @function handleGlobalError
   * @param {ErrorEvent} event - Error event from window error handler
   * @throws {TypeError} If event is not an ErrorEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Automatically called for global errors
   * window.addEventListener("error", handleGlobalError);
   */
  function handleGlobalError(event) {
    console.debug("[handleGlobalError] - debug: Function called", { 
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });

    try {
      console.error("[handleGlobalError] - error: Global error caught", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });

      let errorMessage = "An unexpected error occurred while loading the game client.";

      console.debug("[handleGlobalError] - debug: Analyzing error type for specific guidance");

      // Provide specific guidance based on error type
      if (event.message && event.message.includes("import")) {
        errorMessage =
          "Your browser may not support modern JavaScript features required by this application. " +
          "Please try updating your browser or using a different one.";
        console.warn("[handleGlobalError] - warn: ES6 module import error detected");
      } else if (event.filename && event.filename.includes("main.js")) {
        errorMessage =
          "Failed to load the main application module. " +
          "This may be due to a network issue or server problem. " +
          "Please check your internet connection and try refreshing the page.";
        console.warn("[handleGlobalError] - warn: Main module loading error detected");
      } else if (!navigator.onLine) {
        errorMessage =
          "You appear to be offline. Please check your internet connection and try again.";
        console.warn("[handleGlobalError] - warn: Offline condition detected");
      }

      console.info("[handleGlobalError] - info: Displaying global error to user", { errorMessage });
      showError(errorMessage, event.error);

    } catch (handlerError) {
      console.error("[handleGlobalError] - error: Failed to handle global error", handlerError);
      // Fallback alert if error handler fails
      alert("A critical error occurred and the error handler failed. Please refresh the page.");
    }
  }

  /**
   * Handles unhandled promise rejections globally.
   * Catches unhandled promise rejections that would otherwise be silent
   * and provides user-friendly error messages with specific guidance
   * based on rejection reason and type.
   * 
   * @function handleUnhandledRejection
   * @param {PromiseRejectionEvent} event - Promise rejection event from window
   * @throws {TypeError} If event is not a PromiseRejectionEvent
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Automatically called for unhandled promise rejections
   * window.addEventListener("unhandledrejection", handleUnhandledRejection);
   */
  function handleUnhandledRejection(event) {
    console.debug("[handleUnhandledRejection] - debug: Function called", { 
      reason: event.reason,
      reasonType: typeof event.reason
    });

    try {
      console.error("[handleUnhandledRejection] - error: Unhandled promise rejection", event.reason);

      let errorMessage = "A network or configuration error occurred.";

      console.debug("[handleUnhandledRejection] - debug: Analyzing rejection reason for specific guidance");

      // Provide specific guidance based on rejection reason
      if (event.reason && typeof event.reason === "object") {
        if (
          event.reason.name === "TypeError" &&
          event.reason.message.includes("fetch")
        ) {
          errorMessage =
            "Failed to connect to the game server. " +
            "Please verify the server is accessible and try again.";
          console.warn("[handleUnhandledRejection] - warn: Fetch-related TypeError detected");
        } else if (event.reason.name === "SyntaxError") {
          errorMessage =
            "The server returned invalid data. " +
            "This may indicate a server configuration issue.";
          console.warn("[handleUnhandledRejection] - warn: SyntaxError detected - invalid server response");
        } else {
          console.debug("[handleUnhandledRejection] - debug: Other error type detected", { 
            errorName: event.reason.name,
            errorMessage: event.reason.message 
          });
        }
      } else {
        console.debug("[handleUnhandledRejection] - debug: Non-object rejection reason", { 
          reason: event.reason 
        });
      }

      console.info("[handleUnhandledRejection] - info: Displaying promise rejection error to user", { errorMessage });
      showError(errorMessage, event.reason);

    } catch (handlerError) {
      console.error("[handleUnhandledRejection] - error: Failed to handle promise rejection", handlerError);
      // Fallback alert if error handler fails
      alert("A critical promise rejection occurred and the error handler failed. Please refresh the page.");
    }
  }

  /**
   * Sets up keyboard shortcuts for error handling accessibility.
   * Provides keyboard-based access to error handling functions
   * for users who may not be able to use mouse interactions.
   * Implements Alt+key combinations for common error actions.
   * 
   * @function setupKeyboardShortcuts
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Called automatically during initialization
   * setupKeyboardShortcuts();
   * // Users can then use: Alt+R (reload), Alt+E (error details), Alt+C (console)
   */
  function setupKeyboardShortcuts() {
    console.debug("[setupKeyboardShortcuts] - debug: Function called, setting up accessibility shortcuts");

    try {
      document.addEventListener("keydown", function(event) {
        console.debug("[setupKeyboardShortcuts] - debug: Keydown event", { 
          altKey: event.altKey, 
          key: event.key 
        });

        // Alt+R to reload (accessibility shortcut)
        if (event.altKey && event.key === "r") {
          event.preventDefault();
          console.info("[setupKeyboardShortcuts] - info: Alt+R shortcut activated");
          handleReload();
        }

        // Alt+E to show error details (accessibility shortcut)
        if (event.altKey && event.key === "e") {
          event.preventDefault();
          console.info("[setupKeyboardShortcuts] - info: Alt+E shortcut activated");
          showErrorDetails();
        }

        // Alt+C to open console (accessibility shortcut)
        if (event.altKey && event.key === "c") {
          event.preventDefault();
          console.info("[setupKeyboardShortcuts] - info: Alt+C shortcut activated");
          openConsole();
        }
      });

      console.info("[setupKeyboardShortcuts] - info: Keyboard shortcuts configured successfully");
      console.debug("[setupKeyboardShortcuts] - debug: Available shortcuts: Alt+R (reload), Alt+E (error details), Alt+C (console)");

    } catch (shortcutError) {
      console.error("[setupKeyboardShortcuts] - error: Failed to setup keyboard shortcuts", shortcutError);
    }
  }

  /**
   * Initializes the error handler system.
   * Sets up global error handlers, keyboard shortcuts, and prepares
   * the error handling system for operation. Should be called once
   * when the application starts or when DOM is ready.
   * 
   * @function initializeErrorHandler
   * @returns {void}
   * @since 1.0.0
   * @example
   * // Called automatically when DOM is ready
   * initializeErrorHandler();
   */
  function initializeErrorHandler() {
    console.debug("[initializeErrorHandler] - debug: Function called");

    try {
      // Set up global error handlers
      console.debug("[initializeErrorHandler] - debug: Setting up global error handlers");
      window.addEventListener("error", handleGlobalError);
      window.addEventListener("unhandledrejection", handleUnhandledRejection);

      // Set up keyboard shortcuts
      console.debug("[initializeErrorHandler] - debug: Setting up keyboard shortcuts");
      setupKeyboardShortcuts();

      console.info("[initializeErrorHandler] - info: Error handling system initialized successfully");

    } catch (initError) {
      console.error("[initializeErrorHandler] - error: Failed to initialize error handler", initError);
      // Even if initialization fails, try to set up basic error handling
      try {
        window.addEventListener("error", handleGlobalError);
        console.warn("[initializeErrorHandler] - warn: Fallback error handling setup completed");
      } catch (fallbackError) {
        console.error("[initializeErrorHandler] - error: Fallback error handling setup failed", fallbackError);
      }
    }
  }

  // Auto-initialize when DOM is ready
  console.debug("[ErrorHandler] - debug: Setting up DOM ready initialization");
  if (document.readyState === "loading") {
    console.debug("[ErrorHandler] - debug: DOM still loading, adding event listener");
    document.addEventListener("DOMContentLoaded", initializeErrorHandler);
  } else {
    console.debug("[ErrorHandler] - debug: DOM already ready, initializing immediately");
    initializeErrorHandler();
  }

  // Export functions to global scope for external use
  console.debug("[ErrorHandler] - debug: Exporting functions to global scope");
  window.DGameLaunchErrorHandler = {
    showError: showError,
    showErrorDetails: showErrorDetails,
    announceToScreenReader: announceToScreenReader,
    getErrorCount: () => {
      console.debug("[DGameLaunchErrorHandler.getErrorCount] - debug: Returning error count", { errorCount });
      return errorCount;
    },
    isErrorDisplayed: () => {
      console.debug("[DGameLaunchErrorHandler.isErrorDisplayed] - debug: Returning error display status", { errorDisplayed });
      return errorDisplayed;
    }
  };

  console.info("[ErrorHandler] - info: Error handler module initialization completed");

})();
