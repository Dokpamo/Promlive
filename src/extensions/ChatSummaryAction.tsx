import {useEffect, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Keyboard, Text, View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {AiAction} from '../features/settings/AiSettingsControls';
import {SettingsNote, SettingsSheet} from '../features/settings/SettingsLayout';
import {useDrawerModalLock} from '../features/chat/DrawerGestureBoundary';
import {headerScale, referenceHeader} from '../layout/metrics';
import {PressSurface} from '../layout/PressSurface';
import type {SummaryExtensions} from './SummaryExtensions';
import type {SummaryResult} from './store';

export function ChatSummaryAction({extensions, conversationId, width, top, hidden, onHeight}: {
  extensions: SummaryExtensions; conversationId: string; width: number; top: number; hidden: boolean; onHeight: (height: number) => void;
}) {
  const state = useSyncExternalStore(extensions.subscribe, extensions.snapshot);
  const {colors: c, settings: p, isDark} = useAppearance();
  const s = headerScale(width);
  const buttonHeight = referenceHeader.height * s;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SummaryResult[]>([]);
  const [loadError, setLoadError] = useState('');
  const active = extensions.active();
  const run = state.runs[conversationId];
  useDrawerModalLock(open);
  useEffect(() => {onHeight(active ? referenceHeader.barHeight * s : 0);}, [!!active, onHeight, s]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void extensions.results(conversationId).then(results => {if (current) {setSaved(results); setLoadError('');}}).catch(() => {if (current) setLoadError('저장한 요약을 불러오지 못했어요.');});
    return () => {current = false;};
  }, [extensions, conversationId, open, run?.result?.id]);
  const results = run?.result ? [run.result, ...saved.filter(result => result.id !== run.result?.id)] : saved;
  return <>
    {active && !hidden && <View pointerEvents="box-none" style={{position: 'absolute', top, right: 28 * s}}>
      <PressSurface accessibilityRole="button" accessibilityLabel={active.program.action.label} radius={buttonHeight / 2} compact highlightColor={c.headerPressed} style={{height: buttonHeight}} contentStyle={{backgroundColor: c.header, paddingHorizontal: 24 * s, boxShadow: isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)', alignItems: 'center', justifyContent: 'center'}} onPress={() => {Keyboard.dismiss(); setOpen(true); void extensions.run(conversationId);}}>
        <Text style={{color: c.text, fontSize: 24 * s, lineHeight: 34 * s}}>{active.program.action.label}</Text>
      </PressSurface>
    </View>}
    {open && <SettingsSheet title={active?.program.name ?? '저장한 요약'} onClose={() => setOpen(false)} fillHeight>{() => <>
      {run?.status === 'running' && <><ActivityIndicator color={p.secondary}/><AiAction label="요약 중단" onPress={() => extensions.cancel(conversationId)}/></>}
      {run?.status === 'failed' && <SettingsNote>{run.error}</SettingsNote>}
      {run?.status === 'cancelled' && <SettingsNote>요약을 중단했어요. 기존에 저장한 요약은 유지돼요.</SettingsNote>}
      {!!loadError && <SettingsNote>{loadError}</SettingsNote>}
      {results.map(result => <View key={result.id} style={{marginBottom: 30 * s, gap: 16 * s}}>
        <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>{`${new Date(result.createdAt).toLocaleString()} · v${result.version} · 최근 ${result.messageCount}개 메시지`}</Text>
        <Text selectable style={{color: p.text, fontSize: 26 * s, lineHeight: 40 * s}}>{result.content}</Text>
      </View>)}
      {run?.status !== 'running' && active && <AiAction label="다시 요약" onPress={() => void extensions.run(conversationId)}/>}
    </>}</SettingsSheet>}
  </>;
}
