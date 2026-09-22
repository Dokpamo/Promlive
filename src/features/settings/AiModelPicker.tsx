import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {AiCaption, AiField} from './AiSettingsControls';
import {connectionRoute, type AiConnectionPreview, type AiModelPreview, type AiServicePreview} from './aiSettingsModel';
import type {AiCatalogKind} from '../../ports/aiCatalog';
import {defaultCatalog, loadAiModels, reconcileCatalog, type AiModelLoader} from './aiModelCatalog';
import {AiCatalogCache, catalogScope} from './aiCatalogCache';
import {useAiCatalogCache} from './AiCatalogContext';
import {AnimatedModelList} from './AnimatedModelList';
export type {AiModelLoader} from './aiModelCatalog';

interface Props {
  service: AiServicePreview;
  connection: AiConnectionPreview;
  onSelect: (model: AiModelPreview) => void;
  onManualChange: (id: string) => void;
  onRefresh?: (models: AiModelPreview[]) => void;
  kind?: AiCatalogKind;
  loadModels?: AiModelLoader;
  cache?: AiCatalogCache;
}

/** Connection changes remount before another account's rows can paint. */
export function AiModelPicker(props: Props) {
  const shared = useAiCatalogCache();
  const kind = props.kind ?? 'chat';
  const scope = catalogScope(props.service, props.connection, kind);
  return <CatalogSession key={scope} {...props} scope={scope} kind={kind} cache={props.cache ?? shared}/>;
}

function CatalogSession({service, connection, onSelect, onManualChange, onRefresh, kind, scope, cache, loadModels = loadAiModels}: Props & {kind: AiCatalogKind; scope: string; cache: AiCatalogCache}) {
  const {settings: p} = useAppearance();
  const initial = cache.get(scope);
  const [catalog, setCatalog] = useState(() => initial?.models ?? defaultCatalog(service, connection, kind));
  const [source, setSource] = useState<'default' | 'cached' | 'live'>(initial ? 'cached' : 'default');
  const [loading, setLoading] = useState(true);
  const route = connectionRoute(service, connection);
  const selected = kind === 'chat' ? connection.model : connection.media[kind];
  const refreshCallback = useRef(onRefresh);
  refreshCallback.current = onRefresh;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await cache.load();
      if (controller.signal.aborted) return;
      const previous = cache.get(scope)?.models ?? defaultCatalog(service, connection, kind);
      if (cache.get(scope)) {setCatalog(previous); setSource('cached');}
      try {
        const next = await cache.refresh(scope, async signal => reconcileCatalog(previous, await loadModels(service, connection, signal, kind)), controller.signal);
        if (controller.signal.aborted) return;
        setCatalog(next);
        setSource('live');
        refreshCallback.current?.(next);
      } catch {
        // Keep the current catalog quietly; opening the picker again retries.
      } finally {if (!controller.signal.aborted) setLoading(false);}
    })();
    return () => controller.abort();
    // A keyed session covers all connection fields. A selection is not a new connection.
  }, [scope, cache, loadModels]);
  return <>
    <AnimatedModelList models={catalog} selected={selected} onSelect={onSelect}/>
    {!catalog.length && loading && <ActivityIndicator size="small" color={p.secondary} accessibilityLabel="모델 목록 갱신 중"/>}
    {!catalog.length && !loading && <AiCaption>{source === 'live' ? '이 목록에는 사용할 수 있는 항목이 없어요.' : route.auth === 'oauth' ? '계정 연결 후 목록을 확인할 수 있어요.' : '연결하면 모델 목록을 확인할 수 있어요.'}</AiCaption>}
    {source === 'live' && selected && !catalog.some(model => model.id === selected) && <AiCaption>저장한 항목이 이번 목록에는 없어요. 기존 선택은 유지했어요.</AiCaption>}
    {kind === 'chat' && ['custom', 'ollama'].includes(service.id) && <><View style={{height: 24}}/><AiField label="모델 ID 직접 입력" value={connection.model} onChange={id => onManualChange(id.trim())} placeholder={service.id === 'ollama' ? '설치한 모델 이름' : '모델 ID'}/></>}
  </>;
}
