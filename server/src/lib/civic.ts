import { config } from './config';
import type { Routing } from './types';

export const civicCategories = ['ROAD_POTHOLE', 'OPEN_MANHOLE', 'FOOTPATH_ENCROACHMENT', 'WASTE_DUMP', 'WASTE_BURNING', 'FESTIVAL_NOISE', 'NIGHT_NOISE'] as const;
export type CivicDomain = 'TREES' | 'ROADS' | 'GARBAGE' | 'NOISE';
export function domainFor(issue: string): CivicDomain {
  if (['ROAD_POTHOLE', 'OPEN_MANHOLE', 'FOOTPATH_ENCROACHMENT'].includes(issue)) return 'ROADS';
  if (['WASTE_DUMP', 'WASTE_BURNING'].includes(issue)) return 'GARBAGE';
  if (['FESTIVAL_NOISE', 'NIGHT_NOISE'].includes(issue)) return 'NOISE';
  return 'TREES';
}
export const issueTitles: Record<string, string> = {
  DANGEROUS_LEANING_FALL_RISK: 'Leaning tree / fall risk', ILLEGAL_FELLING: 'Reported tree felling or damage',
  UNAUTHORIZED_PRUNING: 'Reported heavy pruning', HAZARDOUS_BRANCH: 'Hazardous branch',
  ROOT_CONCRETIZATION: 'Roots covered by concrete', DISEASE_PEST: 'Possible tree disease or pests',
  NAILS_BOARDS_CABLE_STRANGULATION: 'Nails, boards or cables affecting the tree',
  ROAD_POTHOLE: 'Pothole', OPEN_MANHOLE: 'Open manhole or drain', FOOTPATH_ENCROACHMENT: 'Blocked footpath',
  WASTE_DUMP: 'Uncollected waste dump', WASTE_BURNING: 'Reported waste burning', FESTIVAL_NOISE: 'Loudspeaker or DJ noise', NIGHT_NOISE: 'Night-time noise',
};
const municipal = 'Maharashtra Municipal Corporations Act, 1949 — Section 63 (municipal duties)';
const rules: Record<string, { department: string; role: string; emailSetting: string; urgency: string; hours: number; references: string[]; request: string }> = {
  ROAD_POTHOLE: { department: 'PMC Roads Department', role: 'Ward Roads Engineer', emailSetting: 'PMC_ROADS_EMAIL', urgency: 'HIGH', hours: 48, references: [municipal], request: 'Please inspect, barricade unsafe areas and repair the road surface.' },
  OPEN_MANHOLE: { department: 'PMC Drainage Department', role: 'Ward Drainage Engineer', emailSetting: 'PMC_DRAINAGE_EMAIL', urgency: 'CRITICAL_EMERGENCY', hours: 24, references: [municipal], request: 'Please urgently secure and barricade the opening, then replace or repair its cover.' },
  FOOTPATH_ENCROACHMENT: { department: 'PMC Encroachment Department', role: 'Ward Encroachment Officer', emailSetting: 'PMC_ENCROACHMENT_EMAIL', urgency: 'HIGH', hours: 0, references: [municipal, 'Rights of Persons with Disabilities Act, 2016 — Section 41 (accessible transport and facilities)'], request: 'Please inspect the obstruction and restore accessible pedestrian passage in accordance with applicable law and vendor protections.' },
  WASTE_DUMP: { department: 'PMC Solid Waste Management Department', role: 'Ward Sanitary Inspector', emailSetting: 'PMC_SWM_EMAIL', urgency: 'HIGH', hours: 48, references: ['Solid Waste Management Rules, 2026', municipal], request: 'Please inspect and arrange lawful collection, segregation and removal of the reported waste.' },
  WASTE_BURNING: { department: 'PMC Solid Waste Management Department', role: 'Ward Sanitary Inspector', emailSetting: 'PMC_SWM_EMAIL', urgency: 'CRITICAL_EMERGENCY', hours: 0, references: ['Solid Waste Management Rules, 2026', 'Environment (Protection) Act, 1986'], request: 'Please urgently inspect the reported burning, prevent further burning and assess applicable enforcement action.' },
  FESTIVAL_NOISE: { department: 'Pune City Police', role: 'Noise enforcement / jurisdictional police station', emailSetting: 'PUNE_POLICE_EMAIL', urgency: 'HIGH', hours: 0, references: ['Noise Pollution (Regulation and Control) Rules, 2000 — Rules 5, 7 and 8, as amended'], request: 'Please inspect the reported sound system, check permissions and any notified exemptions, and take appropriate action. Please obtain calibrated measurements where required.' },
  NIGHT_NOISE: { department: 'Pune City Police', role: 'Noise enforcement / jurisdictional police station', emailSetting: 'PUNE_POLICE_EMAIL', urgency: 'HIGH', hours: 0, references: ['Noise Pollution (Regulation and Control) Rules, 2000 — Rules 5, 7 and 8, as amended'], request: 'Please check the reported night-time activity, permissions and any notified festival exemption, and take appropriate action. The usual night period is 22:00–06:00 IST, subject to the rules and valid exemptions.' },
};
export function civicRoute(issue: string): Routing | undefined {
  const rule = rules[issue];
  if (!rule) return;
  const police = domainFor(issue) === 'NOISE';
  const configuredEmail = process.env[rule.emailSetting];
  return {
    issue_type: issue, urgency_level: rule.urgency, is_cognizable_offence: false,
    reverification_due_hours: rule.hours,
    routed_authority: { name: rule.department, role: configuredEmail ? rule.role : police ? 'Commissioner office — request forwarding to the jurisdictional station' : `${rule.role} — via PMC central reception; direct ward contact not configured`, email: configuredEmail || (police ? 'cp.pune@mahapolice.gov.in' : config.generalEmail), whatsapp: police ? '' : config.whatsapp, emergency_phone: police ? '112' : null },
    legal_citations: rule.references, prayer_en: rule.request,
    prayer_mr: 'कृपया जोडलेल्या पुराव्यांची व नमूद ठिकाणाची पाहणी करून संबंधित विभागामार्फत योग्य ती कार्यवाही करावी व कार्यवाहीची माहिती कळवावी.',
  };
}
export function requiresReverification(issue: string) {
  return domainFor(issue) === 'TREES' || ['ROAD_POTHOLE', 'OPEN_MANHOLE', 'WASTE_DUMP'].includes(issue);
}
export function isNightTime(iso: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
  return hour >= 22 || hour < 6;
}
