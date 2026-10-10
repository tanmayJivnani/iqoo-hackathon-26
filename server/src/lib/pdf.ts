import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { config } from './config';
import { photoBytes, mediaPath } from './media';
import type { Complaint } from './types';

export function evidenceDigest(c: Complaint) {
  return createHash('sha256').update(JSON.stringify({ tracking_id: c.tracking_id, latitude: c.latitude, longitude: c.longitude, created_at: c.created_at, draft_body_en: c.draft_body_en, draft_summary_mr: c.draft_summary_mr, photo_urls: c.photo_urls, captured_at: c.captured_at, audio_sha256: c.audio_sha256, video_sha256: c.video_sha256, noise_evidence: c.noise_evidence })).digest('hex');
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
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#185b38').text('Pune Fast Complaint');
  body(`Citizen complaint | ${c.tracking_id}\nCreated: ${new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  heading('Complaint details');
  body(`Category: ${c.issue_type.replaceAll('_', ' ')}\nUrgency: ${c.urgency_level.replaceAll('_', ' ')}\nLocation: ${c.address_landmark}\nGPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}\nWard (approximate): ${c.ward_name}\nTo: ${c.routed_authority.name}\nEmail: ${c.target_email}`);
  heading('Subject'); body(c.draft_subject_en);
  heading('Citizen statement'); body(c.draft_body_en);
  if (c.noise_evidence && c.audio_url) {
    heading('Audio evidence');
    const audioFileName = c.audio_url.split('/').at(-1)!;
    const audioExt = audioFileName.endsWith('.wav') ? 'wav' : 'm4a';
    const dbaText = c.noise_evidence.average_dba != null
      ? `Estimated A-weighted sound level: ${c.noise_evidence.average_dba.toFixed(1)} dB(A) average. Uncalibrated microphone with an assumed sensitivity offset; not a verified acoustic measurement or legal threshold test.\n`
      : '';
    body(`Recording: ${c.noise_evidence.duration_ms / 1000} seconds\nCaptured (device-reported): ${c.captured_at}\n${dbaText}Digital microphone level: ${c.noise_evidence.average_dbfs.toFixed(1)} dBFS average / ${c.noise_evidence.peak_dbfs.toFixed(1)} dBFS peak\nMeasurement method: ${c.noise_evidence.measurement_method === 'KOTLIN_AUDIO_RECORD_A_WEIGHTED' ? 'IEC 61672 A-weighted digital filter (Android AudioRecord)' : 'Uncalibrated mobile sensor'}\nSHA-256 audio digest: ${c.audio_sha256}\nThe audio recording is embedded as a file attachment in this PDF.`);
    doc.file(await readFile(mediaPath(audioFileName)), { name: `${c.tracking_id}.${audioExt}`, description: 'Citizen-recorded ambient audio evidence.' });
  }
  if (c.video_url) {
    heading('Video evidence');
    body(`Video was captured alongside the separate audio sample. SHA-256 video digest: ${c.video_sha256}. The video is embedded as a file attachment.`);
    doc.file(await readFile(mediaPath(c.video_url.split('/').at(-1)!)), { name: `${c.tracking_id}.mp4`, description: 'Citizen-recorded visual evidence; audio is attached separately.' });
  }
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
