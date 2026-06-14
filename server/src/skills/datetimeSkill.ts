import { getServerDateTimeLine, getServerTimezone } from '../services/serverContext.js';
import type { Skill } from './registry.js';

const DATETIME_INTENT =
  /现在几点|几点了|几点钟|当前时间|今天星期|星期几|今天是几号|几月几号|什么日期|现在时间/i;

export function needsDatetime(userText: string): boolean {
  return DATETIME_INTENT.test(userText.trim());
}

export function isDatetimeSkillEnabled(): boolean {
  return process.env.DATETIME_SKILL_ENABLED !== 'false';
}

export const datetimeSkill: Skill = {
  id: 'datetime',
  enabled: isDatetimeSkillEnabled,
  needs: needsDatetime,
  run: async () => ({
    text: `当前时间（${getServerTimezone()}）：${getServerDateTimeLine()}`,
    toolUsed: 'datetime:builtin',
  }),
};
