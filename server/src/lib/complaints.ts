import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { analyzePhotos, comparePhotos, describeCivicPhotos } from './ai';
import { ApiError } from './http';
import { decodePhoto, savePhoto, decodeAudio, saveAudio, decodeVideo, saveVideo } from './media';
import { evaluateResidentialNoiseEstimate } from '../../../shared/noise-policy';
import { generatePdf } from './pdf';
import { repository } from './repository';
import { routeIssue } from './routing';
import { coordinates, type AnalyzeInput, type RenderInput, dispatchSchema, duplicateSchema, witnessSchema, verifySchema, fastDraftSchema, updateDraftSchema } from './schemas';
import { domainFor, isNightTime, issueTitles, requiresReverification } from './civic';
import { distanceMeters, locate } from './spatial';
import type { Complaint, Audit } from './types';
import type { z } from 'zod';

export function getComplaint(id: string) {
  const c = repository().get(id);
  if (!c) throw new ApiError(404, 'Complaint not found.');
  cleanNotice(c);
  return c;
}
function capitalizeSubject(value: string) { return value.trim().replace(/^([a-z])/, letter => letter.toUpperCase()); }
function cleanNotice(c: Complaint) {
  c.draft_subject_en = capitalizeSubject(c.draft_subject_en);
  c.draft_body_en = c.draft_body_en.replace(/\s*The app['’]s follow[- ]up reminder is not a statutory deadline\./g, '');
}
export function complaintSummary(c: Complaint) {
  return {
    id: c.id,
    tracking_id: c.tracking_id,
    domain: c.domain || domainFor(c.issue_type),
    reverification_required: c.reverification_required ?? requiresReverification(c.issue_type),
    issue_type: c.issue_type,
    urgency_level: c.urgency_level,
    address_landmark: c.address_landmark,
    verification_status: c.verification_status,
    reverification_due_at: c.reverification_due_at,
    created_at: c.created_at,
    latitude: c.latitude,
    longitude: c.longitude,
    ward_name: c.ward_name,
    has_photos: Boolean(c.photo_urls && c.photo_urls.length > 0),
    has_audio: Boolean(c.audio_url),
    witness_count: c.witness_count,
  };
}
export function draftResponse(c: Complaint) {
  cleanNotice(c);
  return { ...c, pdf_path: c.pdf_path ? `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf` : null, is_category_mismatch: false, ai_suggested_category: null, mismatch_reason_en: null, mismatch_reason_mr: null, rejection_reason: null, perpetrator_observed: Boolean(c.perpetrator_name || c.perpetrator_phone), reverification_due_date: c.reverification_due_at };
}
function buildComplaint(input: RenderInput, id: string, trackingId: string): Complaint {
  const gps = coordinates.safeParse({ latitude: input.latitude, longitude: input.longitude });
  if (!gps.success) throw new ApiError(422, 'Real GPS coordinates are required to register a local draft.');
  const route = routeIssue(input.issue_type || 'HAZARDOUS_BRANCH', input.felling_stage || 'NOT_APPLICABLE');
  const now = new Date().toISOString();
  const place = locate(gps.data.latitude, gps.data.longitude);
  return {
    domain: domainFor(route.issue_type), reverification_required: requiresReverification(route.issue_type),
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
function trackingId(prefix = 'TREE') { return `PUNE-${prefix}-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`; }
export async function fastDraft(input: z.infer<typeof fastDraftSchema>) {
  const domain = domainFor(input.issue_type), isNoise = domain === 'NOISE';
  const capturedAt = new Date(input.captured_at).getTime();
  if (capturedAt > Date.now() + 60_000 || capturedAt < Date.now() - 24 * 3600_000) throw new ApiError(422, 'Capture fresh evidence before preparing this report.');
  if (isNoise) {
    if (!input.audio_base64 || !input.noise_evidence) throw new ApiError(422, 'Noise reports require an audio recording and microphone readings.');
    decodeAudio(input.audio_base64);
    if (input.noise_evidence.average_dbfs > input.noise_evidence.peak_dbfs) throw new ApiError(422, 'Average audio level cannot exceed its peak.');
    const levels = input.noise_evidence;
    if ((levels.average_dba != null || levels.peak_dba != null) && (levels.measurement_method !== 'KOTLIN_AUDIO_RECORD_A_WEIGHTED' || levels.average_dba == null || levels.peak_dba == null || levels.average_dba > levels.peak_dba)) throw new ApiError(422, 'A-weighted estimates require the native measurement method and consistent average/peak readings.');
    const policy = evaluateResidentialNoiseEstimate(levels.average_dba, isNightTime(input.captured_at));
    if (!policy.allowed) throw new ApiError(422, policy.reason!);
    if (levels.peak_dbfs <= -60) throw new ApiError(422, 'The recording is too quiet. Please re-record.');
    if (input.video_base64) decodeVideo(input.video_base64);
  } else {
    if (!input.photos_base64.length) throw new ApiError(422, 'A photo of the concern is required.');
    if (domain === 'TREES' && input.photos_base64.length !== 2) throw new ApiError(422, 'Tree reports require two photos: the whole tree and location, then a close-up of the issue.');
    if (input.audio_base64 || input.video_base64 || input.noise_evidence) throw new ApiError(422, 'Use a noise category for microphone/video evidence.');
  }
  const allPhotos = [...input.photos_base64, ...input.perpetrator_photos_base64];
  allPhotos.forEach(decodePhoto);
  const local = input.ai_mode !== 'CLOUD';
  const localVision = input.ai_mode === 'LOCAL_QWEN_OMNI' || input.ai_mode === 'LOCAL_QWEN_35';
  const analysis = !isNoise && !local ? await describeCivicPhotos(input.issue_type, input.photos_base64, input.citizen_notes) : null;
  const route = routeIssue(input.issue_type), tracking = trackingId('FAST');
  if (domain === 'TREES') {
    // Fast reports have no verified permit status or legal finding. Keep inherited
    // tree AI rules from asserting an offence or an unverified statutory duty.
    route.legal_citations = ['Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975'];
    if (['ILLEGAL_FELLING', 'UNAUTHORIZED_PRUNING'].includes(input.issue_type)) route.legal_citations.push('Sections 8 and 21 — permissions and applicable enforcement, subject to inspection');
    route.prayer_en = 'Please inspect the reported tree condition, check any required permissions, and take appropriate safety, preservation and enforcement action under applicable law.';
    route.prayer_mr = 'कृपया नमूद वृक्षाची व जोडलेल्या पुराव्यांची पाहणी करून आवश्यक परवानग्या तपासाव्यात आणि वृक्ष संरक्षण व नागरिकांच्या सुरक्षेसाठी योग्य कार्यवाही करावी.';
    route.routed_authority.role = 'Tree-related inspection and appropriate safety or preservation action';
  }
  const title = issueTitles[input.issue_type] || input.issue_type.replaceAll('_', ' ').toLowerCase();
  const landmark = input.address_landmark || locate(input.latitude, input.longitude).address_landmark;
  const recording = input.noise_evidence;
  const evidenceText = recording ? `Audio recording: ${recording.duration_ms / 1000} seconds. Uncalibrated microphone readings: average ${recording.average_dbfs.toFixed(1)} dBFS, peak ${recording.peak_dbfs.toFixed(1)} dBFS. These are digital levels, not calibrated dB(A) sound-pressure measurements and do not establish a legal threshold breach.\nDevice-reported capture time: ${input.captured_at}; ${isNightTime(input.captured_at) ? 'within' : 'outside'} the usual 22:00–06:00 IST night period.\n${recording.near_sensitive_site ? `Citizen reports a nearby sensitive site: ${recording.site_label || 'hospital, school or similar site'}. Please verify the location and whether it is a notified silence zone.` : 'Silence-zone status has not been verified.'}` : `${input.photos_base64.length} photograph(s) attached. Evidence intake (device-reported): ${input.captured_at}. GPS is the phone location at intake; original timestamps and locations of imported photos have not been verified. The selected issue and observations are citizen-reported; please verify on site.`;
  const c = buildComplaint({ ...input, complaint_id: '', draft_subject_en: `${capitalizeSubject(title)} — request for action [${tracking}]`, draft_body_en: `To ${route.routed_authority.name},\n\nI report a ${title.toLowerCase()} at ${landmark}.\nGPS: ${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}${input.gps_accuracy_m != null ? ` (device-reported accuracy ±${input.gps_accuracy_m.toFixed(0)} m)` : ''}.\n\n${evidenceText}\n${local ? `\n${localVision ? (isNoise ? 'Summary of citizen observations and device-reported measurements' : 'Observations from supplied photos (subject to authority verification)') : 'Summary of citizen observations and measurements (photos/audio not analyzed)'}:\n${input.local_text!.observations_en}\n` : ''}${analysis ? `\nObservations from the attached photos (subject to authority verification):\n${analysis.result.observations_en}\n` : ''}${input.citizen_notes ? `\nMy observations: ${input.citizen_notes}\n` : ''}\nApplicable references: ${route.legal_citations.join('; ')}.\n${route.prayer_en}\n\nPlease acknowledge receipt, confirm jurisdiction and provide an action-taken response and expected timeline.\n\nSincerely,\n${input.citizen_name || 'Concerned Pune Citizen'}${input.citizen_phone ? `\nPhone: ${input.citizen_phone}` : ''}\nReference: ${tracking}`, draft_summary_mr: local ? `${input.local_text!.observations_mr}\n\n${route.prayer_mr}` : analysis ? `${analysis.result.observations_mr}\n\n${route.prayer_mr}` : route.prayer_mr }, randomUUID(), tracking);
  c.tree_detected = domain === 'TREES' && Boolean(analysis); c.is_cognizable_offence = false; c.evidence_classification = analysis || (localVision && !isNoise) ? 'AI_ASSISTED_VISUAL' : 'CITIZEN_REPORTED'; c.is_fallback = false; c.ai_provider = local ? localVision ? input.ai_mode : 'LOCAL_QWEN_TEXT' : analysis?.provider || 'MEASURED_NOISE_TEMPLATE';
  c.visual_damage_summary = local ? `${localVision ? (isNoise ? "Local summary" : "Local photo observations") : "Citizen-reported; photos not analyzed"}: ${input.local_text!.observations_en}` : analysis?.result.observations_en || null;
  c.additional_issues = (analysis?.result.additional_issues || (localVision ? input.local_text?.additional_issues : []) || []).filter((item, index, items) => item.category !== input.issue_type && domainFor(item.category) === domain && items.findIndex(other => other.category === item.category) === index);
  c.accepted_additional_categories = [];
  c.ai_additional_category = c.additional_issues[0]?.category || null;
  c.ai_additional_reason_en = c.additional_issues[0]?.reason_en || null;
  c.legal_citations = route.legal_citations; c.routed_authority = route.routed_authority; c.routed_authority_role = route.routed_authority.role;
  c.citizen_selected_category = input.issue_type; c.captured_at = input.captured_at; c.gps_accuracy_m = input.gps_accuracy_m ?? null;
  c.photo_urls = await Promise.all(allPhotos.map(savePhoto));
  if (isNoise && input.audio_base64 && recording) {
    const audio = await saveAudio(input.audio_base64); c.audio_url = audio.url; c.audio_sha256 = audio.sha256;
    c.noise_evidence = { ...recording, night_time: isNightTime(input.captured_at) };
    if (input.video_base64) { const video = await saveVideo(input.video_base64); c.video_url = video.url; c.video_sha256 = video.sha256; }
  }
  if (!c.reverification_required) { c.reverification_due_at = null; c.verification_status = 'REPORTED'; }
  repository().save(c); return draftResponse(c);
}
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
export function updateDraft(input: z.infer<typeof updateDraftSchema>) {
  return repository().transaction(() => {
    const c = getComplaint(input.complaint_id);
    const previous = c.accepted_additional_categories || [];
    const accepted = [...new Set([...previous, ...(input.accepted_additional_categories || [])])];
    const candidates = c.additional_issues || [];
    if (accepted.some(category => !candidates.some(item => item.category === category))) throw new ApiError(422, 'Only issues identified in this evidence can be added.');
    c.draft_subject_en = input.draft_subject_en;
    c.draft_body_en = input.draft_body_en;
    c.draft_summary_mr = input.draft_summary_mr;
    for (const category of accepted.filter(value => !previous.includes(value))) {
      const issue = candidates.find(item => item.category === category)!;
      const label = issueTitles[category] || category.replaceAll('_', ' ').toLowerCase();
      const paragraph = `Additional concern confirmed by me — ${label}:\n${issue.reason_en}\nPlease inspect this concern as well and take appropriate action. These are image-based observations, subject to on-site verification.`;
      const signoff = c.draft_body_en.lastIndexOf('\n\nSincerely,');
      c.draft_body_en = signoff >= 0 ? `${c.draft_body_en.slice(0, signoff)}\n\n${paragraph}${c.draft_body_en.slice(signoff)}` : `${c.draft_body_en}\n\n${paragraph}`;
      c.draft_summary_mr += `\n\nमी पुष्टी केलेली अतिरिक्त समस्या:\n${issue.reason_mr}\nकृपया या समस्येचीही प्रत्यक्ष पाहणी करून योग्य कार्यवाही करावी.`;
    }
    c.accepted_additional_categories = accepted;
    cleanNotice(c);
    c.pdf_path = null;
    c.updated_at = new Date().toISOString();
    repository().save(c);
    return draftResponse(c);
  });
}
export async function renderPdf(input: RenderInput) {
  let c = repository().get(input.complaint_id);
  if (!c && input.tracking_id) c = repository().get(input.tracking_id);
  const newRecord = !c;
  const reportPhotos = input.photos_base64?.length ? input.photos_base64 : input.photo_base64 ? [input.photo_base64] : [];
  const photoInputs = [...reportPhotos, ...(input.perpetrator_photos_base64 || [])];
  photoInputs.forEach(decodePhoto);
  if (!c) {
    if (input.issue_type && domainFor(input.issue_type) !== 'TREES') throw new ApiError(422, 'Register civic evidence through fast-draft before rendering its PDF.');
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
  cleanNotice(c);
  const pdf = await generatePdf(c);
  // Re-read counters after asynchronous PDF work so a concurrent witness/audit isn't overwritten.
  const latest = repository().get(c.id);
  if (latest) Object.assign(c, { witness_count: latest.witness_count, reopen_count: latest.reopen_count, verification_status: latest.verification_status, dispatched_at: latest.dispatched_at, dispatched_channels: latest.dispatched_channels, dispatch_status: latest.dispatch_status });
  c.pdf_path = pdf.path; c.updated_at = new Date().toISOString(); repository().save(c);
  return { complaint_id: c.id, tracking_id: c.tracking_id, pdf_url: `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf`, file_size_bytes: pdf.size };
}
export async function prepareDispatch(input: z.infer<typeof dispatchSchema>) {
  const c = getComplaint(input.complaint_id);
  if (c.domain === 'NOISE' || domainFor(c.issue_type) === 'NOISE') {
    const policy = evaluateResidentialNoiseEstimate(c.noise_evidence?.average_dba, isNightTime(c.captured_at || c.created_at));
    if (!policy.allowed) throw new ApiError(422, policy.reason!);
  }
  if (!c.pdf_path) throw new ApiError(409, 'Generate the complaint PDF before preparing to share.');
  try { await stat(c.pdf_path); } catch { throw new ApiError(409, 'The PDF is missing. Generate it again before sharing.'); }
  const subject = c.draft_subject_en.includes(c.tracking_id) ? c.draft_subject_en : `[${c.tracking_id}] ${c.draft_subject_en}`;
  const body = `${c.draft_body_en}\n\nतक्रार गोषवारा:\n${c.draft_summary_mr}`;
  const pdfUrl = `/api/v1/complaints/${encodeURIComponent(c.id)}/download-pdf`;
  const email = input.channels.includes('EMAIL') ? { ready: true, sent: false, recipient: c.target_email, subject, body, pdf_attached: false, attachment_url: pdfUrl, audio_attachment_url: c.audio_url || null, video_attachment_url: c.video_url || null, deep_link_url: `mailto:${encodeURIComponent(c.target_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` } : null;
  if (input.channels.includes('WHATSAPP') && !c.target_whatsapp) throw new ApiError(422, 'A WhatsApp contact is not configured for this authority. Use email or the police phone shortcut.');
  const waText = `PUNE FAST COMPLAINT\nRef: ${c.tracking_id}\nCategory: ${c.issue_type}\nLocation: ${c.address_landmark}\nGPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}\n\n${c.draft_summary_mr}`;
  const tweet = `Civic concern: ${c.issue_type.replaceAll('_', ' ')} at ${c.address_landmark}. Ref: ${c.tracking_id}. #PuneFastComplaint`.slice(0, 280);
  c.dispatch_status = 'PREPARED'; c.dispatched_channels = [...new Set([...c.dispatched_channels, ...input.channels])]; c.dispatched_at = null; c.updated_at = new Date().toISOString(); repository().save(c);
  return { complaint_id: c.id, tracking_id: c.tracking_id, status: 'PREPARED', prepared_at: c.updated_at, dispatched_at: null, email,
    whatsapp: input.channels.includes('WHATSAPP') ? { ready: true, phone_number: c.target_whatsapp, deep_link_url: `https://wa.me/${c.target_whatsapp}?text=${encodeURIComponent(waText)}`, message_text: waText } : null,
    twitter: input.channels.includes('TWITTER') ? { ready: true, share_url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, tweet_text: tweet } : null,
  };
}
export function duplicates(input: z.infer<typeof duplicateSchema>) {
  const nearby = repository().list().filter(c => c.verification_status !== 'VERIFIED_RESOLVED' && (!input.domain || domainFor(c.issue_type) === input.domain)).map(c => ({ c, distance: distanceMeters(input.latitude, input.longitude, c.latitude, c.longitude) })).filter(v => v.distance <= input.radius_meters).sort((a, b) => a.distance - b.distance).map(({ c, distance }) => ({ ...complaintSummary(c), distance_meters: Math.round(distance * 10) / 10, witness_count: c.witness_count, photo_urls: c.photo_urls }));
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
  if (!(c.reverification_required ?? requiresReverification(c.issue_type))) throw new ApiError(409, 'Photo re-verification is not enabled for this incident type.');
  if (input.complaint_id !== c.id) throw new ApiError(422, 'Complaint ID does not match the requested record.');
  if (c.reverification_due_at && Date.now() < new Date(c.reverification_due_at).getTime()) throw new ApiError(409, `Follow-up is locked until ${c.reverification_due_at}.`);
  const distance = distanceMeters(input.latitude, input.longitude, c.latitude, c.longitude);
  if (distance > 50) throw new ApiError(422, 'Capture the follow-up photo within 50 metres of the original location.');
  decodePhoto(input.photo_base64);
  if (!c.photo_urls.length) throw new ApiError(409, 'The original evidence photo is missing.');
  const audit: Audit = input.ai_mode !== 'CLOUD' ? {
    ai_verdict: 'INCONCLUSIVE', ai_confidence: 0, is_fallback: false, ai_provider: input.ai_mode === 'LOCAL_QWEN_OMNI' || input.ai_mode === 'LOCAL_QWEN_35' ? input.ai_mode : 'LOCAL_QWEN_TEXT',
    ai_notes_en: ` ${(input.ai_mode === "LOCAL_QWEN_OMNI" || input.ai_mode === "LOCAL_QWEN_35") ? "Local photo comparison is advisory; authority confirmation is required." : "Local Qwen cannot compare photographs. Citizen-observation summary:"} ${input.local_text!.observations_en}`.trim(),
    ai_notes_mr: `${(input.ai_mode === "LOCAL_QWEN_OMNI" || input.ai_mode === "LOCAL_QWEN_35") ? "स्थानिक छायाचित्रांचे निरीक्षण सल्लागार स्वरूपाचे आहे; अधिकाऱ्यांची पुष्टी आवश्यक आहे." : "स्थानिक Qwen छायाचित्रांची तुलना करू शकत नाही. नागरिकांच्या निरीक्षणांचा सारांश:"} ${input.local_text!.observations_mr}`,
  } : await comparePhotos(c.photo_urls[0], input.photo_base64, c.issue_type, input.citizen_notes);
  const image = await savePhoto(input.photo_base64), verificationId = randomUUID();
  return repository().transaction(() => {
    const current = getComplaint(c.id); current.verification_status = auditStatus(audit, input.citizen_verdict);
    const escalated = current.verification_status === 'VERIFIED_UNRESOLVED_ESCALATED';
    if (escalated) current.reopen_count += 1;
    current.updated_at = new Date().toISOString();
    const result = { verification_id: verificationId, complaint_id: current.id, tracking_id: current.tracking_id, gps_valid: true, distance_from_original_m: Math.round(distance * 10) / 10, ...audit, final_status: current.verification_status, reopen_count: current.reopen_count, escalation_draft: escalated ? { escalation_subject: `Follow-up [${current.tracking_id}]: unresolved ${issueTitles[current.issue_type] || 'tree concern'}`, escalation_body: `I request another on-site inspection at ${current.address_landmark}. ${audit.ai_notes_en}` } : null };
    repository().saveVerification(verificationId, current.id, { ...result, photo_url: image, latitude: input.latitude, longitude: input.longitude, citizen_verdict: input.citizen_verdict });
    repository().save(current); return result;
  });
}
