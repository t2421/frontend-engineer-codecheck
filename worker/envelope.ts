export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isSuccessEnvelope(
  value: unknown,
): value is { message: null; result: object } {
  return isRecord(value) && value.message === null && isRecord(value.result)
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
