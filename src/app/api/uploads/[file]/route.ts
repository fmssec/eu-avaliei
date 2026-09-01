import { NextResponse } from 'next/server';
import { isUploadId, readUpload } from '@/lib/uploads';

export const runtime = 'nodejs';

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
