import { NextResponse } from 'next/server';
import { isUploadId, readUpload, uploadExists } from '@/lib/uploads';

export const runtime = 'nodejs';

/**
 * Confirma se um upload ainda está no ar, sem baixar os bytes.
 *
 * É o que permite ao cliente reaproveitar um link antigo com segurança: ele
 * guarda a URL e a data do envio, mas /tmp é efêmero e some inteiro num
 * reinício do servidor — sem esta checagem, o cliente confiaria no relógio
 * por até 6h e mostraria cards sem foto até o cache expirar sozinho.
 */
export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const id = file.replace(/\.jpg$/, '');
  if (!isUploadId(id) || !(await uploadExists(id))) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 200 });
}

/**
 * Serve a arte enviada pelo usuário.
 *
 * O id é o hash do conteúdo, então o mesmo id sempre devolve os mesmos bytes:
 * a resposta é imutável. O renderizador não passa por aqui — ele lê o arquivo
 * direto do disco, sem round-trip HTTP.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const id = file.replace(/\.jpg$/, '');

  if (!isUploadId(id)) {
    return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
  }

  const bytes = await readUpload(id);
  if (!bytes) {
    return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // A imagem é conteúdo enviado por terceiro: nunca deixar o navegador
      // adivinhar o tipo, e nada de execução no nosso contexto.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
