import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

export function skipTake(p: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (p.page - 1) * p.pageSize,
    take: p.pageSize,
  };
}
