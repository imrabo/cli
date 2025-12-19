package config

import (
	"os"
	"path/filepath"
)

func GetDataDir() string {
	// For Windows, it's %LOCALAPPDATA%\imrabo
	// env-paths equivalent for Go: os.UserConfigDir() or os.Getenv("LOCALAPPDATA")
	dataDir := os.Getenv("LOCALAPPDATA")
	if dataDir == "" {
		// Fallback for other OS if needed, but we focus on Windows first
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, ".imrabo")
	} else {
		dataDir = filepath.Join(dataDir, "imrabo")
	}
	
	os.MkdirAll(dataDir, 0755)
	return dataDir
}
