package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// Config represents the configuration file structure
type Config struct {
	DefaultServer string                  `yaml:"default_server,omitempty"`
	Servers       map[string]ServerConfig `yaml:"servers"`
	Preferences   PreferencesConfig       `yaml:"preferences,omitempty"`
}

// ServerConfig represents a server configuration
type ServerConfig struct {
	Host        string     `yaml:"host"`
	Port        int        `yaml:"port,omitempty"`
	Username    string     `yaml:"username"`
	Auth        AuthConfig `yaml:"auth"`
	DefaultGame string     `yaml:"default_game,omitempty"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Method     string `yaml:"method"` // password, key, agent
	KeyPath    string `yaml:"key_path,omitempty"`
	Passphrase string `yaml:"passphrase,omitempty"`
}

// PreferencesConfig represents user preferences
type PreferencesConfig struct {
	Terminal          string `yaml:"terminal,omitempty"`
	ReconnectAttempts int    `yaml:"reconnect_attempts,omitempty"`
	ReconnectDelay    string `yaml:"reconnect_delay,omitempty"`
	KeepAliveInterval string `yaml:"keepalive_interval,omitempty"`
	ColorEnabled      bool   `yaml:"color_enabled"`
	UnicodeEnabled    bool   `yaml:"unicode_enabled"`
}

// LoadConfig loads configuration from file
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// SaveConfig saves configuration to file
func SaveConfig(config *Config, path string) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// GenerateExampleConfig creates an example configuration file
func GenerateExampleConfig() *Config {
	return &Config{
		DefaultServer: "nethack-server",
		Servers: map[string]ServerConfig{
			"nethack-server": {
				Host:     "nethack.example.com",
				Port:     2022,
				Username: "player1",
				Auth: AuthConfig{
					Method:  "key",
					KeyPath: "~/.ssh/dgamelaunch_rsa",
				},
				DefaultGame: "nethack",
			},
			"dcss-server": {
				Host:     "crawl.example.com",
				Port:     22,
				Username: "crawler",
				Auth: AuthConfig{
					Method: "password",
				},
			},
			"local-test": {
				Host:     "localhost",
				Port:     22,
				Username: os.Getenv("USER"),
				Auth: AuthConfig{
					Method: "agent",
				},
			},
		},
		Preferences: PreferencesConfig{
			Terminal:          "xterm-256color",
			ReconnectAttempts: 3,
			ReconnectDelay:    "5s",
			KeepAliveInterval: "30s",
			ColorEnabled:      true,
			UnicodeEnabled:    true,
		},
	}
}

// ValidateConfig checks if a configuration is valid
func ValidateConfig(config *Config) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}

	if len(config.Servers) == 0 {
		return fmt.Errorf("no servers configured")
	}

	for name, server := range config.Servers {
		if server.Host == "" {
			return fmt.Errorf("server '%s' has no host configured", name)
		}
		if server.Username == "" {
			return fmt.Errorf("server '%s' has no username configured", name)
		}
		if server.Auth.Method == "" {
			return fmt.Errorf("server '%s' has no auth method configured", name)
		}
		if server.Auth.Method == "key" && server.Auth.KeyPath == "" {
			return fmt.Errorf("server '%s' uses key auth but no key_path specified", name)
		}
		if server.Port <= 0 {
			server.Port = 22 // Set default
		}
	}

	if config.DefaultServer != "" {
		if _, exists := config.Servers[config.DefaultServer]; !exists {
			return fmt.Errorf("default_server '%s' not found in servers list", config.DefaultServer)
		}
	}

	return nil
}

// GetServerConfig retrieves a server configuration by name
func GetServerConfig(name string) (*ServerConfig, error) {
	serverKey := fmt.Sprintf("servers.%s", name)
	if !viper.IsSet(serverKey) {
		return nil, fmt.Errorf("server '%s' not found in configuration", name)
	}

	var server ServerConfig
	if err := viper.UnmarshalKey(serverKey, &server); err != nil {
		return nil, fmt.Errorf("failed to parse server configuration: %w", err)
	}

	// Set defaults
	if server.Port == 0 {
		server.Port = 22
	}

	return &server, nil
}
