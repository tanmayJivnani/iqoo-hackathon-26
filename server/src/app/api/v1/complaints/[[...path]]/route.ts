import { readFile } from 'node:fs/promises';
import { analyze, fastDraft, complaintSummary, draftResponse, duplicates, getComplaint, prepareDispatch, renderPdf, upvote, verify, updateDraft } from '../../../../../lib/complaints';
import { ApiError, corsHeaders, handle, parseBody } from '../../../../../lib/http';
import { evidenceDigest, pdfPath } from '../../../../../lib/pdf';
import { repository } from '../../../../../lib/repository';
import { pdfViewer, pdfViewerAsset } from '../../../../../lib/pdf-viewer';
import { analyzeSchema, fastDraftSchema, dispatchSchema, duplicateSchema, renderSchema, verifySchema, witnessSchema, updateDraftSchema } from '../../../../../lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(request: Request, context: Context) {
  return handle(request, async () => {
    const segments = (await context.params).path || [];
    if (segments.length === 2 && segments[0] === 'pdf-assets') return pdfViewerAsset(segments[1]);
    if (segments.length === 2 && segments[1] === 'view-pdf') {
      const c = getComplaint(segments[0]);
      if (!c.pdf_path) throw new ApiError(404, 'PDF not yet generated.');
      return pdfViewer(c.id);
    }
    if (!segments.length) return repository().list().map(complaintSummary);
    if (segments.length === 1) return draftResponse(getComplaint(segments[0]));
    if (segments.length === 2 && segments[0] === 'verify') {
      const c = getComplaint(segments[1]);
      return { status: 'RECORD_FOUND', tracking_id: c.tracking_id, complaint_id: c.id, issue_type: c.issue_type, created_at: c.created_at, location: { latitude: c.latitude, longitude: c.longitude, landmark: c.address_landmark, ward: c.ward_name }, routed_authority: c.routed_authority.name, complaint_status: c.verification_status, sha256_evidence_digest: evidenceDigest(c) };
    }
    if (segments.length === 2 && segments[1] === 'download-pdf') {
      const c = getComplaint(segments[0]);
      if (!c.pdf_path) throw new ApiError(404, 'PDF not yet generated.');
      let bytes: Buffer;
      try { bytes = await readFile(pdfPath(c)); }
      catch { throw new ApiError(404, 'PDF not found. Generate it again.'); }
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${c.tracking_id}.pdf"` } });
    }
    throw new ApiError(404, 'Endpoint not found.');
  });
}
export async function POST(request: Request, context: Context) {
  return handle(request, async () => {
    const segments = (await context.params).path || [];
    if (segments.length === 1) {
      switch (segments[0]) {
        case 'check-duplicate': return duplicates(await parseBody(request, duplicateSchema));
        case 'upvote-witness': return upvote(await parseBody(request, witnessSchema));
        case 'analyze-and-draft': return analyze(await parseBody(request, analyzeSchema));
        case 'fast-draft': return fastDraft(await parseBody(request, fastDraftSchema));
        case 'update-draft': return updateDraft(await parseBody(request, updateDraftSchema));
        case 'render-pdf': return renderPdf(await parseBody(request, renderSchema));
        case 'dispatch': return prepareDispatch(await parseBody(request, dispatchSchema));
      }
    }
    if (segments.length === 2 && segments[1] === 'verify') return verify(segments[0], await parseBody(request, verifySchema));
    throw new ApiError(404, 'Endpoint not found.');
  });
}
export function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: corsHeaders(request) }); }
