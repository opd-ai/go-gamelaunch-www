/**
 * @fileoverview Application initialization for dgamelaunch web client
 * @module scripts/app-init
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

(function() {
  "use strict";

  // Initialization state
  let initializationStartTime = Date.now();
  let loadTimeout = null;
  let moduleLoadAttempted = false;

  // Configuration
  const LOAD_TIMEOUT_MS = 15000; // 15 seconds
  const RETRY_DELAY_MS = 2000; // 2 seconds
  const MAX_RETRIES = 3;

  /**
   * Handles successful module loading with cleanup and user feedback
   * @returns {void} No return value, performs UI updates and logging
   * @throws {Error} Never throws, handles all errors gracefully
   * @example
   * // Internal function called automatically on successful module load
   * // handleModuleLoadSuccess(); // Updates UI and announces to screen readers
   * @since 1.0.0
   */
  function handleModuleLoadSuccess() {
    console.debug(`[handleModuleLoadSuccess] - DEBUG: Main module loaded successfully, starting cleanup`);
    
    const loadTime = Date.now() - initializationStartTime;
    console.info(`[handleModuleLoadSuccess] - INFO: Module load completed in ${loadTime}ms`);

    // Clear timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
      console.debug(`[handleModuleLoadSuccess] - DEBUG: Load timeout cleared`);
    }

    // Hide loading screen with fade effect
    hideLoadingScreen();

    // Announce success to screen readers
    if (window.DGameLaunchErrorHandler) {
      window.DGameLaunchErrorHandler.announceToScreenReader(
        "Game client loaded successfully. Ready to connect."
      );
      console.debug(`[handleModuleLoadSuccess] - DEBUG: Screen reader announcement sent`);
    } else {
      console.warn(`[handleModuleLoadSuccess] - WARN: Error handler not available for screen reader announcement`);
    }

    console.info(`[handleModuleLoadSuccess] - INFO: Initialization completed successfully in ${loadTime}ms`);
  }

  /**
   * Handles module loading failure with error reporting and retry logic
   * @param {Error} error - Error object describing the failure reason
   * @param {number} [retryCount=0] - Current retry attempt number (0-based)
   * @returns {void} No return value, displays error or initiates retry
   * @throws {Error} Never throws, all errors are handled and reported
   * @example
   * // Internal function called automatically on module load failure
   * // handleModuleLoadFailure(new Error('Network timeout'), 1);
   * @since 1.0.0
   */
  function handleModuleLoadFailure(error, retryCount = 0) {
    console.debug(`[handleModuleLoadFailure] - DEBUG: Handling module load failure, retry count: ${retryCount}`, error);
    console.error(`[handleModuleLoadFailure] - ERROR: Module load failed:`, error);

    // Clear timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
      console.debug(`[handleModuleLoadFailure] - DEBUG: Load timeout cleared`);
    }

    // Determine error message based on error type and retry count
    let errorMessage;
    if (retryCount >= MAX_RETRIES) {
      errorMessage =
        "Failed to load the game client after multiple attempts. " +
        "This may be due to a persistent network issue or browser compatibility problem.";
      console.error(`[handleModuleLoadFailure] - ERROR: Max retries exceeded (${MAX_RETRIES}), showing final error`);
    } else if (error && error.message && error.message.includes("import")) {
      errorMessage =
        "Failed to load the game client module. " +
        "This may be due to a browser compatibility issue or network problem.";
      console.warn(`[handleModuleLoadFailure] - WARN: Import-related error detected`);
    } else {
      errorMessage =
        "Unable to initialize the game client. " +
        "Please check your internet connection and try refreshing the page.";
      console.warn(`[handleModuleLoadFailure] - WARN: General initialization error`);
    }

    // Show error using error handler
    if (window.DGameLaunchErrorHandler) {
      window.DGameLaunchErrorHandler.showError(errorMessage, error);
      console.info(`[handleModuleLoadFailure] - INFO: Error displayed to user via error handler`);
    } else {
      // Fallback if error handler isn't available
      console.error(
        `[handleModuleLoadFailure] - ERROR: Error handler not available, using alert fallback`
      );
      alert(`Error: ${errorMessage}`);
    }
  }

  /**
   * Hides the loading screen with smooth transition animation
   * @returns {void} No return value, performs DOM manipulation for UI transition
   * @throws {Error} Never throws, handles missing elements gracefully
   * @example
   * // Internal function called automatically after successful module load
   * // hideLoadingScreen(); // Fades out and removes loading screen element
   * @since 1.0.0
   */
  function hideLoadingScreen() {
    console.debug(`[hideLoadingScreen] - DEBUG: Attempting to hide loading screen`);
    
    const loadingScreen = document.getElementById("initial-loading");
    if (loadingScreen && !window.DGameLaunchErrorHandler?.isErrorDisplayed()) {
      console.debug(`[hideLoadingScreen] - DEBUG: Loading screen element found, starting fade transition`);
      
      // Fade out loading screen
      loadingScreen.style.transition = "opacity 0.5s ease";
      loadingScreen.style.opacity = "0";

      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
          console.info(`[hideLoadingScreen] - INFO: Loading screen successfully removed from DOM`);
        } else {
          console.warn(`[hideLoadingScreen] - WARN: Loading screen element no longer has parent node`);
        }
      }, 500);
    } else if (!loadingScreen) {
      console.warn(`[hideLoadingScreen] - WARN: Loading screen element not found in DOM`);
    } else {
      console.warn(`[hideLoadingScreen] - WARN: Error displayed, skipping loading screen removal`);
    }
  }

  /**
   * Attempts to load the main application module
   * @param {number} [retryCount=0] - Current retry attempt
   */
  function loadMainModule(retryCount = 0) {
    if (moduleLoadAttempted && retryCount === 0) {
      console.warn("[AppInit] Module load already attempted");
      return;
    }

    moduleLoadAttempted = true;

    console.log(
      `[AppInit] Loading main module (attempt ${retryCount + 1}/${MAX_RETRIES +
        1})`
    );

    // Set up timeout for this attempt
    loadTimeout = setTimeout(() => {
      const timeoutMessage =
        retryCount < MAX_RETRIES
          ? `Module load timeout (attempt ${retryCount + 1}), retrying...`
          : "Game client failed to load within expected time. This may be due to a slow connection or server issue.";

      if (retryCount < MAX_RETRIES) {
        console.warn(`[AppInit] ${timeoutMessage}`);
        setTimeout(() => loadMainModule(retryCount + 1), RETRY_DELAY_MS);
      } else {
        handleModuleLoadFailure(new Error("Load timeout"), retryCount);
      }
    }, LOAD_TIMEOUT_MS);

    // Attempt dynamic import
    try {
      import("../main.js")
        .then(() => {
          handleModuleLoadSuccess();
        })
        .catch(error => {
          if (retryCount < MAX_RETRIES) {
            console.warn(
              `[AppInit] Module load failed (attempt ${retryCount +
                1}), retrying:`,
              error
            );
            setTimeout(() => loadMainModule(retryCount + 1), RETRY_DELAY_MS);
          } else {
            handleModuleLoadFailure(error, retryCount);
          }
        });
    } catch (error) {
      console.error("[AppInit] Import statement failed:", error);
      handleModuleLoadFailure(error, retryCount);
    }
  }

  /**
   * Initializes the application
   */
  function initializeApplication() {
    console.log("[AppInit] Starting application initialization");

    // Check network connectivity
    if ("onLine" in navigator && !navigator.onLine) {
      const errorMessage =
        "You appear to be offline. Please check your internet connection and try again.";

      if (window.DGameLaunchErrorHandler) {
        window.DGameLaunchErrorHandler.showError(errorMessage);
      } else {
        alert(`Network Error: ${errorMessage}`);
      }
      return;
    }

    // Load main module directly - let the browser handle compatibility naturally
    loadMainModule();
  }

  /**
   * Handles page load event
   */
  function handlePageLoad() {
    console.log("[AppInit] Page load event received");

    // Clear any existing timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }

    // Small delay to ensure error handler is ready
    setTimeout(initializeApplication, 100);
  }

  /**
   * Handles page visibility changes
   */
  function handleVisibilityChange() {
    if (!document.hidden) {
      console.log("[AppInit] Page became visible");

      // If we haven't loaded successfully yet and page becomes visible, retry
      if (
        !moduleLoadAttempted ||
        window.DGameLaunchErrorHandler?.isErrorDisplayed()
      ) {
        console.log(
          "[AppInit] Retrying initialization due to visibility change"
        );
        moduleLoadAttempted = false;
        initializeApplication();
      }
    }
  }

  /**
   * Sets up initialization event listeners
   */
  function setupEventListeners() {
    // Handle page load
    if (document.readyState === "loading") {
      window.addEventListener("load", handlePageLoad);
    } else {
      // Document already loaded
      setTimeout(handlePageLoad, 0);
    }

    // Handle visibility changes for retry scenarios
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Handle focus events for retry scenarios
    window.addEventListener("focus", () => {
      if (window.DGameLaunchErrorHandler?.isErrorDisplayed()) {
        console.log(
          "[AppInit] Window focused with error displayed, offering retry"
        );
      }
    });
  }

  // Initialize when script loads
  setupEventListeners();

  console.log("[AppInit] Application initializer loaded");
})();
