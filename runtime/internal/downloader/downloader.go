package downloader

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/imrabo/runtime/internal/cache"
	"github.com/imrabo/runtime/internal/config"
	"github.com/imrabo/runtime/internal/registry"
)

func Download(modelID string, variant *registry.Variant) error {
	// Check disk space
	freeSpace, _ := config.GetAvailableDiskSpaceGB()
	requiredSpace := uint64(variant.SizeGB) + 1 // 1GB Buffer
	if freeSpace < requiredSpace {
		return fmt.Errorf("insufficient disk space: need %d GB, have %d GB", requiredSpace, freeSpace)
	}

	destDir := cache.GetModelPath(modelID, variant.ID)
	if err := cache.EnsureModelDir(modelID, variant.ID); err != nil {
		return err
	}

	destFile := filepath.Join(destDir, "model.tar.gz")

	// Check if already exists (simplified)
	if _, err := os.Stat(destFile); err == nil {
		fmt.Printf("Model %s/%s already exists in cache\n", modelID, variant.ID)
		return nil
	}

	fmt.Printf("Downloading model %s (%s) to %s...\n", modelID, variant.ID, destFile)

	resp, err := http.Get(variant.URL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download model: %s", resp.Status)
	}

	out, err := os.Create(destFile)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		out.Close()
		os.Remove(destFile)
		return err
	}
	out.Close()

	// Verify Checksum
	if variant.Checksum != "" {
		fmt.Printf("Verifying checksum for %s...\n", modelID)
		if err := cache.VerifyChecksum(destFile, variant.Checksum); err != nil {
			os.Remove(destFile)
			return err
		}
	}

	// Save Metadata
	return cache.SaveMetadata(&cache.ModelMetadata{
		ModelID:  modelID,
		Variant:  variant.ID,
		Checksum: variant.Checksum,
		Path:     destFile,
	})
}
