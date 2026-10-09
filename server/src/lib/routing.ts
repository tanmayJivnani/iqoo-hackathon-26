import rules from './routing-rules.json';
import { config } from './config';
import type { Routing } from './types';
import { civicRoute } from './civic';

export const categories = ['DANGEROUS_LEANING_FALL_RISK', 'ILLEGAL_FELLING', 'UNAUTHORIZED_PRUNING', 'HAZARDOUS_BRANCH', 'ROOT_CONCRETIZATION', 'DISEASE_PEST', 'NAILS_BOARDS_CABLE_STRANGULATION'] as const;
export function routeIssue(issue: string, stage = 'NOT_APPLICABLE'): Routing {
  const civic = civicRoute(issue);
  if (civic) return civic;
  const normalized = issue.toUpperCase();
  let key: keyof typeof rules;
  if (/LEANING|FALL/.test(normalized)) key = 'DANGEROUS_LEANING_FALL_RISK';
  else if (/FELLING|CUTTING/.test(normalized)) key = stage === 'IN_PROGRESS' || normalized.endsWith('_IN_PROGRESS') ? 'ILLEGAL_FELLING_IN_PROGRESS' : 'ILLEGAL_FELLING_COMPLETED';
  else if (/BRANCH|HAZARD|BROKEN/.test(normalized)) key = 'HAZARDOUS_BRANCH';
  else if (/DISEASE|PEST|TERMITE|DECAY/.test(normalized)) key = 'DISEASE_PEST';
  else if (/ROOT|CONCRETE|ENCROACH|TAR/.test(normalized)) key = 'ROOT_CONCRETIZATION';
  else if (/NAIL|BOARD|CABLE|STRANGUL|BANNER/.test(normalized)) key = 'NAILS_BOARDS_CABLE_STRANGULATION';
  else key = 'UNAUTHORIZED_PRUNING';
  const rule = structuredClone(rules[key]);
  const email = key === 'DANGEROUS_LEANING_FALL_RISK' ? config.disasterEmail : key === 'HAZARDOUS_BRANCH' ? config.generalEmail : config.treeEmail;
  return { ...rule, routed_authority: { ...rule.routed_authority, email, whatsapp: config.whatsapp } } as Routing;
}
