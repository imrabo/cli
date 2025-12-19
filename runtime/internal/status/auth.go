package status

import (
	"crypto/rand"
	"encoding/hex"
)

var apiToken string

func GenerateToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "fallback-insecure-token"
	}
	apiToken = hex.EncodeToString(b)
	return apiToken
}

func GetToken() string {
	return apiToken
}

func ValidateToken(t string) bool {
	return apiToken != "" && t == apiToken
}
