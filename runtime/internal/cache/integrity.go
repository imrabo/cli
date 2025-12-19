package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type ModelMetadata struct {
	ModelID  string `json:"model_id"`
	Variant  string `json:"variant_id"`
	Checksum string `json:"checksum"`
	Path     string `json:"path"`
}

func SaveMetadata(m *ModelMetadata) error {
	path := filepath.Join(GetModelPath(m.ModelID, m.Variant), "metadata.json")
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func VerifyChecksum(filePath, expectedChecksum string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}

	actualChecksum := "sha256:" + hex.EncodeToString(h.Sum(nil))
	if actualChecksum != expectedChecksum {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedChecksum, actualChecksum)
	}

	return nil
}
