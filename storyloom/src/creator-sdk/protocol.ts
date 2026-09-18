import {z} from 'zod';
import type {GenerationCoordinator} from '../features/chat/generation';
const envelope = {sdk: z.literal(1), instance: z.string().max(120), id: z.string().min(1).max(80)};
export const requestSchema = z.discriminatedUnion('type', [
  z.object({...envelope, type: z.literal('generate'), prompt: z.string().min(1).max(8000)}).strict(),
  z.object({...envelope, type: z.literal('cancel')}).strict(),
]);
export interface CreatorResponse {sdk: 1; instance: string; id: string; type: 'result' | 'error'; text: string}
export class CreatorHost {
  private disposed = false;
  private active = new Set<string>();
  private used = new Set<string>();
  private timestamps: number[] = [];
  constructor(readonly instance: string, private readonly coordinator: GenerationCoordinator, private readonly allowed: boolean, private readonly context: string) {}
  async handle(raw: unknown): Promise<CreatorResponse | null> {
    if (this.disposed) return null;
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success || parsed.data.instance !== this.instance) return null;
    const msg = parsed.data;
    const response = (type: 'result' | 'error', text: string): CreatorResponse => ({sdk: 1, instance: this.instance, id: msg.id, type, text});
    const requestId = `creator_${this.instance}_${msg.id}`;
    if (msg.type === 'cancel') { if (this.active.has(msg.id)) this.coordinator.cancel(requestId); return null; }
    if (!this.allowed) return response('error', '이 실행에 AI 호출 권한이 없습니다.');
    if (this.used.has(msg.id)) return response('error', '이미 사용된 요청 ID입니다.');
    this.timestamps = this.timestamps.filter(time => time > Date.now() - 60000);
    if (this.active.size >= 1 || this.timestamps.length >= 6) return response('error', '호출 한도에 도달했습니다. 잠시 기다려 주세요.');
    this.used.add(msg.id); this.active.add(msg.id); this.timestamps.push(Date.now());
    let text = '';
    try {
      await this.coordinator.run({id: requestId, purpose: 'creator', instruction: msg.prompt, context: this.context, messages: []}, event => { if (event.type === 'delta') text += event.text; });
      return this.disposed ? null : response('result', text);
    } catch (error) { return this.disposed ? null : response('error', error instanceof Error ? error.message : 'AI 요청에 실패했습니다.'); }
    finally { this.active.delete(msg.id); }
  }
  dispose() { this.disposed = true; this.active.forEach(id => this.coordinator.cancel(`creator_${this.instance}_${id}`)); this.active.clear(); }
}
