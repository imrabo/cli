import type { Skill } from '../Skill.js'

export const analyzeLogsSkill: Skill = {
  name: 'analyze_logs_skill',
  description: 'Analyze logs and identify likely root causes',
  tags: ['analysis', 'debugging'],
  async execute(input, context) {
    const response = await context.askModel(`Analyze these logs and identify root causes:\n${input}`)
    return {
      summary: response,
    }
  },
}
