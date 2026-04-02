import type { PluginManifest } from './PluginManifest.js'

export class PluginHost {
  private readonly plugins: PluginManifest[] = []

  register(manifest: PluginManifest): void {
    this.plugins.push(manifest)
  }

  list(): PluginManifest[] {
    return [...this.plugins]
  }
}
