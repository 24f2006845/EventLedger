import type { CursorPayload } from "./pagination.types.js";
export function encodeCursor(payload: CursorPayload): string {
  const jsonString = JSON.stringify(payload);
  const base64String = Buffer.from(jsonString).toString("base64");
  return base64String;
}

export function decodeCursor(cursor: string): CursorPayload {
  const jsonString = Buffer.from(cursor, "base64").toString("utf-8");
  const payload: CursorPayload = JSON.parse(jsonString);
  return payload;
}