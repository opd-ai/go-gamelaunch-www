/**
 * @fileoverview Service worker initialization for dgamelaunch web client
 * @module scripts/service-worker-init
 * @author go-gamelaunch-client
 * @version 1.0.0
 */

(function() {
  "use strict";

  // Configuration
  const SERVICE_WORKER_URL = "/sw.js";
  const REGISTRATION_TIMEOUT = 10000; // 10 seconds

  /**
   * Registers the service worker if supported
   */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.log(
        "[ServiceWorker] Service workers not supported in this browser"
      );
      return;
    }

    console.log("[ServiceWorker] Registering service worker");

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

    Promise.race([registrationPromise, timeoutPromise])
      .then(handleRegistrationSuccess)
      .catch(handleRegistrationFailure);
  }

  /**
   * Handles successful service worker registration
   * @param {ServiceWorkerRegistration} registration - Service worker registration
   */
  function handleRegistrationSuccess(registration) {
    console.log("[ServiceWorker] Registered successfully:", registration.scope);

    // Handle registration updates
    registration.addEventListener("updatefound", () => {
      console.log(
        "[ServiceWorker] Update found, installing new service worker"
      );

      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log(
              "[ServiceWorker] New service worker installed, refresh recommended"
            );
            notifyUserOfUpdate();
          }
        });
      }
    });

    // Check for existing updates
    registration.update().catch(error => {
      console.log(
        "[ServiceWorker] Update check failed (this is normal):",
        error.message
      );
    });
  }

  /**
   * Handles service worker registration failure
   * @param {Error} error - Registration error
   */
  function handleRegistrationFailure(error) {
    console.log(
      "[ServiceWorker] Registration failed (this is optional):",
      error.message
    );

    // Don't show user-facing errors for service worker failures
    // This is a progressive enhancement feature
  }

  /**
   * Notifies user of available service worker update
   */
  function notifyUserOfUpdate() {
    // Only notify if the main application is loaded
    setTimeout(() => {
      if (
        window.DGameLaunchErrorHandler &&
        !window.DGameLaunchErrorHandler.isErrorDisplayed()
      ) {
        const shouldUpdate = confirm(
          "A new version of the game client is available. " +
            "Would you like to refresh the page to use the latest version?"
        );

        if (shouldUpdate) {
          window.location.reload();
        }
      }
    }, 2000); // Delay to allow main app to load
  }

  /**
   * Handles service worker messages
   * @param {MessageEvent} event - Message event from service worker
   */
  function handleServiceWorkerMessage(event) {
    console.log("[ServiceWorker] Message received:", event.data);

    if (event.data && event.data.type === "CACHE_UPDATED") {
      console.log("[ServiceWorker] Cache updated for:", event.data.url);
    }
  }

  /**
   * Sets up service worker event listeners
   */
  function setupServiceWorkerListeners() {
    if ("serviceWorker" in navigator) {
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );

      // Handle service worker controller changes
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[ServiceWorker] Controller changed, reloading page");
        window.location.reload();
      });
    }
  }

  /**
   * Initializes service worker functionality
   */
  function initializeServiceWorker() {
    setupServiceWorkerListeners();

    // Register service worker after page load to avoid blocking
    if (document.readyState === "loading") {
      window.addEventListener("load", registerServiceWorker);
    } else {
      // Page already loaded, register immediately but with delay
      setTimeout(registerServiceWorker, 1000);
    }
  }

  // Initialize when script loads
  initializeServiceWorker();

  console.log("[ServiceWorker] Service worker initializer loaded");
})();
