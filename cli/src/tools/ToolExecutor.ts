import type { ExecutionContext } from '../shared/types.js'
import { PermissionGateway } from './permissions/PermissionGateway.js'
import type { ToolRegistry } from './ToolRegistry.js'

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissions: PermissionGateway,
  ) {}

  async run(toolName: string, input: string, context: ExecutionContext): Promise<string> {
    await this.permissions.authorize(toolName)
    const tool = this.registry.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }
    const result = await tool.execute(input, {
      sessionId: context.sessionId,
      cwd: context.cwd,
    })
    return result.output
  }
}
