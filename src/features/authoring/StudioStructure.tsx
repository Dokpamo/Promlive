import {useEffect, useState} from 'react';
import {Image, Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsTextField} from '../settings/SettingsTextField';
import {SettingsSheet} from '../settings/SettingsLayout';
import {PressSurface} from '../../layout/PressSurface';
import {newId} from '../cards/model';
import {getExperience, newResource, newStart, removeResource, resourceLabels, type CardExperience, type CardResource, type StartSituation} from '../cards/experience';
import {importCardImage} from '../../adapters/profile/importCardImage';
import {pickCardAsset} from '../../adapters/files/cardFiles';
import type {AuthoringSession} from './AuthoringSession';
import type {AuthoringProject} from './model';
import type {CardAsset} from './assets';
import {StudioAction, StudioSection} from './StudioControls';

const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
export function StudioStructure({session, project, scale: s, report}: {session: AuthoringSession; project: AuthoringProject; scale: number; report: (error: unknown) => void}) {
  const {settings: p} = useAppearance();
  const [editing, setEditing] = useState<{kind: 'resource' | 'start'; id: string} | null>(null);
  const experience = getExperience(project.draft);
  const mutate = (change: (value: CardExperience) => CardExperience) => {
    try {session.setField('structure', JSON.stringify(change(getExperience(session.snapshot().project!.draft))));} catch (error) {report(error);}
  };
  const resource = editing?.kind === 'resource' ? experience.resources.find(r => r.id === editing.id) : undefined;
  const start = editing?.kind === 'start' ? experience.starts.find(r => r.id === editing.id) : undefined;
  const row = (name: string, detail: string, action: () => void, selected = false) => <PressSurface accessibilityRole="button" accessibilityLabel={name} onPress={action} radius={12 * s} highlightColor={p.selected}
    contentStyle={{flex: 0, backgroundColor: selected ? p.selected : p.sheet, paddingHorizontal: 24 * s, paddingVertical: 20 * s, gap: 7 * s}}>
    <Text style={{color: p.text, fontSize: 27 * s, lineHeight: 36 * s}}>{name}</Text><Text numberOfLines={2} style={{color: p.secondary, fontSize: 21 * s, lineHeight: 30 * s}}>{detail}</Text>
  </PressSurface>;
  return <>
    {(['world', 'place', 'character', 'object', 'lore'] as const).map(kind => <StudioSection key={kind} title={resourceLabels[kind]} scale={s}>
      {experience.resources.filter(r => r.kind === kind).map(r => <View key={r.id}>{row(r.name, r.prompt || `${resourceLabels[kind]}의 프롬프트와 에셋을 연결해 주세요`, () => setEditing({kind: 'resource', id: r.id}))}</View>)}
      {kind !== 'world' && <StudioAction label={`${resourceLabels[kind]} 추가`} scale={s} onPress={() => {
        const next = newResource(kind, newId(kind), `새 ${resourceLabels[kind]}`);
        mutate(e => ({...e, resources: [...e.resources, next]})); setEditing({kind: 'resource', id: next.id});
      }}/>}
    </StudioSection>)}
    <StudioSection title="시작 상황" scale={s}>
      {experience.starts.map(start => <View key={start.id}>{row(start.name, `${start.id === experience.defaultStartId ? '기본 시작 · ' : ''}${experience.resources.find(r => r.id === start.locationId)?.name ?? '장소 미지정'} · 참여 항목 ${start.activeIds.length}개`, () => setEditing({kind: 'start', id: start.id}))}</View>)}
      <StudioAction label="시작 상황 추가" scale={s} onPress={() => {const next = newStart(newId('start'), '새 시작 상황'); mutate(e => ({...e, starts: [...e.starts, next]})); setEditing({kind: 'start', id: next.id});}}/>
    </StudioSection>
    <StudioSection title="진행" scale={s}><SettingsTextField label="공통 대화 지침" value={experience.direction} placeholder="문체, 응답 길이, 진행 방식" editor="full" multiline maxLength={30000}
      onChange={value => mutate(e => ({...e, direction: value}))} onEditingChange={editing => session.setFocusedField(editing ? 'structure' : null)}/></StudioSection>
    {resource && <SettingsSheet title={resourceLabels[resource.kind]} fillHeight onClose={() => setEditing(null)}>{close => <ResourceEditor session={session} resource={resource} experience={experience} scale={s} report={report}
      onRemove={() => {mutate(e => removeResource(e, resource.id)); close();}} onAI={() => {session.setTarget(`resource:${resource.id}`); session.setPrompt(`${resource.name}의 프롬프트를 `); session.setView('ai'); close();}}/>}</SettingsSheet>}
    {start && <SettingsSheet title="시작 상황" fillHeight onClose={() => setEditing(null)}>{close => <StartEditor session={session} start={start} experience={experience} scale={s} report={report}
      onDefault={() => mutate(e => ({...e, defaultStartId: start.id}))}
      onRemove={() => {mutate(e => ({...e, starts: e.starts.filter(s => s.id !== start.id), defaultStartId: e.defaultStartId === start.id ? e.starts.find(s => s.id !== start.id)!.id : e.defaultStartId})); close();}}
      onAI={() => {session.setTarget(`start:${start.id}`); session.setPrompt(`${start.name}의 시작 상황을 `); session.setView('ai'); close();}}/>}</SettingsSheet>}
  </>;
}

