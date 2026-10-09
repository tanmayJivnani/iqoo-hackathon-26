import nextEnv from '@next/env';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Complaint } from '../src/lib/types';

nextEnv.loadEnvConfig(process.cwd());
const { ComplaintRepository } = await import('../src/lib/repository');
const { routeIssue } = await import('../src/lib/routing');
const { savePhoto } = await import('../src/lib/media');
const sourcePath = path.resolve(process.argv[2] || '../backend/pune_trees.db');
if (!existsSync(sourcePath)) throw new Error(`Legacy database not found: ${sourcePath}`);
const source = new DatabaseSync(sourcePath, { readOnly: true });
const target = new ComplaintRepository();
function list(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []; }
  catch { return []; }
}
function date(value: unknown) {
  if (!value) return new Date().toISOString();
  const raw = String(value).replace(' ', 'T');
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : `${raw}Z`).toISOString();
}
let imported = 0, skipped = 0, missingPhotos = 0;
try {
  for (const row of source.prepare('SELECT * FROM complaints').all()) {
    const id = String(row.id);
    if (target.get(id)) { skipped++; continue; }
    const route = routeIssue(String(row.issue_type), String(row.felling_stage || 'NOT_APPLICABLE'));
    const photos: string[] = [];
    for (const photo of list(row.photo_urls)) {
      try { photos.push(await savePhoto(photo)); }
      catch { missingPhotos++; }
    }
    const record = {
      ...row, id, complaint_id: id,
      latitude: Number(row.latitude), longitude: Number(row.longitude),
      witness_count: Number(row.witness_count || 1), reopen_count: Number(row.reopen_count || 0),
      routed_authority: { ...route.routed_authority, name: String(row.routed_authority || route.routed_authority.name), role: String(row.routed_authority_role || route.routed_authority.role), email: String(row.target_email || route.routed_authority.email) },
      legal_citations: list(row.legal_citations), photo_urls: photos,
      dispatched_channels: list(row.dispatched_channels), pdf_path: null,
      is_cognizable_offence: route.is_cognizable_offence, reverification_due_hours: route.reverification_due_hours,
      created_at: date(row.created_at), updated_at: date(row.updated_at), reverification_due_at: date(row.reverification_due_at),
      dispatched_at: row.dispatched_at ? date(row.dispatched_at) : null,
      citizen_selected_category: null, ai_additional_category: null, ai_additional_reason_en: null,
      estimated_tree_species: null, visual_damage_summary: null, tree_detected: true,
      is_fallback: false, ai_provider: 'LEGACY_IMPORT', fallback_reason: null,
    } as unknown as Complaint;
    target.transaction(() => {
      target.save(record);
      for (const audit of source.prepare('SELECT * FROM complaint_verifications WHERE complaint_id = ?').all(id)) target.saveVerification(String(audit.id), id, audit);
    });
    imported++;
  }
  console.log(`Imported ${imported} complaints; skipped ${skipped} existing records; ${missingPhotos} historical images were invalid or unavailable. Source left unchanged.`);
} finally { source.close(); target.close(); }
