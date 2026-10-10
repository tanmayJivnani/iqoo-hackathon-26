import type { Draft } from './api';

export type EmailEvidencePayload = {
  ready: boolean; recipient: string; subject: string; body: string;
  attachment_url: string; audio_attachment_url?: string | null; video_attachment_url?: string | null;
};
export type EmailAttachment = { url: string; filename: string; label: string };
type EvidenceReport = Pick<Draft, 'tracking_id' | 'domain' | 'audio_url' | 'video_url'>;

export function emailAttachmentPlan(report: EvidenceReport, email: EmailEvidencePayload): EmailAttachment[] {
  if (!email.attachment_url) throw new Error('The report PDF is missing. Generate it again before sharing.');
  const audio = email.audio_attachment_url || report.audio_url;
  const video = email.video_attachment_url || report.video_url;
  if (report.domain === 'NOISE' && !audio) throw new Error('The noise recording is missing. Reopen the saved report or record again.');
  const attachments = [{ url: email.attachment_url, filename: `${report.tracking_id}.pdf`, label: 'Report PDF' }];
  if (audio) attachments.push({ url: audio, filename: `${report.tracking_id}_audio.${audio.endsWith('.wav') ? 'wav' : 'm4a'}`, label: 'Audio recording' });
  if (video) attachments.push({ url: video, filename: `${report.tracking_id}_video.mp4`, label: 'Video recording' });
  return attachments;
}

export async function prepareEmailAttachments(
  plan: EmailAttachment[],
  download: (attachment: EmailAttachment) => Promise<{ uri: string; exists: boolean; size: number }>,
): Promise<string[]> {
  const uris: string[] = [];
  for (const attachment of plan) {
    try {
      const file = await download(attachment);
      if (!file.exists || file.size <= 0 || !file.uri.startsWith('file://')) throw new Error('File is unavailable or empty.');
      uris.push(file.uri);
    } catch {
      throw new Error(`${attachment.label} could not be attached. Your saved report is available; reconnect and retry.`);
    }
  }
  return uris;
}
