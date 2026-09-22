import {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {AiCaption, AiField, AiSearchField} from './AiSettingsControls';
import {connectionRoute, type AiConnectionPreview, type AiModelPreview, type AiServicePreview} from './aiSettingsModel';
import {AiCatalogError, type AiCatalogKind} from '../../ports/aiCatalog';
import {defaultCatalog, loadAiModels, reconcileCatalog, type AiModelLoader} from './aiModelCatalog';
import {AiCatalogCache, catalogScope} from './aiCatalogCache';
import {useAiCatalogCache} from './AiCatalogContext';
import {AnimatedModelList} from './AnimatedModelList';
import {useSettingsScale} from './SettingsLayout';
import {officialCatalogDate} from './aiOfficialCatalog';
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
  const s = useSettingsScale();
  const initial = cache.get(scope);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState(() => initial?.models ?? defaultCatalog(service, connection, kind));
  const [source, setSource] = useState<'default' | 'cached' | 'live'>(initial ? 'cached' : 'default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError(failure instanceof AiCatalogError ? failure.message : '새 목록을 불러오지 못했어요. 기존 목록을 유지해요.');
      } finally {if (!controller.signal.aborted) setLoading(false);}
    })();
    return () => controller.abort();
    // A keyed session covers all connection fields. A selection is not a new connection.
  }, [scope, cache, loadModels]);
  const search = query.trim().toLowerCase();
  const models = useMemo(() => catalog.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(search)), [catalog, search]);
  const serverCatalog = service.id === 'ollama' || service.id === 'custom';
  const availability = source === 'live' ? (service.id === 'openrouter' ? '공개 모델 목록' : '연결에서 조회한 목록') : source === 'cached' ? '최근 확인한 목록' :
    route.auth === 'oauth' ? '계정 연결 준비 중' : serverCatalog ? '연결한 서버의 모델' : `공식 ${service.id === 'openrouter' ? '공개' : '문서'} 목록 · ${officialCatalogDate}`;
  return <>
    <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, marginHorizontal: 6 * s, marginTop: 8 * s}}>{service.name} · {route.name}</Text>
    <View style={{minHeight: 64 * s, flexDirection: 'row', alignItems: 'center', gap: 10 * s, marginHorizontal: 6 * s, marginBottom: 20 * s}} accessibilityLiveRegion="polite">
      {loading && <ActivityIndicator size="small" color={p.secondary} accessibilityLabel="모델 목록 갱신 중"/>}
      <Text style={{flex: 1, color: p.secondary, fontSize: 21 * s, lineHeight: 30 * s}}>{availability}{loading ? ' · 갱신 중' : error ? ` · ${error}` : ''}</Text>
    </View>
    <AiSearchField label={kind === 'voice' ? '목소리 검색' : '모델 검색'} value={query} onChange={setQuery} placeholder={kind === 'voice' ? '이름이나 목소리 ID로 검색' : '이름이나 모델 ID로 검색'}/>
    {source === 'default' && !serverCatalog && route.auth !== 'oauth' && <AiCaption>{catalog.length}개 항목 · 실제 이용 가능 여부는 계정과 리전에 따라 달라요.</AiCaption>}
    <AnimatedModelList key={search} models={models} selected={selected} onSelect={onSelect}/>
    {!models.length && <AiCaption>{catalog.length ? '검색 결과가 없어요.' : source === 'live' ? '이 목록에는 사용할 수 있는 항목이 없어요.' : route.auth === 'oauth' ? '계정 연결 후 목록을 확인할 수 있어요.' : '연결하면 모델 목록을 확인할 수 있어요.'}</AiCaption>}
    {source === 'live' && selected && !catalog.some(model => model.id === selected) && <AiCaption>저장한 항목이 이번 목록에는 없어요. 기존 선택은 유지했어요.</AiCaption>}
    {kind === 'chat' && ['custom', 'ollama'].includes(service.id) && <><View style={{height: 24}}/><AiField label="모델 ID 직접 입력" value={connection.model} onChange={id => onManualChange(id.trim())} placeholder={service.id === 'ollama' ? '설치한 모델 이름' : '모델 ID'}/></>}
  </>;
}
