package status

import (
	"sync"
)

type State string

const (
	StateInit         State = "INIT"
	StateReady        State = "READY"
	StateBusy         State = "BUSY"
	StateError        State = "ERROR"
	StateShuttingDown State = "SHUTTING_DOWN"
)

const Version = "0.1.0"

type Manager struct {
	mu      sync.RWMutex
	current State
	reason  string
}

var globalManager = &Manager{
	current: StateInit,
}

func GetCurrent() State {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()
	return globalManager.current
}

func GetReason() string {
	globalManager.mu.RLock()
	defer globalManager.mu.RUnlock()
	return globalManager.reason
}

func Set(s State) {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()
	globalManager.current = s
	if s != StateError {
		globalManager.reason = ""
	}
}

func SetError(reason string) {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()
	globalManager.current = StateError
	globalManager.reason = reason
}

func Recover() bool {
	globalManager.mu.Lock()
	defer globalManager.mu.Unlock()
	if globalManager.current != StateError {
		return true
	}

	// Basic recovery check: can we still see the system capabilities?
	// In a real impl, we'd check more here.
	globalManager.current = StateInit
	globalManager.reason = "recovered from error"
	return true
}
