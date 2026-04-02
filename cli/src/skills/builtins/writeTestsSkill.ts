import type { Skill } from '../Skill.js'

export const writeTestsSkill: Skill = {
  name: 'write_tests_skill',
  description: 'Write unit and integration tests for a target component',
  tags: ['testing', 'coding'],
  async execute(input, context) {
    const plan = await context.askModel(`Write tests for this target:\n${input}`)
    return {
      summary: plan,
    }
  },
}
