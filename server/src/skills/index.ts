import { datetimeSkill } from './datetimeSkill.js';
import { registerSkill } from './registry.js';
import { urlExtractSkill } from './urlExtractSkill.js';
import { webSearchSkill } from './webSearchSkill.js';

registerSkill(webSearchSkill);
registerSkill(urlExtractSkill);
registerSkill(datetimeSkill);

export { registerSkill, runMatchingSkills, getRegisteredSkills } from './registry.js';
export type { Skill, SkillResult } from './registry.js';
export {
  isWebSearchSkillEnabled,
  needsWebSearch,
  runWebSearchSkill,
  buildWebSearchQuery,
  parseWebSearchSummary,
  parseWebSearchProvider,
  resolveSearchQuery,
  filterSearchResultsByRelevance,
} from './webSearchSkill.js';
