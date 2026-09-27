import {useState, useSyncExternalStore} from 'react';
import {Text, View, useWindowDimensions} from 'react-native';
import {PocketSurface} from '../cards/CardPocketScreen';
import {defaultPocket, type CardPocket} from '../cards/pocket';
import {getExperience, initialScene} from '../cards/experience';
import {newId} from '../cards/model';
import {SettingsSheet, SettingsChoice} from '../settings/SettingsLayout';
import {SettingsTextField} from '../settings/SettingsTextField';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale} from '../../layout/metrics';
import {StudioAction, StudioSection} from './StudioControls';
import type {AuthoringSession} from './AuthoringSession';

export function StudioPocket({session, close}: {session: AuthoringSession; close: () => void}) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const {width} = useWindowDimensions(), s = headerScale(width), {settings: p} = useAppearance();
  const [editing, setEditing] = useState(false), [startsOpen, setStartsOpen] = useState(false);
  const [startId, setStartId] = useState<string | null>(null), [error, setError] = useState('');
  const card = state.project?.draft;
  if (!card) return null;
  const experience = getExperience(card), pocket = card.pocket ?? defaultPocket(card);
  const selectedStart = experience.starts.find(start => start.id === startId) ?? experience.starts.find(start => start.id === experience.defaultStartId)!;
  const change = (update: (value: CardPocket) => CardPocket) => {
    try {
      const latest = session.snapshot().project!.draft;
      session.setField('pocket', JSON.stringify(update(latest.pocket ?? defaultPocket(latest)))); setError('');
    } catch (error) {setError(error instanceof Error ? error.message : '상태창을 저장하지 못했어요.');}
  };
  const focus = (editing: boolean) => session.setFocusedField(editing ? 'pocket' : null);
  return <>
    <PocketSurface card={card} scene={initialScene(experience, selectedStart.id)} pocket={pocket} close={close} edit={() => setEditing(true)} notice={error || state.error || ''}>
      <View style={{gap: 12 * s}}>
        <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>초기 상태 미리보기</Text>
        <StudioAction label={selectedStart.name} scale={s} onPress={() => setStartsOpen(true)}/>
      </View>
    </PocketSurface>
    {startsOpen && <SettingsSheet title="미리볼 시작 상황" onClose={() => setStartsOpen(false)}>{closeSheet => <>{experience.starts.map(start => <SettingsChoice key={start.id} label={start.name} selected={selectedStart.id === start.id} onPress={() => {setStartId(start.id); closeSheet();}}/>)}</>}</SettingsSheet>}
    {editing && <SettingsSheet title="상태창 편집" fillHeight onClose={() => setEditing(false)}>{() => <View pointerEvents={state.publishing ? 'none' : 'auto'} style={{gap: 20 * s}}>
      <SettingsTextField label="제목" value={pocket.title} placeholder="상태창 제목" editor="mini" maxLength={120} onEditingChange={focus} onChange={title => {if (title.trim()) change(value => ({...value, title}));}}/>
      <StudioSection title="기본 템플릿" scale={s}>
        <View style={{flexDirection: 'row', gap: 14 * s}}>{([['tiles', '타일형'], ['list', '목록형']] as const).map(([template, label]) => <StudioAction key={template} label={label} selected={pocket.template === template} scale={s} onPress={() => change(value => ({...value, template}))}/>)}</View>
      </StudioSection>
      <StudioSection title="표시할 항목" scale={s}>
        {pocket.fields.map((field, index) => <View key={field.id} style={{gap: 14 * s, marginBottom: 22 * s}}>
          <SettingsTextField label={`항목 ${index + 1} 이름`} value={field.label} placeholder="항목 이름" editor="mini" maxLength={60} onEditingChange={focus} onChange={label => {if (label.trim()) change(value => ({...value, fields: value.fields.map(item => item.id === field.id ? {...item, label} : item)}));}}/>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12 * s}}>{([['location', '현재 장소'], ['characters', '등장인물'], ['flag', '상태값']] as const).map(([source, label]) => <StudioAction key={source} label={label} selected={source === field.source} scale={s} onPress={() => change(value => ({...value, fields: value.fields.map(item => item.id === field.id ? {...item, source} : item)}))}/>)}</View>
          {field.source === 'flag' && <SettingsTextField label="연결할 상태 이름" value={field.key} placeholder="예: 체력, 소지금, 퀘스트" editor="mini" maxLength={60} onEditingChange={focus} onChange={key => change(value => ({...value, fields: value.fields.map(item => item.id === field.id ? {...item, key} : item)}))}/>}
          <StudioAction label={`${field.label} 표시 삭제`} scale={s} onPress={() => change(value => ({...value, fields: value.fields.filter(item => item.id !== field.id)}))}/>
        </View>)}
        <StudioAction label="상태 항목 추가" scale={s} disabled={pocket.fields.length >= 30} onPress={() => change(value => ({...value, fields: [...value.fields, {id: newId('status'), label: '새 항목', source: 'flag', key: ''}]}))}/>
      </StudioSection>
    </View>}</SettingsSheet>}
  </>;
}
