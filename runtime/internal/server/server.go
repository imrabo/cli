package server

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/imrabo/runtime/internal/capabilities"
	"github.com/imrabo/runtime/internal/config"
	"github.com/imrabo/runtime/internal/downloader"
	"github.com/imrabo/runtime/internal/lifecycle"
	"github.com/imrabo/runtime/internal/logging"
	"github.com/imrabo/runtime/internal/registry"
	"github.com/imrabo/runtime/internal/status"
)

type Server struct {
	addr string
	ln   net.Listener
}

func NewServer() *Server {
	return &Server{}
}

func (s *Server) Start() error {
	// Bind to 127.0.0.1:<random-free-port>
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	s.ln = ln
	s.addr = ln.Addr().String()

	// Extract port from addr (e.g., "127.0.0.1:1234")
	parts := strings.Split(s.addr, ":")
	port := parts[len(parts)-1]

	// Generate token
	token := status.GenerateToken()

	// Lock and store port/PID/Token
	if err := lifecycle.LockAndStore(port, token); err != nil {
		return err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth) // Public

	// Protected endpoints
	mux.Handle("/status", s.authMiddleware(http.HandlerFunc(s.handleStatus)))
	mux.Handle("/run", s.authMiddleware(http.HandlerFunc(s.handleRun)))
	mux.Handle("/shutdown", s.authMiddleware(http.HandlerFunc(s.handleShutdown)))

	status.Set(status.StateReady)
	logging.Info("server", fmt.Sprintf("Runtime API listening on %s", s.addr))

	return http.Serve(ln, mux)
}

func (s *Server) Addr() string {
	return s.addr
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	caps, _ := capabilities.Detect()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       status.GetCurrent(),
		"version":      status.Version,
		"reason":       status.GetReason(),
		"capabilities": caps,
	})
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	if status.GetCurrent() != status.StateReady {
		if status.GetCurrent() == status.StateError {
			if status.Recover() {
				// State is now INIT (or READY if we moved it), let it proceed or re-fail predictably
				status.Set(status.StateReady)
			}
		}

		if status.GetCurrent() == status.StateBusy {
			http.Error(w, "Runtime is busy", http.StatusTooManyRequests)
		} else if status.GetCurrent() == status.StateError {
			http.Error(w, fmt.Sprintf("Runtime error: %s", status.GetReason()), http.StatusInternalServerError)
		} else {
			http.Error(w, fmt.Sprintf("Runtime not ready (state: %s)", status.GetCurrent()), http.StatusServiceUnavailable)
		}
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Input string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 1. Detect capabilities
	reqID := fmt.Sprintf("req_%d", time.Now().UnixNano())
	logging.RequestInfo("server", reqID, "Received run request")

	caps, err := capabilities.Detect()
	if err != nil {
		http.Error(w, fmt.Sprintf("Capability detection failed: %v", err), http.StatusInternalServerError)
		return
	}

	// 2. Fetch registry (using local signed test registry)
	// In production, this would be a remote URL
	dataDir := config.GetDataDir()
	regPath := filepath.Join(filepath.Dir(dataDir), "imrabo-cli", "registry", "registry_signed.json")

	// Create a dummy server or just mock the fetch for this demo
	// Actually, let's just read it directly and verify since Fetch uses http.Get
	regData, err := os.ReadFile(regPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read registry: %v", err), http.StatusInternalServerError)
		return
	}

	var reg registry.Registry
	if err := json.Unmarshal(regData, &reg); err != nil {
		http.Error(w, fmt.Sprintf("Registry decode failed: %v", err), http.StatusInternalServerError)
		return
	}

	if err := reg.Verify(); err != nil {
		http.Error(w, fmt.Sprintf("Registry verification failed: %v", err), http.StatusForbidden)
		return
	}

	// 3. Match model
	variant, err := registry.Match(&reg, caps)
	if err != nil {
		http.Error(w, fmt.Sprintf("Model match failed: %v", err), http.StatusNotFound)
		return
	}

	// 4. Download stub (skip actual download for this demo if URL is dummy)
	logging.RequestInfo("server", reqID, fmt.Sprintf("Matched variant: %s", variant.ID))
	status.Set(status.StateBusy)
	defer status.Set(status.StateReady)

	if variant.URL != "https://example.com/model.tar.gz" {
		if err := downloader.Download("base", variant); err != nil {
			http.Error(w, fmt.Sprintf("Download failed: %v", err), http.StatusInternalServerError)
			return
		}
	}

	// 5. Execution stub
	time.Sleep(2 * time.Second)
	output := fmt.Sprintf("imrabo processed: '%s' using model 'base/%s' on %s", req.Input, variant.ID, caps.OS)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": output})
}

func (s *Server) handleShutdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status.Set(status.StateShuttingDown)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "shutting down"})

	go func() {
		lifecycle.Cleanup()
		os.Exit(0)
	}()
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Imrabo-Token")
		if !status.ValidateToken(token) {
			logging.Warn("auth", fmt.Sprintf("Unauthorized access attempt. Provided: %s, Expected: %s", token, status.GetToken()))
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
