/**
 * @fileoverview Service worker initialization for dgamelaunch web client with progressive enhancement
 * @module scripts/service-worker-init
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

(function() {
  "use strict";

  // Configuration constants
  const SERVICE_WORKER_URL = "/sw.js";
  const REGISTRATION_TIMEOUT = 10000; // 10 seconds
  const UPDATE_NOTIFICATION_DELAY = 2000; // 2 seconds

  /**
   * Registers the service worker if supported by the browser with timeout handling
   * @returns {void} No return value, initiates service worker registration process
   * @throws {Error} Never throws, handles all errors through promise rejection
   * @example
   * // Internal function called automatically during initialization
   * // registerServiceWorker(); // Starts registration with timeout protection
   * @since 1.0.0
   */
  function registerServiceWorker() {
    console.debug(`[registerServiceWorker] - DEBUG: Starting service worker registration process`);
    
    if (!("serviceWorker" in navigator)) {
      console.warn(
        "[registerServiceWorker] - WARN: Service workers not supported in this browser"
      );
      return;
    }

    console.info("[registerServiceWorker] - INFO: Browser supports service workers, proceeding with registration");

    const registrationPromise = navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      {
        scope: "/"
      }
    );

    // Add timeout to registration
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Service worker registration timeout")),
        REGISTRATION_TIMEOUT
      );
    });

    console.debug(`[registerServiceWorker] - DEBUG: Racing registration against ${REGISTRATION_TIMEOUT}ms timeout`);

    Promise.race([registrationPromise, timeoutPromise])
      .then(handleRegistrationSuccess)
      .catch(handleRegistrationFailure);
  }

  /**
   * Handles successful service worker registration with update detection and monitoring
   * @param {ServiceWorkerRegistration} registration - Service worker registration object from browser
   * @returns {void} No return value, sets up registration monitoring and update detection
   * @throws {Error} Never throws, handles callback errors gracefully
   * @example
   * // Internal function called automatically on successful registration
   * // handleRegistrationSuccess(registrationObject);
   * @since 1.0.0
   */
  function handleRegistrationSuccess(registration) {
    console.debug(`[handleRegistrationSuccess] - DEBUG: Processing successful service worker registration`, registration.scope);
    
    console.info("[handleRegistrationSuccess] - INFO: Service worker registered successfully with scope:", registration.scope);

    // Handle registration updates
    registration.addEventListener("updatefound", () => {
      console.info(
        "[handleRegistrationSuccess] - INFO: Service worker update found, installing new version"
      );

      const newWorker = registration.installing;
      if (newWorker) {
        console.debug(`[handleRegistrationSuccess] - DEBUG: Setting up state change listener for new worker`);
        
        newWorker.addEventListener("statechange", () => {
          console.debug(`[handleRegistrationSuccess] - DEBUG: New worker state changed to: ${newWorker.state}`);
          
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.info(
              "[handleRegistrationSuccess] - INFO: New service worker installed and ready, notifying user"
            );
            notifyUserOfUpdate();
          }
        });
      } else {
        console.warn(`[handleRegistrationSuccess] - WARN: Update found but new worker not available`);
      }
    });

    // Check for existing updates
    registration.update().catch(error => {
      console.debug(
        `[handleRegistrationSuccess] - DEBUG: Update check failed (this is normal): ${error.message}`
      );
    });
  }

  /**
   * Handles service worker registration failure with graceful degradation
   * @param {Error} error - Registration error object with failure details
   * @returns {void} No return value, logs error information for debugging
   * @throws {Error} Never throws, designed for graceful failure handling
   * @example
   * // Internal function called automatically on registration failure
   * // handleRegistrationFailure(new Error('Network error'));
   * @since 1.0.0
   */
  function handleRegistrationFailure(error) {
    console.debug(`[handleRegistrationFailure] - DEBUG: Handling service worker registration failure`, error);
    
    console.warn(
      `[handleRegistrationFailure] - WARN: Service worker registration failed (this is optional): ${error.message}`
    );

    // Don't show user-facing errors for service worker failures
    // This is a progressive enhancement feature
    console.info(`[handleRegistrationFailure] - INFO: Application will continue without service worker functionality`);
  }

  /**
   * Notifies user of available service worker update with user confirmation dialog
   * @returns {void} No return value, displays user notification and handles response
   * @throws {Error} Never throws, handles all user interaction errors gracefully
   * @example
   * // Internal function called automatically when update is available
   * // notifyUserOfUpdate(); // Shows confirmation dialog to user
   * @since 1.0.0
   */
  function notifyUserOfUpdate() {
    console.debug(`[notifyUserOfUpdate] - DEBUG: Preparing to notify user of service worker update`);
    
    // Only notify if the main application is loaded
    setTimeout(() => {
      console.debug(`[notifyUserOfUpdate] - DEBUG: Checking if error handler is available and no errors displayed`);
      
      if (
        window.DGameLaunchErrorHandler &&
        !window.DGameLaunchErrorHandler.isErrorDisplayed()
      ) {
        console.info(`[notifyUserOfUpdate] - INFO: Showing update notification to user`);
        
        const shouldUpdate = confirm(
          "A new version of the game client is available. " +
            "Would you like to refresh the page to use the latest version?"
        );

        if (shouldUpdate) {
          console.info(`[notifyUserOfUpdate] - INFO: User accepted update, reloading page`);
          window.location.reload();
        } else {
          console.info(`[notifyUserOfUpdate] - INFO: User declined update, continuing with current version`);
        }
      } else {
        console.warn(`[notifyUserOfUpdate] - WARN: Cannot show update notification - error handler unavailable or errors displayed`);
      }
    }, UPDATE_NOTIFICATION_DELAY); // Delay to allow main app to load
  }

  /**
   * Handles service worker messages with type-specific processing and logging
   * @param {MessageEvent} event - Message event from service worker with data payload
   * @returns {void} No return value, processes message data and logs activity
   * @throws {Error} Never throws, handles malformed messages gracefully
   * @example
   * // Internal function called automatically when service worker sends messages
   * // handleServiceWorkerMessage(messageEvent);
   * @since 1.0.0
   */
  function handleServiceWorkerMessage(event) {
    console.debug(`[handleServiceWorkerMessage] - DEBUG: Received service worker message`, event.data);
    
    console.info("[handleServiceWorkerMessage] - INFO: Service worker message received:", event.data);

    if (event.data && event.data.type === "CACHE_UPDATED") {
      console.info("[handleServiceWorkerMessage] - INFO: Cache updated for resource:", event.data.url);
    } else if (event.data) {
      console.debug(`[handleServiceWorkerMessage] - DEBUG: Unknown message type: ${event.data.type}`);
    } else {
      console.warn(`[handleServiceWorkerMessage] - WARN: Received message with no data`);
    }
  }

  /**
   * Sets up service worker event listeners for messages and controller changes
   * @returns {void} No return value, configures event handling for service worker communication
   * @throws {Error} Never throws, handles event listener setup errors gracefully
   * @example
   * // Internal function called automatically during initialization
   * // setupServiceWorkerListeners(); // Configures message and controller listeners
   * @since 1.0.0
   */
  function setupServiceWorkerListeners() {
    console.debug(`[setupServiceWorkerListeners] - DEBUG: Setting up service worker event listeners`);
    
    if ("serviceWorker" in navigator) {
      console.info(`[setupServiceWorkerListeners] - INFO: Configuring service worker message and controller listeners`);
      
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );

      // Handle service worker controller changes
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.info("[setupServiceWorkerListeners] - INFO: Service worker controller changed, reloading page for consistency");
        window.location.reload();
      });
      
      console.debug(`[setupServiceWorkerListeners] - DEBUG: Service worker listeners configured successfully`);
    } else {
      console.warn(`[setupServiceWorkerListeners] - WARN: Service workers not supported, skipping listener setup`);
    }
  }

  /**
   * Initializes service worker functionality with proper timing and error handling
   * @returns {void} No return value, orchestrates complete service worker initialization
   * @throws {Error} Never throws, handles all initialization errors gracefully
   * @example
   * // Internal function called automatically when script loads
   * // initializeServiceWorker(); // Starts complete initialization process
   * @since 1.0.0
   */
  function initializeServiceWorker() {
    console.debug(`[initializeServiceWorker] - DEBUG: Starting service worker initialization process`);
    
    setupServiceWorkerListeners();

    // Register service worker after page load to avoid blocking
    if (document.readyState === "loading") {
      console.info(`[initializeServiceWorker] - INFO: Document still loading, deferring registration until load event`);
      window.addEventListener("load", registerServiceWorker);
    } else {
      console.info(`[initializeServiceWorker] - INFO: Document already loaded, scheduling delayed registration`);
      // Page already loaded, register immediately but with delay
      setTimeout(registerServiceWorker, 1000);
    }
    
    console.info(`[initializeServiceWorker] - INFO: Service worker initialization scheduled successfully`);
  }

  // Initialize when script loads
  console.debug(`[ServiceWorkerInit] - DEBUG: Service worker initializer script executing`);
  initializeServiceWorker();

  console.info("[ServiceWorkerInit] - INFO: Service worker initializer loaded and started");
})();
