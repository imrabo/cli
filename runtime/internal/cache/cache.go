package cache

import (
	"os"
	"path/filepath"

	"github.com/imrabo/runtime/internal/config"
)

func GetModelsDir() string {
	dataDir := config.GetDataDir()
	modelsDir := filepath.Join(dataDir, "models")
	os.MkdirAll(modelsDir, 0755)
	return modelsDir
}

func GetModelPath(modelID string, variantID string) string {
	return filepath.Join(GetModelsDir(), modelID, variantID)
}

func EnsureModelDir(modelID string, variantID string) error {
	path := GetModelPath(modelID, variantID)
	return os.MkdirAll(path, 0755)
}
