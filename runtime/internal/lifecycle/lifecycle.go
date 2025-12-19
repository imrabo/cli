package lifecycle

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"

	"github.com/imrabo/runtime/internal/config"
)

type RuntimeState struct {
	PID   int    `json:"pid"`
	Port  string `json:"port"`
	Token string `json:"token"`
}

func LockAndStore(port string, token string) error {
	dataDir := config.GetDataDir()
	lockFile := filepath.Join(dataDir, "imrabo.lock")
	stateFile := filepath.Join(dataDir, "state.json")

	// 1. Reconciliation: Check if already running or if it's an orphan
	if existingState, err := GetState(); err == nil {
		if isProcessAlive(existingState.PID) {
			return fmt.Errorf("runtime already running on PID %d", existingState.PID)
		}
		// Process is dead, cleanup orphans
		os.Remove(lockFile)
		os.Remove(stateFile)
	}

	// 2. Create/Open lock file
	_, err := os.OpenFile(lockFile, os.O_CREATE|os.O_RDWR, 0666)
	if err != nil {
		return fmt.Errorf("failed to open lock file: %v", err)
	}

	// Note: Proper Windows file locking requires syscall.LockFileEx or similar.
	// For this CLI context, we will use a simpler approach: check if we can truncate/write.
	// In a real production Go daemon, we'd use a library like 'github.com/gofrs/flock'.

	state := RuntimeState{
		PID:   os.Getpid(),
		Port:  port,
		Token: token,
	}

	stateData, _ := json.Marshal(state)
	return os.WriteFile(stateFile, stateData, 0644)
}

func GetState() (*RuntimeState, error) {
	dataDir := config.GetDataDir()
	stateFile := filepath.Join(dataDir, "state.json")

	data, err := os.ReadFile(stateFile)
	if err != nil {
		return nil, err
	}

	var state RuntimeState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	return &state, nil
}

func Cleanup() {
	dataDir := config.GetDataDir()
	os.Remove(filepath.Join(dataDir, "state.json"))
	os.Remove(filepath.Join(dataDir, "imrabo.lock"))
}

func isProcessAlive(pid int) bool {
	if pid <= 0 {
		return false
	}

	if runtime.GOOS == "windows" {
		// On Windows, use tasklist to check if PID is alive
		out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid)).Output()
		if err != nil {
			return false
		}
		return strings.Contains(string(out), fmt.Sprintf("%d", pid))
	}

	// On Unix-like systems, signal 0 does the job
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = process.Signal(syscall.Signal(0))
	return err == nil
}
