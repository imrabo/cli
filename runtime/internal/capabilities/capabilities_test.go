package capabilities

import (
	"testing"
)

func TestDetect(t *testing.T) {
	cap, err := Detect()
	if err != nil {
		t.Fatalf("Failed to detect capabilities: %v", err)
	}

	t.Logf("Detected: %s", cap)

	if cap.OS == "" {
		t.Error("OS should not be empty")
	}
	if cap.Arch == "" {
		t.Error("Arch should not be empty")
	}
	if cap.RAM <= 0 {
		t.Error("RAM should be greater than 0")
	}
}
