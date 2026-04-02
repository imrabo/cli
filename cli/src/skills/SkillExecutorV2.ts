import type { ExecutionContext } from '../shared/types.js'
import { createChildExecutionContext } from '../coordinator/ExecutionContext.js'
import type { ToolExecutor } from '../tools/ToolExecutor.js'
import type { SkillResult } from './Skill.js'
import type { SkillRegistry } from './SkillRegistry.js'

/**
 * Production-grade Skill Executor with:
 * - Skill composition (skills calling skills)
 * - Proper error handling
 * - Timeout enforcement
 * - Structured output
 * - Multi-step workflows
 */
export class SkillExecutorV2 {
  private static readonly DEFAULT_SKILL_TIMEOUT_MS = 60_000
  private readonly executionStack: string[] = [] // Detect circular calls

  constructor(
    private readonly registry: SkillRegistry,
    private readonly tools: ToolExecutor,
    private readonly askModel: (
      prompt: string,
      context: ExecutionContext,
    ) => Promise<string>,
  ) {}

  /**
   * Execute a skill with full context and composition support
   */
  async execute(
    name: string,
    input: string,
    context: ExecutionContext,
    opts?: { timeout?: number },
  ): Promise<SkillResult> {
    const timeoutMs = opts?.timeout ?? SkillExecutorV2.DEFAULT_SKILL_TIMEOUT_MS

    // 1. Detect circular calls
    if (this.executionStack.includes(name)) {
      throw new Error(`Circular skill call detected: ${this.executionStack.join(' → ')} → ${name}`)
    }

    // 2. Get skill
    const skill = this.registry.get(name)
    if (!skill) {
      throw new Error(`Skill not found: ${name}`)
    }

    // 3. Create child context
    const childContext = createChildExecutionContext(context, 'skill')

    // 4. Push to stack
    this.executionStack.push(name)

    try {
      // 5. Execute with timeout
      const result = await Promise.race([
        skill.execute(input, {
          execution: childContext,
          runTool: (toolName, toolInput) =>
            this.tools.run(toolName, toolInput, childContext),
          callSkill: (skillName, skillInput) =>
            this.executeSkill(skillName, skillInput, childContext),
          askModel: (prompt) =>
            this.askModel(prompt, childContext),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Skill timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ])

      return result
    } finally {
      // 6. Pop from stack
      this.executionStack.pop()
    }
  }

  /**
   * Internal skill call (for composition)
   */
  private async executeSkill(
    name: string,
    input: string,
    context: ExecutionContext,
  ): Promise<SkillResult> {
    // Nested call - use child context with shorter timeout
    return this.execute(name, input, context, {
      timeout: SkillExecutorV2.DEFAULT_SKILL_TIMEOUT_MS / 2,
    })
  }
}
