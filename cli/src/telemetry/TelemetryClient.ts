export class TelemetryClient {
  event(name: string, payload: Record<string, string | number | boolean>): void {
    if (process.env.IMRABO_TELEMETRY_DISABLED === '1') {
      return
    }
    const line = JSON.stringify({ type: 'event', name, payload, ts: Date.now() })
    process.stderr.write(`${line}\n`)
  }
}
