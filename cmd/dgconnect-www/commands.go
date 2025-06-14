package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/opd-ai/go-gamelaunch-client/pkg/dgclient"
	"github.com/opd-ai/go-gamelaunch-www/pkg/webui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
	"golang.org/x/term"
)

func runConnect(cmd *cobra.Command, args []string) error {
	var host, user string
	var actualPort int

	// Parse connection string or use config
	if len(args) > 0 {
		if err := parseConnectionString(args[0], &user, &host); err != nil {
			return err
		}
		actualPort = port // Use command line port
	} else {
		// Try to use default server from config
		defaultServer := viper.GetString("default_server")
		if defaultServer == "" {
			return fmt.Errorf("no server specified and no default_server in config")
		}

		serverConfig, err := GetServerConfig(defaultServer)
		if err != nil {
			return err
		}

		host = serverConfig.Host
		user = serverConfig.Username
		actualPort = serverConfig.Port
		if actualPort == 0 {
			actualPort = 22
		}
	}

	// Validate required parameters
	if host == "" {
		return fmt.Errorf("host is required")
	}
	if user == "" {
		return fmt.Errorf("username is required")
	}

	// Create WebView for the web interface
	viewOpts := dgclient.DefaultViewOptions()
	webView, err := webui.NewWebView(viewOpts)
	if err != nil {
		return fmt.Errorf("failed to create web view: %w", err)
	}

	// Load tileset if specified
	var tilesetConfig *webui.TilesetConfig
	if tilesetPath != "" {
		tilesetConfig, err = webui.LoadTilesetConfig(tilesetPath)
		if err != nil {
			return fmt.Errorf("failed to load tileset: %w", err)
		}
	}

	// Create WebUI server
	webUIOptions := webui.WebUIOptions{
		View:         webView,
		TilesetPath:  tilesetPath,
		Tileset:      tilesetConfig,
		ListenAddr:   fmt.Sprintf(":%d", webPort),
		PollTimeout:  30 * time.Second,
		AllowOrigins: []string{}, // Allow all origins for simplicity
	}

	webServer, err := webui.NewWebUI(webUIOptions)
	if err != nil {
		return fmt.Errorf("failed to create web server: %w", err)
	}

	// Create dgclient in a separate goroutine
	go func() {
		if err := runDGClient(host, user, actualPort, webView); err != nil {
			log.Printf("dgclient error: %v", err)
		}
	}()

	// Set up signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("\nReceived interrupt signal, shutting down...")
		cancel()
	}()

	// Start the web server
	fmt.Printf("Starting web server on :%d\n", webPort)
	fmt.Printf("Connect to http://localhost:%d to play games\n", webPort)
	fmt.Printf("Game server: %s@%s:%d\n", user, host, actualPort)

	return webServer.StartWithContext(ctx, fmt.Sprintf(":%d", webPort))
}

// runDGClient handles the dgclient connection in a separate goroutine
func runDGClient(host, user string, actualPort int, view *webui.WebView) error {
	// Create client configuration
	clientConfig := dgclient.DefaultClientConfig()
	clientConfig.Debug = debug

	// Set up SSH client config
	sshConfig := &ssh.ClientConfig{
		User:            user,
		HostKeyCallback: getHostKeyCallback(),
		Timeout:         clientConfig.ConnectTimeout,
	}
	clientConfig.SSHConfig = sshConfig

	// Create client
	client := dgclient.NewClient(clientConfig)
	defer client.Close()

	// Set the WebView on the client
	if err := client.SetView(view); err != nil {
		return fmt.Errorf("failed to set view: %w", err)
	}

	// Get authentication method
	auth, err := getAuthMethod(user, host)
	if err != nil {
		return fmt.Errorf("failed to get authentication method: %w", err)
	}

	// Connect to game server
	fmt.Printf("Connecting to %s@%s:%d...\n", user, host, actualPort)
	if err := client.Connect(host, actualPort, auth); err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	fmt.Println("Connected to game server successfully!")

	// Set up context for client management
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Launch game if specified
	if gameName != "" {
		if err := client.SelectGame(gameName); err != nil {
			fmt.Printf("Warning: failed to select game %s: %v\n", gameName, err)
		}
	}

	// Run the client
	if err := client.Run(ctx); err != nil {
		return fmt.Errorf("client error: %w", err)
	}

	return nil
}

func parseConnectionString(conn string, user, host *string) error {
	parts := strings.Split(conn, "@")
	if len(parts) == 2 {
		*user = parts[0]
		*host = parts[1]
	} else if len(parts) == 1 {
		*host = parts[0]
		*user = os.Getenv("USER")
		if *user == "" {
			return fmt.Errorf("no username specified and USER environment variable not set")
		}
	} else {
		return fmt.Errorf("invalid connection string: %s", conn)
	}
	return nil
}

