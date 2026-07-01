/**
 * Explicit allowlist for request-body-to-model binding. Only fields named
 * in `allowedFields` are ever copied out of `body` — anything else in the
 * request (isAdmin, role, createdBy, id, ...) is silently dropped, not
 * bound to the database model.
 */
export function pickAllowed<T extends Record<string, unknown>>(
  body: unknown,
  allowedFields: readonly (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return result;
  }
  const source = body as Record<string, unknown>;
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field as string] as T[typeof field];
    }
  }
  return result;
}
