import type { Skill } from './Skill.js'

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>()

  register(skill: Skill): void {
    this.skills.set(skill.name, skill)
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  list(): Skill[] {
    return Array.from(this.skills.values())
  }
}
