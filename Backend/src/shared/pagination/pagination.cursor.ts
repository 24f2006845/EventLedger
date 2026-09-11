import type { CursorPayload } from "./pagination.types.js";
import { z } from "zod";
import AppError from "../../utils/Apperror.js";

const CursorSchema = z.object({
  version: z.literal(1),
  resource: z.string().min(1),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

export function encodeCursor(payload: CursorPayload): string {
  const jsonString = JSON.stringify(payload);
  const base64String = Buffer.from(jsonString).toString("base64url");
  return base64String;
}

export function decodeCursor(
  cursor: string,
  expectedResource: string,
): CursorPayload {
  try {
    const jsonString = Buffer
      .from(cursor, "base64url")
      .toString("utf8");

    const payload = CursorSchema.parse(JSON.parse(jsonString));

    if (payload.resource !== expectedResource) {
      throw new AppError("Invalid cursor resource", 400);
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Invalid pagination cursor", 400);
  }
}
