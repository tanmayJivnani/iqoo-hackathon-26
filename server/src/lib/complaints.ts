import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { analyzePhotos, comparePhotos } from './ai';
import { ApiError } from './http';
import { decodePhoto, savePhoto } from './media';
import { generatePdf } from './pdf';
import { repository } from './repository';
import { routeIssue } from './routing';
import { coordinates, type AnalyzeInput, type RenderInput, dispatchSchema, duplicateSchema, witnessSchema, verifySchema } from './schemas';
import { distanceMeters, locate } from './spatial';
import type { Complaint, Audit } from './types';
import type { z } from 'zod';

export function getComplaint(id: string) {
  const c = repository().get(id);
  if (!c) throw new ApiError(404, 'Complaint not found.');
  return c;
}
export function complaintSummary(c: Complaint) {
  return { id: c.id, tracking_id: c.tracking_id, issue_type: c.issue_type, urgency_level: c.urgency_level, address_landmark: c.address_landmark, verification_status: c.verification_status, reverification_due_at: c.reverification_due_at, created_at: c.created_at };
}
export function draftResponse(c: Complaint) {
  return { ...c, pdf_path: c.pdf_path ? `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf` : null, is_category_mismatch: false, ai_suggested_category: null, mismatch_reason_en: null, mismatch_reason_mr: null, rejection_reason: null, perpetrator_observed: Boolean(c.perpetrator_name || c.perpetrator_phone), reverification_due_date: c.reverification_due_at };
}
function buildComplaint(input: RenderInput, id: string, trackingId: string): Complaint {
  const gps = coordinates.safeParse({ latitude: input.latitude, longitude: input.longitude });
  if (!gps.success) throw new ApiError(422, 'Real GPS coordinates are required to register a local draft.');
  const route = routeIssue(input.issue_type || 'HAZARDOUS_BRANCH', input.felling_stage || 'NOT_APPLICABLE');
  const now = new Date().toISOString();
  const place = locate(gps.data.latitude, gps.data.longitude);
  return {
    id, complaint_id: id, tracking_id: trackingId, citizen_name: input.citizen_name || 'Concerned Pune Citizen', citizen_phone: input.citizen_phone || null, citizen_email: input.citizen_email || null,
    perpetrator_name: input.perpetrator_name || null, perpetrator_phone: input.perpetrator_phone || null,
    ...gps.data, sensor_tilt_angle: input.sensor_tilt_angle ?? null, address_landmark: input.address_landmark || place.address_landmark, ward_name: place.ward_name, land_ownership: 'UNKNOWN',
    issue_type: route.issue_type, urgency_level: route.urgency_level, felling_stage: input.felling_stage || 'NOT_APPLICABLE', is_cognizable_offence: route.is_cognizable_offence,
    routed_authority: route.routed_authority, routed_authority_role: route.routed_authority.role, target_email: route.routed_authority.email, target_whatsapp: route.routed_authority.whatsapp, legal_citations: route.legal_citations, photo_urls: [],
    draft_subject_en: input.draft_subject_en || `Tree grievance [${trackingId}]`,
    draft_body_en: input.draft_body_en || `I request an on-site inspection of the reported tree concern. Reference: ${trackingId}. ${route.prayer_en}`,
    draft_summary_mr: input.draft_summary_mr || route.prayer_mr,
    estimated_tree_species: input.estimated_tree_species || null, visual_damage_summary: input.visual_damage_summary || null,
    citizen_selected_category: null, ai_additional_category: null, ai_additional_reason_en: null, tree_detected: true,
    is_fallback: true, ai_provider: 'ON_DEVICE_DRAFT', fallback_reason: null,
    pdf_path: null, dispatch_status: 'DRAFT', dispatched_channels: [], dispatched_at: null, verification_status: 'PENDING_TIMELOCK', reverification_due_at: new Date(Date.now() + route.reverification_due_hours * 3600_000).toISOString(), reverification_due_hours: route.reverification_due_hours, witness_count: 1, reopen_count: 0, created_at: now, updated_at: now,
  };
}
function trackingId() { return `PUNE-TREE-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`; }
export async function analyze(input: AnalyzeInput) {
  const treePhotos = input.photos_base64?.length ? input.photos_base64 : [input.photo_base64];
  const allPhotos = [...treePhotos, ...(input.perpetrator_photos_base64 || [])];
  allPhotos.forEach(decodePhoto);
  const tracking = trackingId(); const place = locate(input.latitude, input.longitude);
  const { result, provider } = await analyzePhotos(input, tracking, input.address_landmark || place.address_landmark, place.ward_name);
  if (!result.tree_detected) return { complaint_id: '', tracking_id: '', tree_detected: false, rejection_reason: result.rejection_reason || 'Please photograph the tree, branch or root concern.', ...place };
  const c = buildComplaint({ ...input, complaint_id: '', issue_type: result.detected_issue_category === 'INVALID_IMAGE' ? 'HAZARDOUS_BRANCH' : result.detected_issue_category, felling_stage: result.felling_stage || 'NOT_APPLICABLE', draft_subject_en: result.draft_subject_en, draft_body_en: result.draft_body_en, draft_summary_mr: result.draft_summary_mr, estimated_tree_species: result.estimated_tree_species, visual_damage_summary: result.visual_damage_summary }, randomUUID(), tracking);
  c.citizen_selected_category = input.citizen_selected_category || null;
  c.ai_additional_category = result.ai_additional_category || null; c.ai_additional_reason_en = result.ai_additional_reason_en || null;
  c.is_fallback = false; c.ai_provider = provider;
  c.photo_urls = await Promise.all(allPhotos.map(savePhoto));
  repository().save(c); return draftResponse(c);
}
export async function renderPdf(input: RenderInput) {
  let c = repository().get(input.complaint_id);
  if (!c && input.tracking_id) c = repository().get(input.tracking_id);
  const newRecord = !c;
  const photoInputs = input.photos_base64?.length ? input.photos_base64 : input.photo_base64 ? [input.photo_base64] : [];
  photoInputs.forEach(decodePhoto);
  if (!c) {
    if (!input.complaint_id.startsWith('loc-')) throw new ApiError(404, 'Complaint not found. Register or analyze a complaint first.');
    if (!photoInputs.length) throw new ApiError(422, 'Photo evidence is required to register a local draft.');
    c = buildComplaint(input, input.complaint_id, input.tracking_id || trackingId());
  }
  if (input.draft_subject_en != null) c.draft_subject_en = input.draft_subject_en;
  if (input.draft_body_en != null) c.draft_body_en = input.draft_body_en;
  if (input.draft_summary_mr != null) c.draft_summary_mr = input.draft_summary_mr;
  if (input.estimated_tree_species != null) c.estimated_tree_species = input.estimated_tree_species;
  if (input.visual_damage_summary != null) c.visual_damage_summary = input.visual_damage_summary;
  if (photoInputs.length && (newRecord || !c.photo_urls.length)) c.photo_urls = await Promise.all(photoInputs.map(savePhoto));
  const pdf = await generatePdf(c);
  // Re-read counters after asynchronous PDF work so a concurrent witness/audit isn't overwritten.
  const latest = repository().get(c.id);
  if (latest) Object.assign(c, { witness_count: latest.witness_count, reopen_count: latest.reopen_count, verification_status: latest.verification_status, dispatched_at: latest.dispatched_at, dispatched_channels: latest.dispatched_channels, dispatch_status: latest.dispatch_status });
  c.pdf_path = pdf.path; c.updated_at = new Date().toISOString(); repository().save(c);
  return { complaint_id: c.id, tracking_id: c.tracking_id, pdf_url: `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf`, file_size_bytes: pdf.size };
}
export async function prepareDispatch(input: z.infer<typeof dispatchSchema>) {
  const c = getComplaint(input.complaint_id);
  if (!c.pdf_path) throw new ApiError(409, 'Generate the complaint PDF before preparing to share.');
  try { await stat(c.pdf_path); } catch { throw new ApiError(409, 'The PDF is missing. Generate it again before sharing.'); }
  const subject = c.draft_subject_en.includes(c.tracking_id) ? c.draft_subject_en : `[${c.tracking_id}] ${c.draft_subject_en}`;
  const body = `${c.draft_body_en}\n\nतक्रार गोषवारा:\n${c.draft_summary_mr}`;
  const pdfUrl = `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf`;
  const email = input.channels.includes('EMAIL') ? { ready: true, sent: false, recipient: c.target_email, subject, body, pdf_attached: false, attachment_url: pdfUrl, deep_link_url: `mailto:${encodeURIComponent(c.target_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` } : null;
  const waText = `PUNE TREE CIVIC GRIEVANCE\nRef: ${c.tracking_id}\nCategory: ${c.issue_type}\nLocation: ${c.address_landmark}\nGPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}\n\n${c.draft_summary_mr}`;
  const tweet = `Tree concern: ${c.issue_type.replaceAll('_', ' ')} at ${c.address_landmark}. Ref: ${c.tracking_id}. @PMCPune #SavePuneTrees`.slice(0, 280);
  c.dispatch_status = 'PREPARED'; c.dispatched_channels = [...new Set([...c.dispatched_channels, ...input.channels])]; c.dispatched_at = null; c.updated_at = new Date().toISOString(); repository().save(c);
  return { complaint_id: c.id, tracking_id: c.tracking_id, status: 'PREPARED', prepared_at: c.updated_at, dispatched_at: null, email,
    whatsapp: input.channels.includes('WHATSAPP') ? { ready: true, phone_number: c.target_whatsapp, deep_link_url: `https://wa.me/${c.target_whatsapp}?text=${encodeURIComponent(waText)}`, message_text: waText } : null,
    twitter: input.channels.includes('TWITTER') ? { ready: true, share_url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, tweet_text: tweet } : null,
  };
}
export function duplicates(input: z.infer<typeof duplicateSchema>) {
  const nearby = repository().list().filter(c => c.verification_status !== 'VERIFIED_RESOLVED').map(c => ({ c, distance: distanceMeters(input.latitude, input.longitude, c.latitude, c.longitude) })).filter(v => v.distance <= input.radius_meters).sort((a, b) => a.distance - b.distance).map(({ c, distance }) => ({ ...complaintSummary(c), distance_meters: Math.round(distance * 10) / 10, witness_count: c.witness_count, photo_urls: c.photo_urls }));
  return { has_duplicates: nearby.length > 0, duplicate_count: nearby.length, nearby_complaints: nearby };
}
export async function upvote(input: z.infer<typeof witnessSchema>) {
  if (!input.witness_phone?.trim()) throw new ApiError(422, 'A witness phone number is required.');
  const c = getComplaint(input.complaint_id);
  const evidence = input.corroborating_photo_base64 ? await savePhoto(input.corroborating_photo_base64) : null;
  return repository().transaction(() => {
    const current = getComplaint(c.id);
    const key = createHash('sha256').update(input.witness_phone!.replace(/\D/g, '')).digest('hex');
    const added = repository().addWitness(current.id, key, { witness_name: input.witness_name, witness_phone: input.witness_phone, photo_url: evidence });
    if (added) { current.witness_count += 1; current.updated_at = new Date().toISOString(); repository().save(current); }
    return { status: added ? 'UPVOTED' : 'ALREADY_WITNESSED', complaint_id: current.id, new_witness_count: current.witness_count, message: added ? `Added as a witness to ${current.tracking_id}.` : 'You are already a witness to this complaint.' };
  });
}
export function auditStatus(audit: Audit, citizenVerdict?: string | null) {
  if (audit.ai_verdict === 'RESOLVED_CLEARED' && audit.ai_confidence >= 0.7 && citizenVerdict !== 'DISPUTED_NOT_RESOLVED') return 'VERIFIED_RESOLVED';
  if (audit.ai_verdict === 'STILL_DAMAGED' || citizenVerdict === 'DISPUTED_NOT_RESOLVED') return 'VERIFIED_UNRESOLVED_ESCALATED';
  return 'AWAITING_CITIZEN_PHOTO';
}
export async function verify(id: string, input: z.infer<typeof verifySchema>) {
  const c = getComplaint(id);
  if (input.complaint_id !== c.id) throw new ApiError(422, 'Complaint ID does not match the requested record.');
  if (Date.now() < new Date(c.reverification_due_at).getTime()) throw new ApiError(409, `Follow-up is locked until ${c.reverification_due_at}.`);
  const distance = distanceMeters(input.latitude, input.longitude, c.latitude, c.longitude);
  if (distance > 50) throw new ApiError(422, 'Capture the follow-up photo within 50 metres of the original location.');
  decodePhoto(input.photo_base64);
  if (!c.photo_urls.length) throw new ApiError(409, 'The original evidence photo is missing.');
  const audit = await comparePhotos(c.photo_urls[0], input.photo_base64, c.issue_type, input.citizen_notes);
  const image = await savePhoto(input.photo_base64), verificationId = randomUUID();
  return repository().transaction(() => {
    const current = getComplaint(c.id); current.verification_status = auditStatus(audit, input.citizen_verdict);
    const escalated = current.verification_status === 'VERIFIED_UNRESOLVED_ESCALATED';
    if (escalated) current.reopen_count += 1;
    current.updated_at = new Date().toISOString();
    const result = { verification_id: verificationId, complaint_id: current.id, tracking_id: current.tracking_id, gps_valid: true, distance_from_original_m: Math.round(distance * 10) / 10, ...audit, final_status: current.verification_status, reopen_count: current.reopen_count, escalation_draft: escalated ? { escalation_subject: `Follow-up [${current.tracking_id}]: unresolved tree concern`, escalation_body: `I request another on-site inspection at ${current.address_landmark}. ${audit.ai_notes_en}` } : null };
    repository().saveVerification(verificationId, current.id, { ...result, photo_url: image, latitude: input.latitude, longitude: input.longitude, citizen_verdict: input.citizen_verdict });
    repository().save(current); return result;
  });
}
