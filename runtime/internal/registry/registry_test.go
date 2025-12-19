package registry

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/imrabo/runtime/internal/capabilities"
)

func TestMatch(t *testing.T) {
	data, err := os.ReadFile("../../../registry/registry.json")
	if err != nil {
		t.Fatalf("Failed to read test registry: %v", err)
	}

	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		t.Fatalf("Failed to unmarshal test registry: %v", err)
	}

	tests := []struct {
		name    string
		caps    *capabilities.Capability
		wantErr bool
	}{
		{
			name:    "Compatible Windows",
			caps:    &capabilities.Capability{OS: "windows", Arch: "amd64", RAM: 8},
			wantErr: false,
		},
		{
			name:    "Incompatible RAM",
			caps:    &capabilities.Capability{OS: "windows", Arch: "amd64", RAM: 2},
			wantErr: true,
		},
		{
			name:    "Incompatible Arch",
			caps:    &capabilities.Capability{OS: "windows", Arch: "386", RAM: 8},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Match(&reg, tt.caps)
			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got == nil {
				t.Error("Match() got nil variant, want non-nil")
			}
		})
	}
}
