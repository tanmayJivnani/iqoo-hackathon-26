export type PhotoGuide = { title: string; badge: string; instruction: string };
export type TreeCategory = { key: string; title: string; emoji: string; description: string; guides: PhotoGuide[] };

export const categories: TreeCategory[] = [
  { key: 'DANGEROUS_LEANING_FALL_RISK', title: 'Leaning tree / fall risk', emoji: '⚠️', description: 'A tree leaning over a road, power lines, or buildings.', guides: [
    { title: 'Full tree and street', badge: 'Locus context', instruction: 'Step back and capture the whole tree with nearby buildings or poles to show the lean.' },
    { title: 'Trunk angle', badge: 'Structure', instruction: 'Frame the trunk against a vertical landmark so the tilt is clear.' },
    { title: 'Root plate and soil', badge: 'Close-up', instruction: 'Photograph lifted roots, cracks, or disturbed soil at the base.' },
  ] },
  { key: 'ILLEGAL_FELLING', title: 'Illegal felling / sabotage', emoji: '🪓', description: 'Tree cutting, a sawn stump, poisoning, or damage to the trunk.', guides: [
    { title: 'Avenue and site', badge: 'Locus context', instruction: 'Show the work area or gap in the street canopy.' },
    { title: 'Timber and activity', badge: 'Structure', instruction: 'Frame cut logs, stacked branches, equipment, or active work.' },
    { title: 'Stump or base damage', badge: 'Close-up', instruction: 'Show saw marks, chemical holes, burning, or girdling on the trunk.' },
  ] },
  { key: 'UNAUTHORIZED_PRUNING', title: 'Unauthorized heavy pruning', emoji: '✂️', description: 'Excessive cutting, canopy topping, or hacked structural limbs.', guides: [
    { title: 'Whole canopy', badge: 'Locus context', instruction: 'Show the whole tree and the extent of canopy loss.' },
    { title: 'Main limbs', badge: 'Structure', instruction: 'Frame the trunk joints where large limbs were cut.' },
    { title: 'Cut branch stubs', badge: 'Close-up', instruction: 'Show the cut surface and any torn bark.' },
  ] },
  { key: 'HAZARDOUS_BRANCH', title: 'Hazardous broken branch', emoji: '🌿', description: 'A cracked, hanging, or broken limb threatening people or traffic.', guides: [
    { title: 'Tree and public area', badge: 'Locus context', instruction: 'Show the whole tree and the road, pavement, or power line below.' },
    { title: 'Limb attachment', badge: 'Structure', instruction: 'Show where the damaged limb joins the trunk.' },
    { title: 'Fracture and split', badge: 'Close-up', instruction: 'Photograph the crack, split wood, or hanging section.' },
  ] },
  { key: 'ROOT_CONCRETIZATION', title: 'Root concretization', emoji: '🧱', description: 'Paving or concrete choking the soil around a tree.', guides: [
    { title: 'Footpath and street', badge: 'Locus context', instruction: 'Show the tree’s position along the footpath or road.' },
    { title: 'Paving around trunk', badge: 'Structure', instruction: 'Frame the lower trunk and surrounding paved area.' },
    { title: 'Root collar', badge: 'Close-up', instruction: 'Show pavement or concrete touching the bark.' },
  ] },
  { key: 'DISEASE_PEST', title: 'Disease / termite decay', emoji: '🐛', description: 'Fungal growth, hollow trunk, rot, termites, or a dying canopy.', guides: [
    { title: 'Canopy condition', badge: 'Locus context', instruction: 'Show the full tree and any dead or thinning areas.' },
    { title: 'Affected trunk', badge: 'Structure', instruction: 'Frame the infected or damaged section.' },
    { title: 'Pest or decay detail', badge: 'Close-up', instruction: 'Show fungal growth, termite trails, rot, or cavities.' },
  ] },
  { key: 'NAILS_BOARDS_CABLE_STRANGULATION', title: 'Nails / boards / cables', emoji: '🔩', description: 'Nails, signs, or cables embedded around a tree trunk.', guides: [
    { title: 'Street context', badge: 'Locus context', instruction: 'Show the tree in its street setting.' },
    { title: 'Trunk and attachment', badge: 'Structure', instruction: 'Frame the attached board, cable, or other object.' },
    { title: 'Bark detail', badge: 'Close-up', instruction: 'Show nails, screws, or cable pressure on the bark.' },
  ] },
];

export const legalGrounding: Record<string, string[]> = {
  ILLEGAL_FELLING: ['Maharashtra Trees Act, 1975 — Sections 8 and 21', 'Unauthorized felling or damage to protected trees'],
  UNAUTHORIZED_PRUNING: ['Maharashtra Trees Act, 1975 — Sections 8 and 21', 'Heavy lopping requires Tree Authority sanction'],
  ROOT_CONCRETIZATION: ['Maharashtra Trees Act, 1975 — Section 2(c)', 'Keep an unpaved basin around the tree roots'],
  NAILS_BOARDS_CABLE_STRANGULATION: ['Maharashtra Trees Act, 1975 — Section 2(c)', 'Report damage to the trunk and live bark'],
  DANGEROUS_LEANING_FALL_RISK: ['Maharashtra Trees Act, 1975 — Section 7(b)', 'Request prompt review of the public safety risk'],
  HAZARDOUS_BRANCH: ['Maharashtra Trees Act, 1975 — Section 7(b)', 'Request prompt review of the public safety risk'],
  DISEASE_PEST: ['Maharashtra Trees Act, 1975', 'Request inspection and care by the Ward Tree Officer'],
};

export function categoryLabel(key?: string) {
  return categories.find((item) => item.key === key)?.title ?? (key ?? 'Tree concern').replaceAll('_', ' ').toLowerCase();
}
