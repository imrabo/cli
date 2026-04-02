import type { ExecutionContext } from '../shared/types.js'

export type SkillResult = {
  summary: string
  data?: Record<string, unknown>
  nextStep?: string
  error?: string
}

export type SkillContext = {
  execution: ExecutionContext
  runTool: (name: string, input: string) => Promise<string>
  callSkill: (name: string, input: string) => Promise<SkillResult>  // New: skill composition
  askModel: (prompt: string) => Promise<string>
}

export interface Skill {
  name: string
  description: string
  tags: string[]
  execute(input: string, context: SkillContext): Promise<SkillResult>
}
