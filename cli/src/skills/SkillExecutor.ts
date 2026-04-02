import type { ExecutionContext } from '../shared/types.js'
import type { ToolExecutor } from '../tools/ToolExecutor.js'
import type { SkillResult } from './Skill.js'
import type { SkillRegistry } from './SkillRegistry.js'

export class SkillExecutor {
  constructor(
    private readonly registry: SkillRegistry,
    private readonly tools: ToolExecutor,
    private readonly askModel: (prompt: string, context: ExecutionContext) => Promise<string>,
  ) {}

  async execute(name: string, input: string, ctx: ExecutionContext): Promise<SkillResult> {
    const skill = this.registry.get(name)
    if (!skill) {
      throw new Error(`Skill not found: ${name}`)
    }

    return skill.execute(input, {
      execution: ctx,
      runTool: (toolName, toolInput) => this.tools.run(toolName, toolInput, ctx),
      askModel: prompt => this.askModel(prompt, ctx),
      callSkill: (skillName, skillInput) => this.execute(skillName, skillInput, ctx),
    })
  }
}
