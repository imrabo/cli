import type { ExecutionContext } from '../shared/types.js'
import type { SkillExecutor } from '../skills/SkillExecutor.js'
import { AgentPlanner } from './AgentPlanner.js'

export class AgentEngine {
  private readonly planner = new AgentPlanner()

  constructor(private readonly skills: SkillExecutor) {}

  async run(goal: string, context: ExecutionContext): Promise<string> {
    const steps = this.planner.plan(goal)
    const outputs: string[] = []

    for (const step of steps) {
      const result = await this.skills.execute(step, goal, context)
      outputs.push(`[${step}] ${result.summary}`)
    }

    return outputs.join('\n\n')
  }
}
