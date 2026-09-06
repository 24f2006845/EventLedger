import * as z from "zod";

export const PaginationSchema = z.object({
  limit: z.number().int().positive().min(1).max(100).default(20),
  cursor: z.string().optional(),
});