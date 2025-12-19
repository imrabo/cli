package main

import (
	"log"

	"github.com/imrabo/runtime/internal/logging"
	"github.com/imrabo/runtime/internal/server"
)

func main() {
	if err := logging.Init(); err != nil {
		log.Fatalf("Failed to initialize logging: %v", err)
	}

	srv := server.NewServer()

	logging.Info("main", "Starting imrabo runtime...")
	if err := srv.Start(); err != nil {
		logging.Error("main", "Failed to start server: "+err.Error())
		log.Fatal(err)
	}
}
