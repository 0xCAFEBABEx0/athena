/**
 * The request body as text, or null once it exceeds `maxBytes`: reading
 * stops there, before anything is decoded or parsed, so an oversized body
 * costs at most `maxBytes` of buffering. A declared Content-Length over the
 * limit is refused without reading at all.
 */
export const readBody = async (request: Request, maxBytes: number): Promise<string | null> => {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
