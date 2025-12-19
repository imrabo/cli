# @imrabo/cli

The elegant, TypeScript command-line interface for the **imrabo** local AI runtime platform.

## Features

- **Runtime Monitoring**: `imrabo status` provides a stateful view of the local daemon.
- **Deep Diagnostics**: `imrabo doctor` checks RAM, disk, and model integrity.
- **Zero-Config Inference**: `imrabo run "input"` automatically manages the runtime and models.
- **Security**: Mandatory Ed25519 signature verification for model manifests.

## Installation

```bash
npm install -g @imrabo/cli
```

## Usage

### 1. Check System Health
```bash
imrabo doctor
```

### 2. Run a Task
```bash
imrabo run "summarize this article"
```

### 3. Check Status
```bash
imrabo status
```

## Development

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Build the CLI: `npm run build`.
4. Link for local testing: `npm link`.

---
Part of the [imrabo](https://github.com/imrabo/imrabo-cli) ecosystem.
