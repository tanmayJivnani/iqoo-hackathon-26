import { z } from 'zod';
import { categories } from './routing';

const text = z.string().trim().max(20_000);
const optionalText = text.nullish();
const photo = z.string().min(20).max(12_000_000);
const photos = z.array(photo).max(6).nullish();
export const coordinates = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const metadata = z.object({
  tracking_id: z.string().regex(/^PUNE-TREE-[A-Z0-9-]{4,80}$/).nullish(),
  issue_type: z.enum([...categories, 'ILLEGAL_FELLING_IN_PROGRESS', 'ILLEGAL_FELLING_COMPLETED']).nullish(),
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
export const dispatchSchema = z.object({
  complaint_id: z.string().min(1).max(120), confirmed_by_citizen: z.literal(true),
  channels: z.array(z.enum(['EMAIL', 'WHATSAPP', 'TWITTER'])).min(1).max(3).default(['EMAIL', 'WHATSAPP']),
});
export const duplicateSchema = coordinates.extend({ radius_meters: z.number().finite().positive().max(500).default(30) });
export const witnessSchema = z.object({ complaint_id: z.string().min(1).max(120), witness_name: optionalText, witness_phone: z.string().max(30).refine(v => /^\d{10,15}$/.test(v.replace(/\D/g, '')), 'Enter a valid witness phone number.'), corroborating_photo_base64: photo.nullish() });
export const verifySchema = coordinates.extend({ complaint_id: z.string().min(1).max(120), photo_base64: photo, citizen_notes: optionalText, citizen_verdict: z.enum(['CONFIRMED_RESOLVED', 'DISPUTED_NOT_RESOLVED']).nullish() });
export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type RenderInput = z.infer<typeof renderSchema>;
