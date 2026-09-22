// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {AiModelPicker, type AiModelLoader} from '../src/features/settings/AiModelPicker';
import {aiServices, createAiSettingsPreview, type AiConnectionPreview, type AiModelPreview, type AiServicePreview} from '../src/features/settings/aiSettingsModel';
import {AiCatalogCache} from '../src/features/settings/aiCatalogCache';
import {AiCatalogError} from '../src/ports/aiCatalog';

vi.mock('react-native', () => ({View: ({children}: {children: ReactNode}) => <div>{children}</div>, Text: ({children}: {children: ReactNode}) => <span>{children}</span>, ActivityIndicator: () => <span>loading</span>}));
vi.mock('../src/features/settings/SettingsLayout', () => ({useSettingsScale: () => 1}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({settings: {secondary: '#888'}})}));
vi.mock('../src/features/settings/AiSettingsControls', () => ({
  AiCaption: ({children}: {children: ReactNode}) => <p>{children}</p>,
  AiField: ({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) => <input aria-label={label} value={value} onChange={event => onChange(event.target.value)}/>,
}));
vi.mock('../src/features/settings/AnimatedModelList', () => ({AnimatedModelList: ({models, onSelect}: {models: AiModelPreview[]; onSelect: (model: AiModelPreview) => void}) => <div>{models.map(model => <button key={model.id} onClick={() => onSelect(model)}>{model.name}</button>)}</div>}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let cache = new AiCatalogCache();
afterEach(async () => {if (root) await act(async () => root?.unmount()); root = undefined; cache = new AiCatalogCache(); document.body.replaceChildren();});
async function render(service: AiServicePreview, connection: AiConnectionPreview, loader: AiModelLoader, onSelect = vi.fn()) {
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  await act(async () => {root!.render(<AiModelPicker cache={cache} service={service} connection={connection} loadModels={loader} onSelect={onSelect} onManualChange={() => {}}/>);});
}

it('reloads automatically each time the model picker opens and selects without a save button', async () => {
  const service = aiServices.find(item => item.id === 'xai')!;
  const connection = createAiSettingsPreview().connections.xai;
  const loader = vi.fn<AiModelLoader>().mockResolvedValueOnce([service.models[0]!]).mockResolvedValueOnce([service.models[1]!]);
  const selected = vi.fn();
  await render(service, connection, loader, selected);
  expect(document.querySelector('button')?.textContent).toBe(service.models[0]!.name);
  await act(async () => document.querySelector('button')!.click());
  expect(selected).toHaveBeenCalledWith(service.models[0]);
  await act(async () => root!.render(null));
  await render(service, connection, loader, selected);
  expect(loader).toHaveBeenCalledTimes(2);
  expect(document.querySelector('button')?.textContent).toBe(service.models[1]!.name);
  expect([...document.querySelectorAll('button')].map(button => button.textContent).join(' ')).not.toMatch(/새로고침|저장|적용/);
});

it('ignores a late catalog from a different connection', async () => {
  const state = createAiSettingsPreview();
  const grok = aiServices.find(item => item.id === 'xai')!;
  const claude = aiServices.find(item => item.id === 'anthropic')!;
  let finish!: (models: AiModelPreview[]) => void;
  const oldCatalog = new Promise<AiModelPreview[]>(resolve => {finish = resolve;});
  const loader = vi.fn<AiModelLoader>().mockReturnValueOnce(oldCatalog).mockResolvedValueOnce([claude.models[0]!]);
  await render(grok, state.connections.xai, loader);
  await render(claude, state.connections.anthropic, loader);
  expect(loader.mock.calls[0]![2].aborted).toBe(true);
  await act(async () => finish([grok.models[0]!]));
  expect(document.querySelector('button')?.textContent).toBe(claude.models[0]!.name);
  expect(document.body.textContent).not.toContain(grok.models[0]!.name);
});

it('keeps the basic catalog selectable without credentials and labels it honestly', async () => {
  const service = aiServices.find(item => item.id === 'xai')!;
  const loader = vi.fn<AiModelLoader>().mockRejectedValue(new AiCatalogError('key'));
  await render(service, createAiSettingsPreview().connections.xai, loader);
  expect(document.body.textContent).toContain('API 키를 입력');
  expect(document.body.textContent).toContain('공식 문서 목록');
  expect(document.body.textContent).toContain('2026-09-21');
  expect(document.body.textContent).toContain('7개 항목');
  expect(document.querySelectorAll('button')).toHaveLength(service.models.length);
  expect(document.querySelector('input')?.getAttribute('aria-label')).toBe('모델 검색');
});

it('shows cached rows immediately, inserts only newcomers first, and preserves order on refresh', async () => {
  const service = aiServices.find(item => item.id === 'xai')!;
  const connection = createAiSettingsPreview().connections.xai;
  const old = service.models.slice(0, 2);
  const newcomer = {...old[0]!, id: 'new-id', name: '새 모델'};
  let finish!: (models: AiModelPreview[]) => void;
  const loader = vi.fn<AiModelLoader>().mockResolvedValueOnce(old).mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  await render(service, connection, loader);
  await act(async () => root!.render(null));
  await render(service, connection, loader);
  expect([...document.querySelectorAll('button')].map(item => item.textContent)).toEqual(old.map(item => item.name));
  expect(document.body.textContent).toContain('최근 확인한 목록');
  await act(async () => finish([old[1]!, newcomer, old[0]!]));
  expect([...document.querySelectorAll('button')].map(item => item.textContent)).toEqual([newcomer.name, ...old.map(item => item.name)]);
});

it('retains cached choices when refresh fails and never changes the saved selection automatically', async () => {
  const service = aiServices.find(item => item.id === 'xai')!;
  const connection = createAiSettingsPreview().connections.xai;
  const loader = vi.fn<AiModelLoader>().mockResolvedValueOnce([service.models[0]!]).mockRejectedValueOnce(new AiCatalogError('network'));
  const select = vi.fn();
  await render(service, connection, loader, select);
  await act(async () => root!.render(null));
  await render(service, connection, loader, select);
  expect(document.querySelector('button')?.textContent).toBe(service.models[0]!.name);
  expect(document.body.textContent).toContain('기존 목록을 유지');
  expect(select).not.toHaveBeenCalled();
});
