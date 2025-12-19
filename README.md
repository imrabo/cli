# imrabo

**imrabo** is a production-grade local AI runtime platform. It consists of a high-performance Go-based daemon and a thin, elegant TypeScript CLI that manages the runtime lifecycle, model orchestration, and security.

## Philosophy

- **Zero Config**: No manual setup of ports, paths, or hardware drivers.
- **Policy Driven**: The system makes intelligent decisions about model selection and resource allocation.
- **Hardened**: Built-in state machine, signature verification, and hardware safety guardrails.
- **Transparent**: Structured logging and a comprehensive diagnostic `doctor` suite.

## Repository Structure

- `cli/`: TypeScript CLI package (`@imrabo/cli`).
- `runtime/`: Core Go daemon.
- `registry/`: Signed model registry manifests.

## Key Features

- **Runtime State Machine**: `READY`, `BUSY`, `ERROR` states for safe concurrency.
- **Registry Trust**: Ed25519 signature checks on all model manifests.
- **Disk Guardrails**: Prevents failures by verifying hardware requirements before downloads.
- **Auto-Recovery**: Graceful self-healing from transient runtime errors.
- **Diagnostics**: Deep system introspection via `imrabo doctor`.

## Getting Started

### Development

1. **Build the Runtime**:
   ```powershell
   cd runtime
   go build -o imrabo-runtime.exe cmd/main.go
   ```

2. **Setup the CLI**:
   ```powershell
   cd cli
   npm install
   npm run build
   npm link
   ```

3. **Run a Task**:
   ```powershell
   imrabo run "What is the capital of France?"
   ```

## License

ISC
