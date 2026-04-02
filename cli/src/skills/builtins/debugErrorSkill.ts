import type { Skill } from '../Skill.js'

export const debugErrorSkill: Skill = {
  name: 'debug_error_skill',
  description: 'Analyze an error and suggest concrete fixes',
  tags: ['debugging', 'analysis'],
  async execute(input, context) {
    const analysis = await context.askModel(`Analyze this error and provide actionable fixes:\n${input}`)
    return {
      summary: analysis,
    }
  },
}
