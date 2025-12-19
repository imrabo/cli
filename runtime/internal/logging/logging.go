package logging

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/imrabo/runtime/internal/config"
)

type Level string

const (
	LevelInfo  Level = "INFO"
	LevelWarn  Level = "WARN"
	LevelError Level = "ERROR"
)

type LogEntry struct {
	Timestamp string `json:"ts"`
	Level     Level  `json:"level"`
	Module    string `json:"module"`
	Message   string `json:"msg"`
	RequestID string `json:"request_id,omitempty"`
}

type Logger struct {
	mu   sync.Mutex
	file *os.File
}

var globalLogger *Logger

func Init() error {
	dataDir := config.GetDataDir()
	logFile := filepath.Join(dataDir, "runtime.log")

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	globalLogger = &Logger{
		file: f,
	}
	return nil
}

func Log(level Level, module, msg string, requestID string) {
	if globalLogger == nil {
		fmt.Printf("[%s] %s: %s\n", level, module, msg)
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     level,
		Module:    module,
		Message:   msg,
		RequestID: requestID,
	}

	data, _ := json.Marshal(entry)

	globalLogger.mu.Lock()
	defer globalLogger.mu.Unlock()

	globalLogger.file.Write(data)
	globalLogger.file.Write([]byte("\n"))

	// Also print to stdout for dev visibility
	fmt.Printf("%s\n", string(data))
}

func Info(module, msg string)  { Log(LevelInfo, module, msg, "") }
func Warn(module, msg string)  { Log(LevelWarn, module, msg, "") }
func Error(module, msg string) { Log(LevelError, module, msg, "") }

func RequestInfo(module, reqID, msg string) { Log(LevelInfo, module, msg, reqID) }
