import type { ExecutionContext } from '../shared/types.js'
import type { ToolRegistry } from './ToolRegistry.js'
import { PermissionGateway } from './permissions/PermissionGateway.js'

/**
 * Production-grade ToolExecutor with:
 * - Input validation
 * - Permission enforcement
 * - Resource limits
 * - Timeout enforcement
 * - Error handling
 */
export class ToolExecutorV2 {
  private static readonly DEFAULT_TOOL_TIMEOUT_MS = 10_000
  private static readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024 // 10MB

  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissions: PermissionGateway,
  ) {}

  /**
   * Execute tool with full validation and security checks
   */
  async run(
    toolName: string,
    input: string,
    context: ExecutionContext,
    opts?: { timeout?: number },
  ): Promise<string> {
    const timeoutMs = opts?.timeout ?? ToolExecutorV2.DEFAULT_TOOL_TIMEOUT_MS

    // 1. Validation
    this.validateToolName(toolName)
    this.validateInput(input)

    // 2. Permission check
    await this.permissions.authorize(toolName)

    // 3. Get tool
    const tool = this.registry.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }

    // 4. Execute with timeout
    const startTime = Date.now()

    try {
      const result = await Promise.race([
        tool.execute(input, {
          sessionId: context.sessionId,
          cwd: context.cwd,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Tool timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ])

      const duration = Date.now() - startTime

      // 5. Validate output size
      if (result.output.length > ToolExecutorV2.MAX_OUTPUT_SIZE) {
        throw new Error(
          `Tool output exceeds limit: ${result.output.length} > ${ToolExecutorV2.MAX_OUTPUT_SIZE}`,
        )
      }

      // Success
      return result.output
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      throw new Error(`Tool '${toolName}' failed: ${message}`)
    }
  }

  /**
   * Validate tool name format
   */
  private validateToolName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name must be a non-empty string')
    }

    // Allow alphanumeric, dots, hyphens
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      throw new Error(`Invalid tool name format: ${name}`)
    }

    if (name.length > 64) {
      throw new Error(`Tool name too long: ${name}`)
    }
  }

  /**
   * Validate tool input
   */
  private validateInput(input: string): void {
    if (typeof input !== 'string') {
      throw new Error('Tool input must be a string')
    }

    if (input.length > 1 * 1024 * 1024) {
      // 1MB input limit
      throw new Error('Tool input exceeds 1MB limit')
    }

    // Check for null bytes (potential security issue)
    if (input.includes('\0')) {
      throw new Error('Tool input contains null bytes (forbidden)')
    }
  }
}