function ResourceEditor({session, resource: r, experience, scale: s, report, onRemove, onAI}: {session: AuthoringSession; resource: CardResource; experience: CardExperience; scale: number; report: (error: unknown) => void; onRemove: () => void; onAI: () => void}) {
  const {settings: p} = useAppearance();
  const [busy, setBusy] = useState(false);
  const field = `resource:${r.id}` as const;
  const change = (update: (value: CardResource) => CardResource) => {
    const latest = getExperience(session.snapshot().project!.draft).resources.find(item => item.id === r.id);
    if (!latest) return;
    try {session.setField(field, JSON.stringify(update(latest)));} catch (error) {report(error);}
  };
  const focus = (editing: boolean) => session.setFocusedField(editing ? field : null);
  const addAsset = async (image: boolean) => {
    if (busy) return; setBusy(true);
    try {const file = image ? await importCardImage() : await pickCardAsset(); if (file) {const saved = await session.store.putAsset(file); change(value => ({...value, assetIds: [...value.assetIds, saved.id]})); await session.flush();}}
    catch (error) {report(error);} finally {setBusy(false);}
  };
  return <View style={{gap: 16 * s}}>
    <SettingsTextField label="이름" value={r.name} placeholder="입력해 주세요" editor="mini" maxLength={120} onChange={name => {if (name.trim()) change(value => ({...value, name}));}} onEditingChange={focus}/>
    <SettingsTextField label="프롬프트" value={r.prompt} placeholder="이 항목에 대해 AI가 알아야 할 내용" editor="full" multiline maxLength={30000} onChange={prompt => change(value => ({...value, prompt}))} onEditingChange={focus}/>
    <StudioAction label="이 항목을 AI로 수정" scale={s} onPress={onAI}/>
    <StudioSection title="이미지 · 에셋" scale={s}>
      <AttachedAssets session={session} ids={r.assetIds} scale={s} remove={id => change(value => ({...value, assetIds: value.assetIds.filter(a => a !== id)}))}/>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12 * s}}><StudioAction label="이미지 추가" scale={s} disabled={busy} onPress={() => void addAsset(true)}/><StudioAction label="음원·파일 추가" scale={s} disabled={busy} onPress={() => void addAsset(false)}/></View>
    </StudioSection>
    {r.kind === 'world' ? <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>세계의 프롬프트는 모든 장소와 시작 상황에 공통으로 들어가요.</Text> : <StudioSection title="프롬프트 포함 조건" scale={s}>
      <StudioAction label={r.activation.enabled ? '사용 중' : '사용 안 함'} selected={r.activation.enabled} scale={s} onPress={() => change(value => ({...value, activation: {...value.activation, enabled: !value.activation.enabled}}))}/>
      {r.kind !== 'place' && <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12 * s}}>{([['always', '항상'], ['conditional', '장소·상태에 따라'], ['manual', '직접 활성화']] as const).map(([mode, label]) => <StudioAction key={mode} label={label} scale={s} selected={r.activation.mode === mode} onPress={() => change(value => ({...value, activation: {...value.activation, mode}}))}/>)}</View>}
      {r.kind === 'place' && <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>현재 장소일 때 포함돼요. 아래 조건을 만족하지 않으면 닫힌 장소가 돼요.</Text>}
      {r.kind !== 'place' && r.activation.mode === 'conditional' && <StudioSection title="해당 장소에서" scale={s}>
        <StudioAction label="모든 장소" scale={s} selected={!r.activation.locations.length} onPress={() => change(value => ({...value, activation: {...value.activation, locations: []}}))}/>
        {experience.resources.filter(item => item.kind === 'place').map(place => <StudioAction key={place.id} label={place.name} scale={s} selected={r.activation.locations.includes(place.id)} onPress={() => change(value => ({...value, activation: {...value.activation, locations: toggleId(value.activation.locations, place.id)}}))}/>)}
      </StudioSection>}
      <ConditionEditor resource={r} scale={s} focus={focus} change={change}/>
      <StudioAction label={`${resourceLabels[r.kind]} 삭제`} scale={s} onPress={onRemove}/>
    </StudioSection>}
  </View>;
}

