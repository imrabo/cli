export type PluginManifest = {
  name: string
  version: string
  capabilities: Array<'command' | 'skill' | 'tool' | 'provider' | 'mcp'>
}
