export class AgentPlanner {
  plan(goal: string): string[] {
    const lowered = goal.toLowerCase()
    const steps: string[] = []

    if (lowered.includes('test')) {
      steps.push('write_tests_skill')
    }
    if (lowered.includes('error') || lowered.includes('bug')) {
      steps.push('debug_error_skill')
    }
    if (lowered.includes('api')) {
      steps.push('generate_api_skill')
    }
    if (lowered.includes('refactor')) {
      steps.push('refactor_code_skill')
    }

    if (steps.length === 0) {
      steps.push('code_review_skill')
    }

    return steps
  }
}
