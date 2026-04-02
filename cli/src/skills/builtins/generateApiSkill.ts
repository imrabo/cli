import type { Skill } from '../Skill.js'

export const generateApiSkill: Skill = {
  name: 'generate_api_skill',
  description: 'Generate API scaffolding and contracts',
  tags: ['coding', 'api'],
  async execute(input, context) {
    const response = await context.askModel(`Generate API contract and starter implementation:\n${input}`)
    return {
      summary: response,
    }
  },
}
