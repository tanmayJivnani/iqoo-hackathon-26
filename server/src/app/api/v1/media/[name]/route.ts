import { readFile } from 'node:fs/promises';
import { ApiError, handle } from '../../../../../lib/http';
import { mediaPath } from '../../../../../lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ name: string }> };
const contentTypes: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', m4a: 'audio/mp4', wav: 'audio/wav', mp4: 'video/mp4',
};

export async function GET(request: Request, context: Context) {
  return handle(request, async () => {
    const { name } = await context.params;
    const filePath = mediaPath(name);
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ApiError(404, 'Evidence not found.');
      throw error;
    }
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': contentTypes[name.split('.').at(-1)!],
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
    } });
  });
}

export async function OPTIONS(request: Request) {
  return handle(request, async () => new Response(null, { status: 204 }));
}