function ConditionEditor({resource, change, scale: s, focus}: {resource: CardResource; change: (update: (value: CardResource) => CardResource) => void; scale: number; focus: (value: boolean) => void}) {
  return <View style={{gap: 12 * s}}>
    {resource.activation.conditions.map((condition, index) => <View key={index} style={{gap: 10 * s}}>
      <SettingsTextField label={`조건 ${index + 1} · 상태 이름`} value={condition.key} placeholder="입력해 주세요" editor="mini" maxLength={60} onEditingChange={focus} onChange={key => {if (key.trim()) change(r => ({...r, activation: {...r.activation, conditions: r.activation.conditions.map((c, i) => i === index ? {...c, key} : c)}}));}}/>
      <SettingsTextField label="상태값" value={condition.value} placeholder="입력해 주세요" editor="mini" maxLength={300} onEditingChange={focus} onChange={value => change(r => ({...r, activation: {...r.activation, conditions: r.activation.conditions.map((c, i) => i === index ? {...c, value} : c)}}))}/>
      <View style={{flexDirection: 'row', gap: 12 * s}}><StudioAction label={condition.operator === 'is' ? '같을 때 포함' : '다를 때 포함'} scale={s} onPress={() => change(r => ({...r, activation: {...r.activation, conditions: r.activation.conditions.map((c, i) => i === index ? {...c, operator: c.operator === 'is' ? 'isNot' : 'is'} : c)}}))}/><StudioAction label={`조건 ${index + 1} 삭제`} scale={s} onPress={() => change(r => ({...r, activation: {...r.activation, conditions: r.activation.conditions.filter((_, i) => i !== index)}}))}/></View>
    </View>)}
    <StudioAction label="상태 조건 추가" scale={s} onPress={() => change(r => ({...r, activation: {...r.activation, conditions: [...r.activation.conditions, {key: '상태', operator: 'is', value: '열림'}]}}))}/>
  </View>;
}