func getAuthMethod(user, host string) (dgclient.AuthMethod, error) {
	// Priority: command line flag > config > SSH agent > default keys > password prompt

	if password != "" {
		return dgclient.NewPasswordAuth(password), nil
	}

	if keyPath != "" {
		return dgclient.NewKeyAuth(keyPath, ""), nil
	}

	// Check config for auth method
	defaultServer := viper.GetString("default_server")
	if defaultServer != "" {
		serverConfig, err := GetServerConfig(defaultServer)
		if err == nil {
			switch serverConfig.Auth.Method {
			case "key":
				if serverConfig.Auth.KeyPath != "" {
					return dgclient.NewKeyAuth(expandPath(serverConfig.Auth.KeyPath), serverConfig.Auth.Passphrase), nil
				}
			case "password":
				// Will fall through to password prompt
			case "agent":
				if os.Getenv("SSH_AUTH_SOCK") != "" {
					return dgclient.NewAgentAuth(), nil
				}
			}
		}
	}

	// Try SSH agent
	if os.Getenv("SSH_AUTH_SOCK") != "" {
		return dgclient.NewAgentAuth(), nil
	}

	// Try default key locations
	home, _ := os.UserHomeDir()
	defaultKeys := []string{
		fmt.Sprintf("%s/.ssh/id_rsa", home),
		fmt.Sprintf("%s/.ssh/id_ed25519", home),
		fmt.Sprintf("%s/.ssh/id_ecdsa", home),
	}

	for _, keyPath := range defaultKeys {
		if _, err := os.Stat(keyPath); err == nil {
			return dgclient.NewKeyAuth(keyPath, ""), nil
		}
	}

	// Fall back to password prompt
	fmt.Printf("Password for %s@%s: ", user, host)
	passwordBytes, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil {
		return nil, fmt.Errorf("failed to read password: %w", err)
	}

	return dgclient.NewPasswordAuth(string(passwordBytes)), nil
}

func getHostKeyCallback() ssh.HostKeyCallback {
	// Try to use known_hosts file first
	home, err := os.UserHomeDir()
	if err != nil {
		if debug {
			fmt.Printf("Warning: Could not get home directory: %v\n", err)
		}
		return createInsecureCallback()
	}

	knownHostsPath := fmt.Sprintf("%s/.ssh/known_hosts", home)
	if _, err := os.Stat(knownHostsPath); err != nil {
		if debug {
			fmt.Printf("Warning: known_hosts file not found at %s, using insecure callback\n", knownHostsPath)
		}
		return createInsecureCallback()
	}

	// Use known_hosts for verification
	hostKeyCallback, err := knownhosts.New(knownHostsPath)
	if err != nil {
		if debug {
			fmt.Printf("Warning: Failed to load known_hosts: %v, using insecure callback\n", err)
		}
		return createInsecureCallback()
	}

	// Wrap the callback to provide better error messages and handle unknown hosts
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := hostKeyCallback(hostname, remote, key)
		if err != nil {
			// Check if this is an unknown host error
			if keyErr, ok := err.(*knownhosts.KeyError); ok && len(keyErr.Want) == 0 {
				// Unknown host - prompt user
				fmt.Printf("\nWarning: Unknown host %s\n", hostname)
				fmt.Printf("Host key fingerprint: %s\n", ssh.FingerprintSHA256(key))
				fmt.Print("Do you want to continue connecting? (yes/no): ")

				var response string
				fmt.Scanln(&response)

				if response == "yes" || response == "y" {
					// Add to known_hosts
					if addErr := addToKnownHosts(knownHostsPath, hostname, key); addErr != nil {
						fmt.Printf("Warning: Could not add host to known_hosts: %v\n", addErr)
					} else {
						fmt.Printf("Host %s added to known_hosts\n", hostname)
					}
					return nil
				}
				return fmt.Errorf("host key verification failed: user rejected unknown host")
			}

			// Host key mismatch or other error
			if keyErr, ok := err.(*knownhosts.KeyError); ok && len(keyErr.Want) > 0 {
				fmt.Printf("\nHost key verification failed for %s!\n", hostname)
				fmt.Printf("Expected fingerprint: %s\n", ssh.FingerprintSHA256(keyErr.Want[0].Key))
				fmt.Printf("Received fingerprint: %s\n", ssh.FingerprintSHA256(key))
				return fmt.Errorf("host key verification failed: key mismatch")
			}

			return fmt.Errorf("host key verification failed: %w", err)
		}

		if debug {
			fmt.Printf("Host key verified for %s\n", hostname)
		}
		return nil
	}
}

func createInsecureCallback() ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		if debug {
			fmt.Printf("Warning: Using insecure host key callback for %s\n", hostname)
			fmt.Printf("Fingerprint: %s\n", ssh.FingerprintSHA256(key))
		}
		return nil
	}
}

func addToKnownHosts(knownHostsPath, hostname string, key ssh.PublicKey) error {
	f, err := os.OpenFile(knownHostsPath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	line := fmt.Sprintf("%s %s %s\n", hostname, key.Type(), base64.StdEncoding.EncodeToString(key.Marshal()))
	_, err = f.WriteString(line)
	return err
}

func expandPath(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			return strings.Replace(path, "~", home, 1)
		}
	}
	return path
}
