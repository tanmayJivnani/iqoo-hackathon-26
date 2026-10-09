import { z } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const maxBodyBytes = 50 * 1024 * 1024;
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxBodyBytes) throw new ApiError(413, 'Photos exceed the 50 MB request limit.');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Expected application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Request body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) { await reader.cancel(); throw new ApiError(413, 'Photos exceed the 50 MB request limit.'); }
    chunks.push(value);
  }
  let json: unknown;
  try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'Invalid JSON body.'); }
  const result = schema.safeParse(json);
  if (!result.success) throw new ApiError(422, result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:3000').split(',').map(v => v.trim());
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}
export async function handle(request: Request, fn: () => Promise<Response | unknown>) {
  try {
    const result = await fn();
    const response = result instanceof Response ? result : Response.json(result);
    for (const [key, value] of Object.entries(corsHeaders(request))) response.headers.set(key, value);
    return response;
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('API request failed:', error instanceof Error ? error.message : 'Unknown failure');
    return Response.json({ detail: error instanceof ApiError ? error.message : 'The request could not be completed. Please retry.' }, { status: error instanceof ApiError ? error.status : 500, headers: corsHeaders(request) });
  }
}
