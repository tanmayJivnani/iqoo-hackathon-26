import type { CivicDomain } from '../../data/civic';
export type Page = 'tracker' | 'category' | 'guidance' | 'capture' | 'review' | 'noise' | 'draft' | 'dispatch' | 'verify';
export type Profile = { name: string; phone: string; email: string };
export type Photo = { uri: string; base64: string };
export type EvidenceLocation = { latitude: number; longitude: number; address: string; accuracy?: number | null };
export type NearbyComplaint = { id: string; tracking_id: string; issue_type: string; distance_meters: number; witness_count: number; address_landmark: string };
export type PhotoGuide = { title: string; badge: string; instruction: string };
export const blankProfile: Profile = { name: '', phone: '', email: '' };
export function photoBase64(photo: Photo) { return photo.base64.replace(/^data:image\/[^;]+;base64,/, ''); }
export function previousPage(page: Page, domain: CivicDomain, hasDetail: boolean): Page {
  const targets: Record<Page, Page> = {
    tracker: 'tracker', category: 'tracker', guidance: 'category', capture: 'guidance',
    noise: 'category', review: 'capture', draft: hasDetail ? 'tracker' : domain === 'NOISE' ? 'noise' : 'review',
    dispatch: 'draft', verify: hasDetail ? 'draft' : 'tracker',
  };
  return targets[page];
}
