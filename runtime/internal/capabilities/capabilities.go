package capabilities

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

type Capability struct {
	OS   string `json:"os"`
	Arch string `json:"arch"`
	RAM  int    `json:"ram_gb"`
}

func Detect() (*Capability, error) {
	ramGB := getTotalRAM()

	return &Capability{
		OS:   runtime.GOOS,
		Arch: runtime.GOARCH,
		RAM:  ramGB,
	}, nil
}

func getTotalRAM() int {
	switch runtime.GOOS {
	case "windows":
		// Using wmic or systeminfo is slow, but available.
		// "wmic computersystem get TotalPhysicalMemory"
		out, err := exec.Command("wmic", "computersystem", "get", "TotalPhysicalMemory").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(strings.ToLower(line), "total") {
					continue
				}
				bytes, err := strconv.ParseUint(line, 10, 64)
				if err == nil {
					return int(bytes / (1024 * 1024 * 1024))
				}
			}
		}
	case "darwin":
		out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
		if err == nil {
			bytes, err := strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
			if err == nil {
				return int(bytes / (1024 * 1024 * 1024))
			}
		}
	case "linux":
		out, err := os.ReadFile("/proc/meminfo")
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "MemTotal:") {
					parts := strings.Fields(line)
					if len(parts) >= 2 {
						kb, _ := strconv.ParseUint(parts[1], 10, 64)
						return int(kb / (1024 * 1024))
					}
				}
			}
		}
	}
	return 8 // Fallback
}

func (c *Capability) String() string {
	return fmt.Sprintf("OS: %s, Arch: %s, RAM: %dGB", c.OS, c.Arch, c.RAM)
}
