import {z} from 'zod';

/** Explicit non-secret fields, shared by preference persistence and the catalog cache. */
export const aiModelSchema = z.object({
  id: z.string().min(1).max(500), name: z.string().max(1000), detail: z.string().max(4000),
  effort: z.array(z.string().max(100)).max(30), tools: z.array(z.enum(['web', 'x', 'files', 'code'])).max(4),
  source: z.literal('api').optional(), maxOutputTokens: z.number().nonnegative().optional(),
  thinking: z.boolean().optional(), adaptiveThinking: z.boolean().optional(), effortNeedsThinking: z.boolean().optional(),
  verbosity: z.boolean().optional(), sampling: z.boolean().optional(), samplingWithoutThinking: z.boolean().optional(), stop: z.boolean().optional(),
});
