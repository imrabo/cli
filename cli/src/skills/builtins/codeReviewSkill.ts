import type { Skill } from '../Skill.js'

export const codeReviewSkill: Skill = {
  name: 'code_review_skill',
  description: 'Review code and provide findings',
  tags: ['coding', 'review'],
  async execute(input, context) {
    const modelResponse = await context.askModel(`Review this code:\n${input}`)
    return {
      summary: modelResponse,
    }
  },
}
