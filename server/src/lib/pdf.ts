import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { config } from './config';
import { photoBytes } from './media';
import type { Complaint } from './types';

export function evidenceDigest(c: Complaint) {
  return createHash('sha256').update(JSON.stringify({ tracking_id: c.tracking_id, latitude: c.latitude, longitude: c.longitude, created_at: c.created_at, draft_body_en: c.draft_body_en, draft_summary_mr: c.draft_summary_mr, photo_urls: c.photo_urls })).digest('hex');
}
export function pdfPath(c: Complaint) { return path.join(config.mediaDir, `${c.id.replace(/[^a-zA-Z0-9-]/g, '_')}_Notice.pdf`); }
export async function generatePdf(c: Complaint) {
  await mkdir(config.mediaDir, { recursive: true });
  const font = await readFile(path.join(process.cwd(), 'assets', 'NotoSansDevanagari-Regular.ttf'));
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: c.draft_subject_en, Author: c.citizen_name || 'Concerned citizen', Subject: c.tracking_id } });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  doc.registerFont('Marathi', font);
  const heading = (text: string) => { doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).fillColor('#185b38').text(text).moveDown(0.3); };
  const body = (text: string) => doc.font('Helvetica').fontSize(10).fillColor('#202b24').text(text, { lineGap: 3 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#185b38').text('Pune Tree Rakshak');
  body(`Citizen complaint | ${c.tracking_id}\nCreated: ${new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  heading('Complaint details');
  body(`Category: ${c.issue_type.replaceAll('_', ' ')}\nUrgency: ${c.urgency_level.replaceAll('_', ' ')}\nLocation: ${c.address_landmark}\nGPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}\nWard (approximate): ${c.ward_name}\nTo: ${c.routed_authority.name}\nEmail: ${c.target_email}`);
  heading('Subject'); body(c.draft_subject_en);
  heading('Citizen statement'); body(c.draft_body_en);
  heading('Routing references'); c.legal_citations.forEach(citation => body(citation));
  heading('Marathi summary'); doc.font('Marathi').fontSize(11).fillColor('#202b24').text(c.draft_summary_mr, { lineGap: 4 });
  doc.addPage(); heading('Evidence record');
  body(`Reference: ${c.tracking_id}\nSHA-256 record digest: ${evidenceDigest(c)}\nThis digest identifies the current record; it is not a government-issued signature or certificate.`);
  const qr = await QRCode.toBuffer(`${config.publicBaseUrl}/api/v1/complaints/verify/${encodeURIComponent(c.tracking_id)}`);
  const y = doc.y + 12; doc.image(qr, 48, y, { width: 110 }); doc.y = y + 125;
  body('Scan to retrieve the complaint record. The link works while this backend address is reachable.');
  for (let i = 0; i < c.photo_urls.length; i++) {
    doc.addPage(); heading(`Evidence photo ${i + 1} of ${c.photo_urls.length}`);
    body(`${c.tracking_id} | GPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`);
    try { doc.image(await photoBytes(c.photo_urls[i]), 48, doc.y + 20, { fit: [499, 580], align: 'center', valign: 'center' }); }
    catch { body('This historical image could not be decoded. Please recapture evidence before sharing.'); }
  }
  doc.end();
  const bytes = await complete;
  const destination = pdfPath(c), temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  return { path: destination, size: bytes.length };
}
