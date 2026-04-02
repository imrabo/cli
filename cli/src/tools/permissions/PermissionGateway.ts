export class PermissionGateway {
  constructor(private readonly strict = true) {}

  async authorize(toolName: string): Promise<void> {
    if (!this.strict) {
      return
    }
    const deniedTools = new Set<string>([])
    if (deniedTools.has(toolName)) {
      throw new Error(`Permission denied for tool: ${toolName}`)
    }
  }
}
