package registry

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/imrabo/runtime/internal/capabilities"
)

const PublicKey = "46943cef908ca8455ab41a9fb9a77025a9b5d4b46e7918318a79a293fd8bccd1"

type Registry struct {
	Version   string  `json:"version"`
	Models    []Model `json:"models"`
	Signature string  `json:"signature,omitempty"`
}

type Model struct {
	ID           string       `json:"id"`
	Requirements Requirements `json:"requirements"`
	Variants     []Variant    `json:"variants"`
}

type Requirements struct {
	RAMGB int      `json:"ram_gb"`
	Arch  []string `json:"arch"`
}

type Variant struct {
	ID       string  `json:"id"`
	URL      string  `json:"url"`
	SizeGB   float64 `json:"size_gb"`
	Checksum string  `json:"checksum"`
}

func Fetch(url string) (*Registry, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch registry: %s", resp.Status)
	}

	var reg Registry
	if err := json.NewDecoder(resp.Body).Decode(&reg); err != nil {
		return nil, err
	}

	// Verify Registry Signature
	if err := reg.Verify(); err != nil {
		return nil, fmt.Errorf("registry trust failure: %v", err)
	}

	return &reg, nil
}

func (r *Registry) Verify() error {
	if r.Signature == "" {
		return fmt.Errorf("registry is unsigned")
	}

	sig, err := hex.DecodeString(r.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature format: %v", err)
	}

	pub, _ := hex.DecodeString(PublicKey)

	// Create canonical content for verification (Version + Models)
	content, err := json.Marshal(struct {
		Version string  `json:"version"`
		Models  []Model `json:"models"`
	}{
		Version: r.Version,
		Models:  r.Models,
	})
	if err != nil {
		return err
	}

	if !ed25519.Verify(pub, content, sig) {
		return fmt.Errorf("registry signature verification failed")
	}

	return nil
}

func Match(reg *Registry, caps *capabilities.Capability) (*Variant, error) {
	for _, m := range reg.Models {
		// Simplified: match 'base' model for now or first compatible
		if caps.RAM < m.Requirements.RAMGB {
			continue
		}

		archMatch := false
		for _, a := range m.Requirements.Arch {
			if a == caps.Arch {
				archMatch = true
				break
			}
		}

		if !archMatch {
			continue
		}

		// Match variant (e.g., cpu vs gpu - currently CPU only per spec variants)
		if len(m.Variants) > 0 {
			return &m.Variants[0], nil
		}
	}

	return nil, fmt.Errorf("no compatible model found for %s", caps)
}
