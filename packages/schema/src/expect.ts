import { z } from "zod";
export const ExpectSchema = z.object({ checks: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1) });
export type Expect = z.infer<typeof ExpectSchema>;
