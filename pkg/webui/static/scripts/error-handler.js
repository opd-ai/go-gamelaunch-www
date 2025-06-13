/**
 * @fileoverview Error handling utilities for dgamelaunch web client
 * @module scripts/error-handler
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

(function() {
  "use strict";

  // Module state
  let errorDisplayed = false;
  let errorCount = 0;
  const maxErrors = 5;

  /**
   * Shows an error screen with the provided message
   * @param {string} message - Error message to display
   * @param {Error} [error] - Optional error object for details
   */
  function showError(message, error = null) {
    if (errorDisplayed) {
      console.warn(
        "[ErrorHandler] Multiple errors detected, ignoring subsequent error display"
      );
      return;
    }

    errorDisplayed = true;
    errorCount++;

    console.error("[ErrorHandler] Displaying error:", message, error);

    // Hide loading screen
    const loadingScreen = document.getElementById("initial-loading");
    if (loadingScreen) {
      loadingScreen.style.display = "none";
    }

    // Get error template and client container
    const template = document.getElementById("error-template");
    const clientContainer = document.getElementById("dgamelaunch-client");

    if (template && clientContainer) {
      // Clone error template
      const errorElement = template.content.cloneNode(true);
      const errorMessage = errorElement.querySelector(".error-message");

      if (errorMessage) {
        errorMessage.textContent = message;
      }

      // Add event listeners to buttons
      const reloadButton = errorElement.querySelector("#reload-button");
      const detailsButton = errorElement.querySelector("#details-button");
      const consoleButton = errorElement.querySelector("#console-button");

      if (reloadButton) {
        reloadButton.addEventListener("click", handleReload);
      }

      if (detailsButton) {
        detailsButton.addEventListener("click", function() {
          showErrorDetails(error);
        });
      }

      if (consoleButton) {
        consoleButton.addEventListener("click", openConsole);
      }

      // Append to client container
      clientContainer.appendChild(errorElement);

      // Announce error to screen readers
      announceToScreenReader(`Error: ${message}`);

      // Focus the reload button for accessibility
      setTimeout(() => {
        const focusButton = clientContainer.querySelector("#reload-button");
        if (focusButton) {
          focusButton.focus();
        }
      }, 100);
    }
  }

  /**
   * Handles page reload with error prevention
   */
  function handleReload() {
    if (errorCount >= maxErrors) {
      const confirmReload = confirm(
        "Multiple errors have occurred. Reloading may not resolve the issue.\n\n" +
          "Continue with reload anyway?"
      );
      if (!confirmReload) {
        return;
      }
    }

    console.log("[ErrorHandler] User requested page reload");
    window.location.reload();
  }

  /**
   * Shows detailed error information in console
   * @param {Error} [originalError] - Original error that triggered display
   */
  function showErrorDetails(originalError = null) {
    console.group("[dgamelaunch] Error Details");
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
    console.log("ES6 Modules:", "import" in document.createElement("script"));
    console.log("Service Workers:", "serviceWorker" in navigator);
    console.log("Local Storage:", typeof Storage !== "undefined");

    // Network status
    if ("onLine" in navigator) {
      console.log("Network Status:", navigator.onLine ? "Online" : "Offline");
    }

    // Original error details
    if (originalError) {
      console.log("Original Error:", originalError);
      if (originalError.stack) {
        console.log("Stack Trace:", originalError.stack);
      }
    }

    // Client instance error details
    if (window.dgamelaunhClient) {
      try {
        const errors = window.dgamelaunhClient.getErrors();
        console.log("Client Errors:", errors);

        const status = window.dgamelaunhClient.getStatus();
        console.log("Client Status:", status);
      } catch (e) {
        console.log("Cannot retrieve client details:", e);
      }
    }

    // Performance metrics
    if (window.performance && window.performance.getEntriesByType) {
      const navigationEntries = window.performance.getEntriesByType(
        "navigation"
      );
      if (navigationEntries.length > 0) {
        console.log("Navigation Timing:", navigationEntries[0]);
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
    }

    console.groupEnd();

    alert(
      "Detailed error information has been logged to the browser console.\n\n" +
        "To view:\n" +
        "1. Open Developer Tools (F12 or Ctrl+Shift+I)\n" +
        "2. Go to the Console tab\n" +
        '3. Look for the "dgamelaunch Error Details" group'
    );
  }

  /**
   * Opens browser developer console with instructions
   */
  function openConsole() {
    console.log("[dgamelaunch] Developer console access requested by user");
    console.log("Browser:", getBrowserInfo());
    console.log("Platform:", navigator.platform);

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

    const platform = navigator.platform.toLowerCase().includes("mac")
      ? "macOS"
      : "Windows/Linux";
    const platformInstructions = instructions[platform];

    let instructionText = "Open the browser Developer Tools:\n\n";
    for (const [browser, shortcut] of Object.entries(platformInstructions)) {
      instructionText += `${browser}: ${shortcut}\n`;
    }
    instructionText +=
      "\nThen check the Console tab for detailed error information.";

    alert(instructionText);
  }

  /**
   * Gets basic browser information for debugging
   * @returns {string} Browser identification string
   */
  function getBrowserInfo() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      return "Chrome";
    } else if (userAgent.includes("Edg")) {
      return "Edge";
    } else if (userAgent.includes("Firefox")) {
      return "Firefox";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      return "Safari";
    } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
      return "Opera";
    } else {
      return "Unknown";
    }
  }

  /**
   * Announces messages to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    const announcer = document.getElementById("aria-announcements");
    if (announcer) {
      announcer.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = "";
      }, 1000);
    }
  }

  /**
   * Handles early application errors before main module loads
   * @param {ErrorEvent} event - Error event from window
   */
  function handleGlobalError(event) {
    console.error("[GlobalError]", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });

    let errorMessage =
      "An unexpected error occurred while loading the game client.";

    // Provide specific guidance based on error type
    if (event.message && event.message.includes("import")) {
      errorMessage =
        "Your browser may not support modern JavaScript features required by this application. " +
        "Please try updating your browser or using a different one.";
    } else if (event.filename && event.filename.includes("main.js")) {
      errorMessage =
        "Failed to load the main application module. " +
        "This may be due to a network issue or server problem. " +
        "Please check your internet connection and try refreshing the page.";
    } else if (!navigator.onLine) {
      errorMessage =
        "You appear to be offline. Please check your internet connection and try again.";
    }

    showError(errorMessage, event.error);
  }

  /**
   * Handles unhandled promise rejections
   * @param {PromiseRejectionEvent} event - Promise rejection event
   */
  function handleUnhandledRejection(event) {
    console.error("[UnhandledPromise]", event.reason);

    let errorMessage = "A network or configuration error occurred.";

    // Provide specific guidance based on rejection reason
    if (event.reason && typeof event.reason === "object") {
      if (
        event.reason.name === "TypeError" &&
        event.reason.message.includes("fetch")
      ) {
        errorMessage =
          "Failed to connect to the game server. " +
          "Please verify the server is accessible and try again.";
      } else if (event.reason.name === "SyntaxError") {
        errorMessage =
          "The server returned invalid data. " +
          "This may indicate a server configuration issue.";
      }
    }

    showError(errorMessage, event.reason);
  }

  /**
   * Sets up keyboard shortcuts for error handling
   */
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", function(event) {
      // Alt+R to reload (accessibility shortcut)
      if (event.altKey && event.key === "r") {
        event.preventDefault();
        handleReload();
      }

      // Alt+E to show error details (accessibility shortcut)
      if (event.altKey && event.key === "e") {
        event.preventDefault();
        showErrorDetails();
      }

      // Alt+C to open console (accessibility shortcut)
      if (event.altKey && event.key === "c") {
        event.preventDefault();
        openConsole();
      }
    });
  }

  /**
   * Initializes the error handler
   */
  function initializeErrorHandler() {
    // Set up global error handlers
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    console.log("[ErrorHandler] Error handling system initialized");
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeErrorHandler);
  } else {
    initializeErrorHandler();
  }

  // Export functions to global scope for external use
  window.DGameLaunchErrorHandler = {
    showError: showError,
    showErrorDetails: showErrorDetails,
    announceToScreenReader: announceToScreenReader,
    getErrorCount: () => errorCount,
    isErrorDisplayed: () => errorDisplayed
  };
})();
