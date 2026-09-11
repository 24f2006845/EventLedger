import type { CursorPayload } from "./pagination.types.js";
export function encodeCursor(payload: CursorPayload): string {
  const jsonString = JSON.stringify(payload);
  const base64String = Buffer.from(jsonString).toString("base64url");
  return base64String;
}

export function decodeCursor(cursor: string , expectedProject: string): CursorPayload {
  const jsonString = Buffer.from(cursor, "base64url").toString("utf-8");
  const payload: CursorPayload = JSON.parse(jsonString);
  if (payload.resource !== expectedProject) {
    throw new Error('Invalid cursor resource');
  }
  return payload;
}