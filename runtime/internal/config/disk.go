package config

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// GetAvailableDiskSpaceGB returns free space in GB
func GetAvailableDiskSpaceGB() (uint64, error) {
	if runtime.GOOS == "windows" {
		// Use PowerShell as wmic is deprecated
		out, err := exec.Command("powershell", "-Command", "(Get-PSDrive C).Free").Output()
		if err != nil {
			return 0, err
		}
		line := strings.TrimSpace(string(out))
		bytes, err := strconv.ParseUint(line, 10, 64)
		if err == nil {
			return bytes / (1024 * 1024 * 1024), nil
		}
	} else {
		// Unix: df -B1 / | tail -1 | awk '{print $4}'
		out, err := exec.Command("df", "-B1", "/").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			if len(lines) >= 2 {
				fields := strings.Fields(lines[1])
				if len(fields) >= 4 {
					bytes, err := strconv.ParseUint(fields[3], 10, 64)
					if err == nil {
						return bytes / (1024 * 1024 * 1024), nil
					}
				}
			}
		}
	}
	return 10, fmt.Errorf("could not determine disk space, defaulting to 10GB")
}
