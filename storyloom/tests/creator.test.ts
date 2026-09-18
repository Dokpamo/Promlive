import {describe, expect, it} from 'vitest';
import {CreatorHost} from '../src/creator-sdk/protocol';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {sandboxDocument} from '../src/creator-sdk/document';
import {FixtureProvider} from './helpers';
const msg = (id: string) => ({sdk: 1, instance: 'instance1', id, type: 'generate', prompt: 'write'});
describe('creator instance boundary', () => {
  it('rejects wrong instances, malformed inputs, and unauthorized callers', async () => {
    const provider = new FixtureProvider(); const host = new CreatorHost('instance1', new GenerationCoordinator(provider), false, '');
    expect(await host.handle({...msg('1'), instance: 'other'})).toBeNull();
    expect(await host.handle({...msg('1'), prompt: 'x'.repeat(8001)})).toBeNull();
    expect(await host.handle({...msg('1'), apiKey: 'not-allowed'})).toBeNull();
    expect((await host.handle(msg('1')))?.type).toBe('error'); expect(provider.calls).toBe(0);
  });
  it('limits rate and rejects replay', async () => {
    const provider = new FixtureProvider(); const host = new CreatorHost('instance1', new GenerationCoordinator(provider), true, 'allowed card only');
    expect((await host.handle(msg('0')))?.type).toBe('result');
    expect((await host.handle(msg('0')))?.type).toBe('error');
    for(let i=1;i<6;i++) expect((await host.handle(msg(String(i))))?.type).toBe('result');
    expect((await host.handle(msg('7')))?.type).toBe('error'); expect(provider.calls).toBe(6);
    host.dispose(); expect(await host.handle(msg('8'))).toBeNull();
  });
  it('revokes active requests when a sandbox closes', async () => {
    const provider = new FixtureProvider(async function* (signal) {await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve())); yield {type: 'done'};});
    const host = new CreatorHost('instance1', new GenerationCoordinator(provider), true, '');
    const response = host.handle(msg('1')); host.dispose(); expect(await response).toBeNull(); expect(provider.signal?.aborted).toBe(true);
  });
  it('keeps source out of the trusted HTML parser context and restricts network', () => {
    const doc = sandboxDocument({html: '<script>escape</script>', css: '</style><script>escape</script>', javascript: "creator.text('p', '</script><script>escape</script>')"}, 'instance1');
    expect(doc.match(/<script>/g)).toHaveLength(1);
    expect(doc).toContain("connect-src 'none'"); expect(doc).toContain('worker.terminate()');
    expect(doc).not.toContain('allow-same-origin');
  });
});
