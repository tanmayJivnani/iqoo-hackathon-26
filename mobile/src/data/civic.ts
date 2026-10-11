import { categories as treeCategories, legalGrounding as treeLegal, type TreeCategory } from './categories';

export type CivicDomain = 'TREES' | 'ROADS' | 'GARBAGE' | 'NOISE';
export const tabs: { key: CivicDomain; title: string; emoji: string; caption: string }[] = [
  { key: 'ROADS', title: 'Roads', emoji: '🛣️', caption: 'Potholes, drains and footpaths' },
  { key: 'GARBAGE', title: 'Garbage', emoji: '♻️', caption: 'Waste dumps and burning' },
  { key: 'TREES', title: 'Trees', emoji: '🌳', caption: 'Preservation and tree hazards' },
  { key: 'NOISE', title: 'Noise', emoji: '🔊', caption: 'Loudspeakers and night-time noise' },
];
const photoIssue = (key: string, title: string, emoji: string, description: string, instruction: string): TreeCategory => ({ key, title, emoji, description, guides: [{ title: 'Hazard and location', badge: 'Evidence', instruction }] });
export const categoriesByDomain: Record<CivicDomain, TreeCategory[]> = {
  TREES: treeCategories,
  ROADS: [
    photoIssue('ROAD_POTHOLE', 'Pothole', '🕳️', 'Damaged road surface or a dangerous road crater.', 'From a safe place, show the pothole and a nearby landmark. Do not enter traffic.'),
    photoIssue('OPEN_MANHOLE', 'Open manhole / drain', '⚠️', 'An uncovered opening or damaged drain cover.', 'Keep your distance. Show the opening and its position beside the road or footpath.'),
    photoIssue('FOOTPATH_ENCROACHMENT', 'Blocked footpath', '🚶', 'Obstructions or debris preventing safe pedestrian access.', 'Show the blockage and the available pedestrian passage. Do not confront anyone.'),
  ],
  GARBAGE: [
    photoIssue('WASTE_DUMP', 'Waste dump', '🗑️', 'Uncollected waste or an overflowing dump.', 'Show the waste heap and the nearby street or landmark.'),
    photoIssue('WASTE_BURNING', 'Waste burning', '🔥', 'Reported burning waste, including plastic or active smoke.', 'Keep away from fire and smoke. Photograph the visible source from a safe distance.'),
  ],
  NOISE: [
    photoIssue('FESTIVAL_NOISE', 'Loudspeaker / DJ system', '🔊', 'A disruptive sound system requiring police inspection.', 'Record a short ambient sample from your current safe location.'),
    photoIssue('NIGHT_NOISE', 'Night-time disturbance', '🌙', 'A disturbance during usual 10 PM–6 AM night hours.', 'The recording includes its timestamp. Police check permissions and any valid exemptions.'),
  ],
};
export const allCategories = Object.values(categoriesByDomain).flat();
export function domainFor(issue: string): CivicDomain {
  return tabs.find(tab => categoriesByDomain[tab.key].some(category => category.key === issue))?.key || 'TREES';
}
export function categoryLabel(key?: string) {
  return allCategories.find(item => item.key === key)?.title ?? (key || 'Civic concern').replaceAll('_', ' ').toLowerCase();
}
export const legalGrounding: Record<string, string[]> = {
  ...treeLegal,
  DANGEROUS_LEANING_FALL_RISK: ['Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975'],
  HAZARDOUS_BRANCH: ['Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975'],
  ROAD_POTHOLE: ['Maharashtra Municipal Corporations Act, 1949 — Section 63'],
  OPEN_MANHOLE: ['Maharashtra Municipal Corporations Act, 1949 — Section 63'],
  FOOTPATH_ENCROACHMENT: ['Maharashtra Municipal Corporations Act, 1949 — Section 63', 'Rights of Persons with Disabilities Act, 2016 — Section 41'],
  WASTE_DUMP: ['Solid Waste Management Rules, 2026'], WASTE_BURNING: ['Solid Waste Management Rules, 2026', 'Environment (Protection) Act, 1986'],
  FESTIVAL_NOISE: ['Noise Pollution (Regulation and Control) Rules, 2000 — Rules 5, 7 and 8, as amended'],
  NIGHT_NOISE: ['Noise Pollution (Regulation and Control) Rules, 2000 — Rules 5, 7 and 8, as amended'],
};
