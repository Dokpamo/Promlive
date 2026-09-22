import {afterEach, describe, expect, it, vi} from 'vitest';
import {repository, FixtureProvider} from './helpers';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {CreationService} from '../src/features/chat/service';
import {newCard} from '../src/features/cards/model';
import {buildContext} from '../src/features/chat/context';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';
import type {AiRequest, AiEvent} from '../src/ports/ai';
import type {SqlDatabase} from '../src/ports/storage';
const opened: SqlDatabase[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const db of opened.splice(0)) await db.close();});
const request = (id: string): AiRequest => ({id, purpose: 'writing', instruction: 'write', context: '', messages: []});
async function setup(provider = new FixtureProvider()) {
  const repo = await repository(); opened.push(repo.db);
  const card = await repo.insertCard(newCard()); const conversation = await repo.createConversation(card.id);
  const coordinator = new GenerationCoordinator(provider, 200);
  return {repo, card, conversation, coordinator, service: new CreationService(repo, coordinator)};
}
describe('AI generation lifecycle without a live provider', () => {
  it('accepts Babel async iterators on Hermes without Symbol.asyncIterator', async () => {
    const provider = new FixtureProvider();
    provider.stream = () => {
      let index = 0;
      const events: AiEvent[] = [{type: 'delta', text: '네이티브 응답'}, {type: 'done'}];
      return {'@@asyncIterator': () => ({next: async () => index < events.length ? {value: events[index++]!, done: false} : {value: undefined, done: true}})} as unknown as AsyncIterable<AiEvent>;
    };
    const {coordinator} = await setup(provider);
    const received: AiEvent[] = [];
    await coordinator.run(request('hermes'), event => {received.push(event);});
    expect(received).toEqual([{type: 'delta', text: '네이티브 응답'}, {type: 'done'}]);
  });
  it('acknowledges composer input only after the user message is saved', async () => {
    const {repo, card, conversation, service} = await setup();
    let accepted = false;
    await service.send(card, conversation.id, '보관할 메시지', 'accepted', () => {accepted = true;});
    expect(accepted).toBe(true);
    expect((await repo.messages(conversation.id))[0]?.content).toBe('보관할 메시지');
    const failedAcceptance = vi.fn();
    vi.spyOn(repo, 'beginExchange').mockRejectedValueOnce(new Error('저장 실패'));
    await expect(service.send(card, conversation.id, '남겨야 할 입력', 'failed', failedAcceptance)).rejects.toThrow('저장 실패');
    expect(failedAcceptance).not.toHaveBeenCalled();
  });
  it('preserves ordered chunks and requires the provider completion signal', async () => {
    const provider = new FixtureProvider(async function* () {yield {type: 'delta', text: '첫'}; yield {type: 'delta', text: ' 번째'}; yield {type: 'done'};});
    const {repo, card, conversation, service} = await setup(provider);
    await service.send(card, conversation.id, '인사', 'request1');
    expect((await repo.messages(conversation.id))[1]).toMatchObject({content: '첫 번째', status: 'completed'});
    expect(provider.signal?.aborted).toBe(true);
  });
  it('keeps partial data on a disconnected stream', async () => {
    const {repo, card, conversation, service} = await setup(new FixtureProvider(async function* () {yield {type: 'delta', text: '부분 결과'};}));
    await service.send(card, conversation.id, '인사');
    expect((await repo.messages(conversation.id))[1]).toMatchObject({content: '부분 결과', status: 'failed'});
  });
  it('cancels the transport and saves cancellation separately', async () => {
    const provider = new FixtureProvider(async function* (signal) {
      yield {type: 'delta', text: '남아야 하는 문장'};
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), {once: true}));
    });
    const {repo, card, conversation, service} = await setup(provider);
    const done = service.send(card, conversation.id, '취소', 'cancel1');
    await vi.waitFor(() => expect(service.live(conversation.id)?.message.content).toBe('남아야 하는 문장'));
    service.cancel('cancel1'); await done;
    expect((await repo.messages(conversation.id))[1]).toMatchObject({status: 'cancelled', content: '남아야 하는 문장'});
    expect(provider.signal?.aborted).toBe(true);
  });
  it('times out even when a provider stops yielding', async () => {
    const provider = new FixtureProvider(async function* () {await new Promise(() => {}); yield {type: 'done'};});
    await expect(new GenerationCoordinator(provider, 15).run(request('timeout'), () => {})).rejects.toThrow('시간');
    expect(provider.signal?.aborted).toBe(true);
  });
  it('suppresses duplicate requests without retrying paid calls', async () => {
    const provider = new FixtureProvider(); const {service, card, conversation} = await setup(provider);
    await service.send(card, conversation.id, 'one', 'same');
    await expect(service.send(card, conversation.id, 'one', 'same')).rejects.toThrow('이미');
    expect(provider.calls).toBe(1);
  });
  it('does not show storage failure as completion', async () => {
    const {repo, service, card, conversation} = await setup();
    vi.spyOn(repo, 'saveMessage').mockRejectedValue(new Error('저장 실패'));
    await expect(service.send(card, conversation.id, 'test')).rejects.toThrow('저장 실패');
    expect(service.live(conversation.id)?.message.status).toBe('failed');
    expect(service.lastError()).toBe('저장 실패');
  });
  it('disconnected mode does not create fake messages or make a request', async () => {
    const {repo, card, conversation} = await setup();
    const service = new CreationService(repo, new GenerationCoordinator(new DisconnectedProvider()));
    await expect(service.send(card, conversation.id, 'test')).rejects.toThrow('연결');
    expect(await repo.messages(conversation.id)).toHaveLength(0);
  });
  it('refuses research without a real source and validates source URLs', async () => {
    const without = new GenerationCoordinator(new FixtureProvider());
    await expect(without.run({...request('r1'), purpose: 'research'}, () => {})).rejects.toThrow('출처');
    const invalid = new FixtureProvider(async function* () {yield {type: 'source', source: {title: 'bad', url: 'javascript:alert(1)'}} as AiEvent; yield {type: 'done'};});
    await expect(new GenerationCoordinator(invalid).run({...request('r2'), purpose: 'research'}, () => {})).rejects.toThrow();
  });
  it('captures the draft base revision while the user continues editing', async () => {
    const {repo, card, service} = await setup();
    const draft = await service.generateDraft(card, 'add', 'writing');
    const current = await repo.saveCard({...card, description: '사용자의 새 문장'}, 0);
    await expect(repo.applyDraft(draft, current)).rejects.toThrow('변경');
    expect((await repo.getCard(card.id)).description).toBe('사용자의 새 문장');
  });
});
describe('conversation window and context', () => {
  it('pages long histories without gaps or duplicates and budgets context separately', async () => {
    const {repo, card, conversation} = await setup();
    for(let i=0;i<70;i++) {const pair = await repo.beginExchange(conversation.id, `page${i}`, `${i}`.repeat(50)); await repo.saveMessage({...pair.assistant, content: '응답'.repeat(50), status: 'completed'});}
    const newest = await repo.messages(conversation.id); const older = await repo.messages(conversation.id, newest[0]?.sequence);
    expect(newest).toHaveLength(40); expect(older).toHaveLength(40); expect(newest[0]?.sequence).toBe(101); expect(older.at(-1)?.sequence).toBe(100);
    const all = await repo.messages(conversation.id, Number.MAX_SAFE_INTEGER, 200);
    const context = buildContext(card, all, 'question', 1500);
    expect(context.omitted).toBeGreaterThan(100);
    expect(context.messages[0]?.role).toBe('user');
    expect(context.context.length + context.messages.reduce((n,m) => n + m.content.length,0) + 8).toBeLessThan(1500);
    expect(await repo.messages(conversation.id, Number.MAX_SAFE_INTEGER, 200)).toHaveLength(140);
  });
});
