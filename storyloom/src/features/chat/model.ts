import {z} from 'zod';
export const messageSchema = z.object({id: z.string(), conversationId: z.string(), sequence: z.number().int().nonnegative(), role: z.enum(['user', 'assistant']), content: z.string().max(100000), status: z.enum(['pending', 'generating', 'completed', 'cancelled', 'failed', 'interrupted']), requestId: z.string().nullable(), error: z.string().nullable(), createdAt: z.number().int()});
export type Message = z.infer<typeof messageSchema>;
export const conversationSchema = z.object({id: z.string(), cardId: z.string(), title: z.string(), createdAt: z.number().int(), updatedAt: z.number().int()});
export type Conversation = z.infer<typeof conversationSchema>;
