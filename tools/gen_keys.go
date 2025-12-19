package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
)

func main() {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Public Key (Hex): %s\n", hex.EncodeToString(pub))
	fmt.Printf("Private Key (Hex): %s\n", hex.EncodeToString(priv))
}
