// Only bundled by isolated benchmark builds. Never included by the normal entry point.
import React, {useEffect, useState} from 'react';
import {AppRegistry, NativeModules, Text, View} from 'react-native';
import App from '../../App';
import {name as appName} from '../../app.json';
import {createWorkspace} from '../../src/ui/workspace/createWorkspace';
import {WorkspaceMemory} from '../../src/ui/workspace/WorkspaceMemory';
import {createScreenStorage} from '../../src/ui/screenStorage';
import {workspaceTuning} from '../../src/ui/workspace/tuning';
import {installWorkspaceProbe} from '../../src/ui/workspace/probe';

const endpoint = 'http://127.0.0.1:8785';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function BenchmarkApp() {
  const [memory, setMemory] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, cleanup;
    const launch = performance.now();
    NativeModules.PromliveStartup?.ready('light');
    (async () => {
      const config = await (await fetch(`${endpoint}/config.json`)).json();
      Object.assign(workspaceTuning, config.tuning ?? {});
      if (config.tuning?.renderWindow) workspaceTuning.desktopRenderWindow = config.tuning.renderWindow;
      // macOS builds may run without App Sandbox: bundle ID alone is insufficient.
      const {store, cache} = createWorkspace('promlive-performance-matrix');
      const calls = [], samples = [], events = [];
      const probe = {mounted: new Set(), events, target: config.screen === 'library' ? 'library:all' : config.screen === 'create' ? 'create:all' : config.screen};
      installWorkspaceProbe(probe);
      for (const method of ['list', 'card', 'chat', 'messages', 'saveCard', 'saveDraft', 'send']) {
        const original = store[method].bind(store);
        store[method] = async (...args) => {
          const start = performance.now();
          if (method === 'messages' && config.readDelayMs) await sleep(config.readDelayMs);
          const result = await original(...args);
          calls.push({method, start, end: performance.now(), ms: performance.now() - start,
            query: method === 'list' ? args[0] : method === 'messages' ? args[1] : undefined,
            count: result?.messages?.length ?? result?.rows?.length,
            first: result?.messages?.[0]?.sequence, last: result?.messages?.at(-1)?.sequence,
            characters: result?.messages?.reduce((sum, message) => sum + message.text.length, 0)});
          return result;
        };
      }
      // Controlled cold route/position. Real cache restoration is tested separately.
      const value = new WorkspaceMemory(createScreenStorage(), store, {...cache, read: () => null});
      await value.initialize();
      const chatId = config.chatId ?? 'perf-00000';
      if (config.screen === 'chat') {
        value.resetScroll(`chat:${chatId}`);
        if (config.anchorSequence) value.rememberScroll(`chat:${chatId}`, {offset: 0, hidden: 0, height: 0, maxOffset: 0,
          anchor: {id: `${chatId}-message-${config.anchorSequence}`, sequence: config.anchorSequence, offset: 0}});
        await value.prepareChat(chatId);
        value.updateView(view => ({...view, tab: 'chats', chatId, detailCardId: null, openedCardId: null}));
      } else value.updateView(view => ({...view, tab: config.screen ?? 'library', chatId: null, detailCardId: null, openedCardId: null}));
      if (cancelled) {await store.close(); return;}
      events.push({name: 'data-ready', time: performance.now(), sinceLaunch: performance.now() - launch});
      setMemory(value);
      let frames = [], last = performance.now(), request, firstBody, driverStart, done = false, lastSample = 0;
      const phases = config.phases ?? [{ms: 6000, speed: -2500}, {ms: 4000, speed: 2500}, {ms: 6000, speed: -2500}];
      // RN macOS' bridgeless requestAnimationFrame currently maps to setTimeout(0).
      // A self-rescheduling rAF loop spins without a display refresh and distorts
      // the workload. Use a bounded driver; these are JS tick intervals, NOT FPS.
      const tick = () => {
        const now = performance.now();
        const dt = now - last; frames.push({at: now, dt}); last = now;
        const surface = probe.surface;
        if (surface && now - lastSample >= 48) {
          const sample = {...surface.inspect(), time: now}; samples.push(sample); lastSample = now;
          if (!firstBody && (sample.visible?.length || (sample.kind === 'list' && sample.content > 0)) && !sample.restoring) {
            firstBody = now;
            events.push({name: 'first-body-layout', time: now, sinceLaunch: now - launch});
          }
        }
        if (surface && firstBody && config.autoScroll && !done && now - firstBody >= (config.startDelayMs ?? 2500)) {
          if (!driverStart) {driverStart = now; events.push({name: 'scroll-start', time: now, wall: Date.now()});}
          let elapsed = now - driverStart, phase;
          for (const item of phases) {if (elapsed < item.ms) {phase = item; break;} elapsed -= item.ms;}
          if (!phase) {done = true; events.push({name: 'scroll-end', time: now, wall: Date.now()});}
          else surface.move(phase.speed * Math.min(dt, 50) / 1000);
        }
        request = setTimeout(tick, 16);
      };
      request = setTimeout(tick, 16);
      const send = async () => {
        const current = value.getSnapshot().view.chatId;
        const room = current ? value.room(current)?.snapshot() : null;
        const payload = {run: config.run, at: Date.now(), clock: performance.now(), launch, clockKind: 'bounded-js-driver-not-display-fps', calls: calls.splice(0), frames: frames.splice(0),
          samples: samples.splice(0), events: events.splice(0), done,
          retainedMessages: room?.messages.length, retainedCharacters: room?.messages.reduce((sum, message) => sum + message.text.length, 0),
          ready: !!room?.ready, saveError: value.getSnapshot().storageIssue};
        try {await fetch(`${endpoint}/telemetry`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});} catch {}
      };
      const timer = setInterval(send, 1000);
      cleanup = () => {clearTimeout(request); clearInterval(timer); installWorkspaceProbe(undefined); void value.flush().then(() => store.close());};
    })().catch(failure => setError(String(failure)));
    return () => {cancelled = true; cleanup?.();};
  }, []);
  return memory ? <App memory={memory}/> : <View style={{flex: 1, justifyContent: 'center', padding: 24}}><Text>{error || '성능 측정 준비 중'}</Text></View>;
}
AppRegistry.registerComponent(appName, () => BenchmarkApp);
