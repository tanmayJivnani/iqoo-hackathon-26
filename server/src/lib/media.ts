import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { ApiError } from './http';

export function decodePhoto(value: string) {
  const match = /^(?:data:image\/(jpeg|jpg|png);base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ApiError(422, 'Photos must contain valid JPEG or PNG base64 data.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 8 * 1024 * 1024) throw new ApiError(413, 'Each photo must be smaller than 8 MB.');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new ApiError(422, 'Photo data is not a JPEG or PNG image.');
  return { bytes, mime: jpeg ? 'image/jpeg' : 'image/png', extension: jpeg ? 'jpg' : 'png' };
}
export async function savePhoto(value: string) {
  const image = decodePhoto(value);
  await mkdir(config.mediaDir, { recursive: true });
  const name = `${randomUUID()}.${image.extension}`;
  await writeFile(path.join(/* turbopackIgnore: true */ config.mediaDir, name), image.bytes, { flag: 'wx' });
  return `/api/v1/media/${name}`;
}
export async function photoBytes(value: string) {
  if (value.startsWith('/api/v1/media/')) return readFile(mediaPath(value.slice('/api/v1/media/'.length)));
  return decodePhoto(value).bytes;
}
export function mediaPath(name: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|m4a|wav)$/.test(name)) throw new ApiError(404, 'Evidence not found.');
  return path.join(config.mediaDir, name);
}
export function decodeAudio(value: string) {
  const match = /^(?:data:audio\/(?:mp4|m4a|wav|x-wav);base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ApiError(422, 'Audio must be an M4A or WAV recording encoded as base64.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length < 32 || bytes.length > 2 * 1024 * 1024) throw new ApiError(422, 'Provide a valid audio recording smaller than 2 MB.');
  const isM4A = bytes.length >= 8 && bytes.toString('ascii', 4, 8) === 'ftyp';
  const isWav = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
  if (!isM4A && !isWav) throw new ApiError(422, 'Provide a valid M4A or WAV recording.');
  return { bytes, extension: isWav ? 'wav' : 'm4a' };
}
export async function saveAudio(value: string) {
  const audio = decodeAudio(value);
  await mkdir(config.mediaDir, { recursive: true });
  const name = `${randomUUID()}.${audio.extension}`;
  await writeFile(path.join(/* turbopackIgnore: true */ config.mediaDir, name), audio.bytes, { flag: 'wx' });
  return { url: `/api/v1/media/${name}`, sha256: createHash('sha256').update(audio.bytes).digest('hex'), extension: audio.extension };
}
export async function photoDataUri(value: string) {
  const image = decodePhoto((await photoBytes(value)).toString('base64'));
  return `data:${image.mime};base64,${image.bytes.toString('base64')}`;
}
