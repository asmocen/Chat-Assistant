import type { ChatMessage } from '../services/llm.js';

export interface SkillResult {
  text: string;
  toolUsed: string;
}

export interface Skill {
  id: string;
  enabled: () => boolean;
  needs: (text: string, history: ChatMessage[]) => boolean;
  run: (text: string, history: ChatMessage[]) => Promise<SkillResult | null>;
}

const skills: Skill[] = [];

export function registerSkill(skill: Skill): void {
  skills.push(skill);
}

export function getRegisteredSkills(): Skill[] {
  return [...skills];
}

export async function runMatchingSkills(
  userText: string,
  history: ChatMessage[],
): Promise<{ results: SkillResult[]; toolsUsed: string[] }> {
  const results: SkillResult[] = [];
  const toolsUsed: string[] = [];

  for (const skill of skills) {
    if (!skill.enabled()) continue;
    if (!skill.needs(userText, history)) continue;
    try {
      const result = await skill.run(userText, history);
      if (result) {
        results.push(result);
        toolsUsed.push(result.toolUsed);
      }
    } catch (err) {
      console.warn(`[skill:${skill.id}] failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { results, toolsUsed };
}
