import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './http';

export async function pdfViewerAsset(name: string) {
  if (!['pdf.mjs', 'pdf.worker.mjs'].includes(name)) throw new ApiError(404, 'PDF asset not found.');
  const bytes = await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), 'node_modules/pdfjs-dist/legacy/build', name));
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
}

export function pdfViewer(id: string) {
  const pdfUrl = JSON.stringify(`/api/v1/complaints/${encodeURIComponent(id)}/download-pdf`);
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Complaint PDF</title>
  <style>body{margin:0;background:#eef3ef;font-family:system-ui;color:#19392a}#status{padding:24px;text-align:center}main{padding:8px}canvas{display:block;width:100%;height:auto;margin:0 auto 12px;background:white;box-shadow:0 2px 8px #0002}button{padding:12px 24px;border:0;border-radius:24px;background:#246b45;color:white}</style></head>
  <body><div id="status" role="status">Loading PDF…</div><main id="pages"></main><script type="module">
  try {
    const {getDocument,GlobalWorkerOptions}=await import('/api/v1/complaints/pdf-assets/pdf.mjs');
    GlobalWorkerOptions.workerSrc='/api/v1/complaints/pdf-assets/pdf.worker.mjs';
    const pdf=await getDocument({url:${pdfUrl}}).promise;
    const container=document.getElementById('pages');
    for(let number=1;number<=pdf.numPages;number++) {
      const page=await pdf.getPage(number);
      const base=page.getViewport({scale:1});
      const scale=(document.documentElement.clientWidth-16)/base.width*Math.min(window.devicePixelRatio||1,2);
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.setAttribute('aria-label','PDF page '+number+' of '+pdf.numPages);container.appendChild(canvas);
      await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
      document.getElementById('status').textContent='Loading page '+number+' of '+pdf.numPages+'…';
      page.cleanup();
    }
    document.getElementById('status').remove();
  } catch(error) {
    const status=document.getElementById('status');status.textContent='Could not load this PDF. Check the backend connection. ';
    const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();status.appendChild(retry);
  }
  </script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
