import * as z from "zod";

export const PaginationSchema = z.object({
  limit: z.coerce
  .number().int().min(1).max(2000).default(20),
  cursor: z.string().optional(),
});