import { z } from 'zod';
import { categories } from './routing';
import { civicCategories } from './civic';

const text = z.string().trim().max(20_000);
const optionalText = text.nullish();
const photo = z.string().min(20).max(12_000_000);
const photos = z.array(photo).max(6).nullish();
export const coordinates = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const metadata = z.object({
  tracking_id: z.string().regex(/^PUNE-(TREE|FAST)-[A-Z0-9-]{4,80}$/).nullish(),
  issue_type: z.enum([...categories, ...civicCategories, 'ILLEGAL_FELLING_IN_PROGRESS', 'ILLEGAL_FELLING_COMPLETED']).nullish(),
  urgency_level: z.enum(['CRITICAL_EMERGENCY', 'HIGH', 'MEDIUM', 'ROUTINE']).nullish(),
  felling_stage: z.enum(['IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE']).nullish(),
  sensor_tilt_angle: z.number().finite().min(-180).max(180).nullish(),
  citizen_name: optionalText, citizen_phone: optionalText, citizen_email: z.union([z.email(), z.literal('')]).nullish(),
  perpetrator_name: optionalText, perpetrator_phone: optionalText,
  address_landmark: optionalText, ward_name: optionalText,
  draft_subject_en: optionalText, draft_body_en: optionalText, draft_summary_mr: optionalText,
  estimated_tree_species: optionalText, visual_damage_summary: optionalText,
});
export const analyzeSchema = metadata.extend({
  ...coordinates.shape, photo_base64: photo, photos_base64: photos,
  perpetrator_photos_base64: z.array(photo).max(3).nullish(),
  citizen_selected_category: z.string().max(500).refine(v => v.split(',').every(c => categories.includes(c.trim() as typeof categories[number])), 'Unknown issue category').nullish(),
  citizen_notes: optionalText,
});
export const renderSchema = metadata.extend({
  complaint_id: z.string().min(1).max(120),
  latitude: coordinates.shape.latitude.optional(), longitude: coordinates.shape.longitude.optional(),
  photo_base64: photo.nullish(), photos_base64: photos,
});
export const fastDraftSchema = metadata.extend({
  ...coordinates.shape,
  issue_type: z.enum([...categories, ...civicCategories]),
  captured_at: z.iso.datetime(), gps_accuracy_m: z.number().finite().nonnegative().max(10_000).nullish(),
  photos_base64: z.array(photo).max(6).default([]), perpetrator_photos_base64: z.array(photo).max(3).default([]), citizen_notes: optionalText,
  audio_base64: z.string().max(4_200_000).optional(),
  video_base64: z.string().max(11_200_000).optional(),
  noise_evidence: z.object({
    duration_ms: z.number().int().min(5000).max(30_000),
    average_dbfs: z.number().finite().min(-160).max(0), peak_dbfs: z.number().finite().min(-160).max(0),
    average_dba: z.number().finite().min(0).max(160).optional(), peak_dba: z.number().finite().min(0).max(160).optional(),
    sample_count: z.number().int().min(2).max(10_000_000), unit: z.literal('dBFS'),
    near_sensitive_site: z.boolean().default(false), site_label: z.string().trim().max(150).optional(),
    measurement_method: z.enum(['KOTLIN_AUDIO_RECORD_A_WEIGHTED', 'EXPO_AUDIO_METERED']).optional(),
  }).optional(),
});
export const dispatchSchema = z.object({
  complaint_id: z.string().min(1).max(120), confirmed_by_citizen: z.literal(true),
  channels: z.array(z.enum(['EMAIL', 'WHATSAPP', 'TWITTER'])).min(1).max(3).default(['EMAIL', 'WHATSAPP']),
});
export const duplicateSchema = coordinates.extend({ radius_meters: z.number().finite().positive().max(500).default(30), domain: z.enum(['TREES', 'ROADS', 'GARBAGE', 'NOISE']).optional() });
export const witnessSchema = z.object({ complaint_id: z.string().min(1).max(120), witness_name: optionalText, witness_phone: z.string().max(30).refine(v => /^\d{10,15}$/.test(v.replace(/\D/g, '')), 'Enter a valid witness phone number.'), corroborating_photo_base64: photo.nullish() });
export const verifySchema = coordinates.extend({ complaint_id: z.string().min(1).max(120), photo_base64: photo, citizen_notes: optionalText, citizen_verdict: z.enum(['CONFIRMED_RESOLVED', 'DISPUTED_NOT_RESOLVED']).nullish() });
export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type RenderInput = z.infer<typeof renderSchema>;
