package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
)

type Model struct {
	ID           string `json:"id"`
	Requirements struct {
		RAMGB int      `json:"ram_gb"`
		Arch  []string `json:"arch"`
	} `json:"requirements"`
	Variants []struct {
		ID       string  `json:"id"`
		URL      string  `json:"url"`
		SizeGB   float64 `json:"size_gb"`
		Checksum string  `json:"checksum"`
	} `json:"variants"`
}

type Registry struct {
	Version string  `json:"version"`
	Models  []Model `json:"models"`
}

func main() {
	privHex := "fd4617278a6b6f1dbad2a6b7a947ee6cdf0472ab8cdb6ab16a05689106a7380446943cef908ca8455ab41a9fb9a77025a9b5d4b46e7918318a79a293fd8bccd1"
	priv, _ := hex.DecodeString(privHex)

	reg := Registry{
		Version: "1.0",
		Models: []Model{
			{
				ID: "base",
				Requirements: struct {
					RAMGB int      `json:"ram_gb"`
					Arch  []string `json:"arch"`
				}{RAMGB: 4, Arch: []string{"amd64", "arm64"}},
				Variants: []struct {
					ID       string  `json:"id"`
					URL      string  `json:"url"`
					SizeGB   float64 `json:"size_gb"`
					Checksum string  `json:"checksum"`
				}{
					{ID: "cpu", URL: "https://example.com/model.large.tar.gz", SizeGB: 1000.0, Checksum: "sha256:123"},
				},
			},
		},
	}

	content, _ := json.Marshal(reg)
	sig := ed25519.Sign(priv, content)

	final := struct {
		Registry
		Signature string `json:"signature"`
	}{
		Registry:  reg,
		Signature: hex.EncodeToString(sig),
	}

	out, _ := json.MarshalIndent(final, "", "  ")
	os.WriteFile("registry/registry_signed.json", out, 0644)
	fmt.Println("Signed registry written to registry/registry_signed.json")
}
