import type { SkillRegistry } from '../skills/SkillRegistry.js'
import type { ExecutionContext } from '../shared/types.js'

/**
 * Plan item representing one step in agent execution
 */
export interface AgentPlan {
  steps: AgentStep[]
  reasoning: string
}

export interface AgentStep {
  order: number
  skillName: string
  input: string
  description: string
  canRetry: boolean
}

/**
 * Production-grade Agent Planner with:
 * - LLM-based planning (not keyword matching)
 * - Plan reasoning
 * - Execution feedback loop
 * - Step reflection and adaptation
 */
export class AgentPlannerV2 {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly askModel: (prompt: string) => Promise<string>,
  ) {}

  /**
   * Create a plan for the given goal using LLM reasoning
   */
  async plan(goal: string, context: ExecutionContext): Promise<AgentPlan> {
    // Get available skills
    const availableSkills = this.skillRegistry.list()
    const skillDescriptions = availableSkills
      .map(s => `- ${s.name}: ${s.description} (tags: ${s.tags.join(', ')})`)
      .join('\n')

    // Ask LLM to plan
    const planningPrompt = `
Given this goal:
"${goal}"

Available skills:
${skillDescriptions}

Create a step-by-step plan to achieve this goal. For each step:
1. Choose a skill to use
2. Describe what input to provide
3. Explain why this step addresses the goal

Output JSON array of steps. Format:
[
  {
    "order": 1,
    "skillName": "skill_name",
    "input": "description of input",
    "description": "why this step",
    "canRetry": true
  },
  ...
]

Only use skills from the available list above. Output valid JSON only, no explanation.`

    try {
      const response = await this.askModel(planningPrompt)
      const plan = this.parseAgentPlan(response, goal)
      return plan
    } catch {
      // Fallback to keyword-based planning if LLM planning fails
      return this.planWithKeywords(goal, availableSkills)
    }
  }

  /**
   * Parse LLM response into structured plan
   */
  private parseAgentPlan(response: string, goal: string): AgentPlan {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[\s*{[\s\S]*}\s*\]/m)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }

      const stepsRaw = JSON.parse(jsonMatch[0]) as unknown[]
      const steps: AgentStep[] = stepsRaw
        .filter(s => s && typeof s === 'object')
        .map((s: any) => ({
          order: s.order ?? 0,
          skillName: s.skillName || '',
          input: s.input || '',
          description: s.description || '',
          canRetry: s.canRetry !== false,
        }))
        .filter(s => s.skillName)
        .sort((a, b) => a.order - b.order)

      if (steps.length === 0) {
        throw new Error('No valid steps parsed')
      }

      return {
        steps,
        reasoning: `LLM planned ${steps.length} steps to achieve: ${goal}`,
      }
    } catch {
      throw new Error('Failed to parse LLM plan response')
    }
  }

  /**
   * Fallback keyword-based planner
   */
  private planWithKeywords(goal: string, skills: any[]): AgentPlan {
    const lowered = goal.toLowerCase()
    const steps: AgentStep[] = []
    let order = 1

    // Simple keyword matching to select skills
    const keywordMap: Record<string, string> = {
      test: 'write_tests_skill',
      error: 'debug_error_skill',
      bug: 'debug_error_skill',
      api: 'generate_api_skill',
      refactor: 'refactor_code_skill',
      review: 'code_review_skill',
      analyze: 'analyze_logs_skill',
    }

    const matchedSkills = new Set<string>()

    for (const [keyword, skillName] of Object.entries(keywordMap)) {
      if (lowered.includes(keyword) && skills.some(s => s.name === skillName)) {
        matchedSkills.add(skillName)
      }
    }

    // If nothing matched, default to code review
    if (matchedSkills.size === 0) {
      matchedSkills.add('code_review_skill')
    }

    // Convert to steps
    for (const skillName of matchedSkills) {
      steps.push({
        order: order++,
        skillName,
        input: goal,
        description: `Execute ${skillName}`,
        canRetry: true,
      })
    }

    return {
      steps,
      reasoning: `Keyword-based plan: ${Array.from(matchedSkills).join(', ')}`,
    }
  }

  /**
   * Evaluate plan result and decide if replanning is needed
   */
  shouldReplan(
    goalResult: string,
    originalGoal: string,
  ): boolean {
    // Simple heuristic: if result looks like an error, replan
    const errorIndicators = ['error', 'failed', 'unable', 'cannot']
    const hasError = errorIndicators.some(indicator =>
      goalResult.toLowerCase().includes(indicator),
    )

    return hasError
  }
}
