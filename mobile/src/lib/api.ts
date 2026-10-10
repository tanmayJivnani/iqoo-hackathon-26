export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type Complaint = {
  domain?: 'TREES' | 'ROADS' | 'GARBAGE' | 'NOISE'; reverification_required?: boolean;
  id: string; tracking_id: string; issue_type: string; urgency_level: string;
  address_landmark: string; verification_status: string; reverification_due_at?: string | null; created_at: string;
};
export type RoutingAuthority = { name: string; role: string; email: string; whatsapp?: string | null; emergency_phone?: string | null };
export type Draft = {
  domain?: 'TREES' | 'ROADS' | 'GARBAGE' | 'NOISE'; reverification_required?: boolean;
  audio_url?: string | null; video_url?: string | null; captured_at?: string;
  complaint_id: string; tracking_id: string; issue_type: string; urgency_level: string;
  felling_stage: string; is_cognizable_offence: boolean; sensor_tilt_angle?: number | null;
  citizen_selected_category?: string | null; is_category_mismatch?: boolean; ai_suggested_category?: string | null;
  mismatch_reason_en?: string | null; mismatch_reason_mr?: string | null; ai_additional_category?: string | null;
  ai_additional_reason_en?: string | null; estimated_tree_species?: string | null; visual_damage_summary?: string | null;
  perpetrator_observed?: boolean; perpetrator_description?: string | null; perpetrator_name?: string | null;
  perpetrator_phone?: string | null; citizen_name?: string | null; citizen_phone?: string | null; citizen_email?: string | null;
  is_fallback?: boolean; ai_provider?: string | null; tree_detected?: boolean; rejection_reason?: string | null;
  latitude: number; longitude: number; address_landmark: string; ward_name: string;
  routed_authority?: RoutingAuthority | null; legal_citations: string[]; draft_subject_en: string;
  draft_body_en: string; draft_summary_mr: string; reverification_due_hours: number;
};
export type ComplaintDetail = Omit<Draft, 'routed_authority'> & {
  routed_authority?: RoutingAuthority | string | null;
  id: string; verification_status?: string; photo_urls?: string[]; target_email?: string;
  reverification_due_at?: string | null;
  pdf_path?: string | null;
};
export type LocalAnalysis = {
  available: boolean; treeDetected: boolean; rejectionReason?: string;
  estimatedTreeSpecies?: string; visualDamageSummary?: string; urgencyLevel?: string;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    });
    const text = await response.text();
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : undefined; } catch { payload = text; }
    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'detail' in payload
        ? String((payload as { detail: unknown }).detail) : `Request failed (${response.status})`;
      throw new Error(message);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function asDataUri(base64: string, mime = 'image/jpeg') {
  if (base64.startsWith('/api/')) return `${API_BASE}${base64}`;
  if (/^https?:\/\//.test(base64)) return base64;
  return base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;
}
