// @vitest-environment jsdom
import {act, useEffect, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {AiModelSelectionSheet} from '../src/features/settings/AiModelSelectionSheet';
import {aiServices, choosePreviewModel, createAiSettingsPreview, modelPresetFor, type AiConnectionPreview, type AiModelPreview} from '../src/features/settings/aiSettingsModel';

const picker = vi.hoisted(() => ({mounts: 0}));
vi.mock('../src/features/settings/AiModelPicker', () => ({AiModelPicker: ({service, onSelect}: {service: {models: AiModelPreview[]}; onSelect: (model: AiModelPreview) => void}) => {
  useEffect(() => {picker.mounts++;}, []);
  return <>{service.models.map(model => <button key={model.id} data-model={model.id} onClick={() => onSelect(model)}>{model.name}</button>)}</>;
}}));
vi.mock('../src/features/settings/SettingsLayout', () => ({
  SettingsSheet: ({title, slideFrom, dismiss, obscured, onClose, children, overlay}: {title: string; slideFrom?: string; dismiss?: boolean; obscured?: boolean; onClose: () => void; children: (close: () => void) => ReactNode; overlay?: ReactNode}) => {
    const [closing, setClosing] = useState(false);
    return <section data-sheet={title} data-direction={slideFrom} data-closing={dismiss || closing}>
      <div aria-hidden={obscured}>
        <button data-close={title} onClick={onClose}>뒤로</button>
        {children(() => setClosing(true))}
      </div>
      {overlay}
    </section>;
  },
  SettingsChoice: ({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) => <button role="radio" aria-checked={selected} onClick={onPress}>{label}</button>,
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let saved: AiConnectionPreview;
const closed = vi.fn();
afterEach(async () => {if (root) await act(async () => root?.unmount()); root = undefined; picker.mounts = 0; closed.mockClear(); document.body.replaceChildren();});
async function render(initial = createAiSettingsPreview().connections.xai, extraModels: AiModelPreview[] = []) {
  const service = aiServices.find(item => item.id === 'xai')!;
  function Host() {
    const [connection, setConnection] = useState(initial);
    saved = connection;
    return <AiModelSelectionSheet service={{...service, models: [...service.models, ...extraModels]}} connection={connection} kind="chat" onClose={closed} onRefresh={() => {}} onManualChange={() => {}} onSelect={(model, effort) => setConnection(old => {
      const next = choosePreviewModel(service.id, old, model);
      if (effort) next.modelPresets[model.id] = {...modelPresetFor(service.id, next), effort};
      return next;
    })}/>;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
}
async function click(selector: string) {await act(async () => {document.querySelector<HTMLButtonElement>(selector)!.click();});}
const level = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(button => button.textContent === name)!;

it('opens reasoning from the right with the actual default selected and waits for both exit animations', async () => {
  await render();
  await click('[data-model="grok-4.5"]');
  expect(document.querySelector('[data-sheet="추론 레벨"]')?.getAttribute('data-direction')).toBe('right');
  expect(document.body.textContent).not.toContain('API 기본값');
  expect(level('높음').getAttribute('aria-checked')).toBe('true');
  expect(saved.model).toBe('grok-4.5');
  expect(saved.modelPresets[saved.model]?.effort).toBe('high');
  await act(async () => level('보통').click());
  expect(saved.modelPresets[saved.model]?.effort).toBe('medium');
  expect(document.querySelectorAll('[data-closing="true"]')).toHaveLength(2);
  await click('[data-close="대화 모델"]');
  expect(closed).not.toHaveBeenCalled();
  expect(document.querySelector('[data-sheet="추론 레벨"]')).not.toBeNull();
  await click('[data-close="추론 레벨"]');
  expect(closed).toHaveBeenCalledOnce();
});

it('restores a saved level and returns to the same mounted catalog on back', async () => {
  const connection = createAiSettingsPreview().connections.xai;
  connection.modelPresets['grok-4.5'] = {...modelPresetFor('xai', connection), effort: 'low'};
  await render(connection);
  await click('[data-model="grok-4.5"]');
  expect(level('낮음').getAttribute('aria-checked')).toBe('true');
  await click('[data-close="추론 레벨"]');
  expect(document.querySelector('[data-sheet="추론 레벨"]')).toBeNull();
  expect(picker.mounts).toBe(1);
  expect(closed).not.toHaveBeenCalled();
  await click('[data-model="grok-4.6"]');
  expect(level('높음').getAttribute('aria-checked')).toBe('true');
  expect(picker.mounts).toBe(1);
});

it('finishes model selection directly when there are no reasoning levels', async () => {
  await render();
  await click('[data-model="grok-4.20-0309-non-reasoning"]');
  expect(document.querySelector('[data-sheet="추론 레벨"]')).toBeNull();
  expect(document.querySelector('[data-sheet="대화 모델"]')?.getAttribute('data-closing')).toBe('true');
  await click('[data-close="대화 모델"]');
  expect(closed).toHaveBeenCalledOnce();
});

it('does not select a made-up default for an unfamiliar server model', async () => {
  await render(undefined, [{id: 'new-model', name: 'New model', detail: '', effort: ['low', 'high'], tools: [], source: 'api'}]);
  await click('[data-model="new-model"]');
  expect(document.querySelectorAll('[role="radio"]')).toHaveLength(2);
  expect(document.querySelector('[aria-checked="true"]')).toBeNull();
  await act(async () => level('낮음').click());
  expect(saved.modelPresets['new-model']?.effort).toBe('low');
});