function StartEditor({session, start, experience, scale: s, report, onDefault, onRemove, onAI}: {session: AuthoringSession; start: StartSituation; experience: CardExperience; scale: number; report: (error: unknown) => void; onDefault: () => void; onRemove: () => void; onAI: () => void}) {
  const field = `start:${start.id}` as const;
  const focus = (editing: boolean) => session.setFocusedField(editing ? field : null);
  const change = (update: (value: StartSituation) => StartSituation) => {
    const latest = getExperience(session.snapshot().project!.draft).starts.find(s => s.id === start.id); if (!latest) return;
    try {session.setField(field, JSON.stringify(update(latest)));} catch (error) {report(error);}
  };
  return <View style={{gap: 14 * s}}>
    <SettingsTextField label="시작 상황 이름" value={start.name} placeholder="입력해 주세요" editor="mini" maxLength={120} onEditingChange={focus} onChange={name => {if (name.trim()) change(s => ({...s, name}));}}/>
    <SettingsTextField label="시작 프롬프트" value={start.greeting} placeholder="AI에게도 전달할 첫 메시지·장면·대사" editor="full" multiline maxLength={30000} onEditingChange={focus} onChange={greeting => change(s => ({...s, greeting}))}/>
    <SettingsTextField label="상황 지침" value={start.prompt} placeholder="대화 중 AI가 유지할 시작 배경과 규칙 (선택)" editor="full" multiline maxLength={30000} onEditingChange={focus} onChange={prompt => change(s => ({...s, prompt}))}/>
    <SettingsTextField label="인트로 · 텍스트" value={start.intro?.text ?? ''} placeholder="사용자에게만 보여줄 도입 연출 (AI에게 보내지 않아요)" editor="full" multiline maxLength={30000} onEditingChange={focus} onChange={text => change(s => ({...s, intro: {kind: 'text', text}}))}/>
    <StudioAction label="이 시작 상황을 AI로 수정" scale={s} onPress={onAI}/>
    <StudioSection title="시작 장소" scale={s}>
      <StudioAction label="장소 미지정" scale={s} selected={start.locationId === null} onPress={() => change(s => ({...s, locationId: null}))}/>
      {experience.resources.filter(r => r.kind === 'place').map(r => <StudioAction key={r.id} label={r.name} scale={s} selected={start.locationId === r.id} onPress={() => change(s => ({...s, locationId: r.id}))}/>)}
    </StudioSection>
    <StudioSection title="처음 활성화할 인물 · 오브젝트 · 로어" scale={s}>
      {experience.resources.filter(r => r.kind !== 'world' && r.kind !== 'place').map(r => <StudioAction key={r.id} label={r.name} scale={s} selected={start.activeIds.includes(r.id)} onPress={() => change(s => ({...s, activeIds: toggleId(s.activeIds, r.id)}))}/>)}
    </StudioSection>
    <StudioSection title="초기 상태값" scale={s}><FlagEditor value={start.flags} scale={s} focus={focus} onChange={flags => change(s => ({...s, flags}))}/></StudioSection>
    <StudioAction label={experience.defaultStartId === start.id ? '기본 시작 상황' : '기본 시작으로 설정'} selected={experience.defaultStartId === start.id} scale={s} onPress={onDefault}/>
    {experience.starts.length > 1 && <StudioAction label="시작 상황 삭제" scale={s} onPress={onRemove}/>}
  </View>;
}

export function FlagEditor({value, onChange, scale: s, focus}: {value: Record<string, string>; onChange: (value: Record<string, string>) => void; scale: number; focus?: (editing: boolean) => void}) {
  return <View style={{gap: 14 * s}}>
    {Object.entries(value).map(([key, text], index) => <View key={index} style={{gap: 10 * s}}>
      <SettingsTextField label="상태 이름" value={key} maxLength={60} placeholder="입력해 주세요" editor="mini" {...(focus ? {onEditingChange: focus} : {})} onChange={name => {if (name.trim() && name !== key && !['__proto__', 'constructor', 'prototype'].includes(name) && !(name in value)) {const next = {...value}; delete next[key]; next[name] = text; onChange(next);}}}/>
      <SettingsTextField label={`${key} 값`} value={text} maxLength={300} placeholder="입력해 주세요" editor="mini" {...(focus ? {onEditingChange: focus} : {})} onChange={text => onChange({...value, [key]: text})}/>
      <StudioAction label={`${key} 상태 삭제`} scale={s} onPress={() => {const next = {...value}; delete next[key]; onChange(next);}}/>
    </View>)}
    <StudioAction label="상태값 추가" scale={s} onPress={() => {let number = 1; while (`상태${number}` in value) number++; onChange({...value, [`상태${number}`]: ''});}}/>
  </View>;
}
function AttachedAssets({session, ids, scale: s, remove}: {session: AuthoringSession; ids: string[]; scale: number; remove: (id: string) => void}) {
  const {settings: p} = useAppearance();
  const [assets, setAssets] = useState<CardAsset[]>([]);
  const key = ids.join(',');
  useEffect(() => {let active = true; void Promise.all(ids.map(id => session.store.getAsset(id))).then(values => {if (active) setAssets(values.filter(a => a !== null));}).catch(() => {if (active) setAssets([]);}); return () => {active = false;};}, [key, session]);
  return <View style={{gap: 14 * s}}>{assets.filter(a => ids.includes(a.id)).map((asset, index) => <View key={asset.id} style={{flexDirection: 'row', gap: 12 * s, alignItems: 'center'}}>
    {asset.uri.startsWith('data:image/') && <Image source={{uri: asset.uri}} style={{width: 88 * s, height: 88 * s, borderRadius: 18 * s}}/>}
    <Text numberOfLines={2} style={{flex: 1, color: p.text, fontSize: 23 * s}}>{asset.name ?? `이미지 ${index + 1}`}</Text><StudioAction label="연결 해제" scale={s} onPress={() => remove(asset.id)}/>
  </View>)}</View>;
}
