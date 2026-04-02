import type { Skill } from '../Skill.js'

export const refactorCodeSkill: Skill = {
  name: 'refactor_code_skill',
  description: 'Refactor code with a clear change plan',
  tags: ['coding', 'refactor'],
  async execute(input, context) {
    const result = await context.askModel(`Refactor this code with explanation:\n${input}`)
    return {
      summary: result,
    }
  },
}
