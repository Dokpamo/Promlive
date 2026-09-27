import {useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import type {Card} from './model';
import {activeResources, isAvailable, type SceneState} from './experience';
import {SettingsSheet, SettingsChoice} from '../settings/SettingsLayout';
import {useAppearance} from '../appearance/AppAppearance';
import {StudioAction, StudioSection} from '../authoring/StudioControls';
import {FlagEditor} from '../authoring/StudioStructure';

export interface SceneStore {
  getConversationCard?(id: string): Promise<Card | null>;
  getSceneState?(id: string): Promise<SceneState | null>;
  setSceneState?(id: string, state: SceneState): Promise<void>;
}
export function StartChoice({card, onChoose, onClose}: {card: Card; onChoose: (startId: string) => void; onClose: () => void}) {
  const selected = useRef<string | null>(null);
  const finish = () => {
    const id = selected.current; selected.current = null;
    onClose();
    if (id !== null) onChoose(id);
  };
  return <SettingsSheet title="어디서 시작할까요?" onClose={finish}>{close => <>{card.experience?.starts.map(start => <SettingsChoice key={start.id} label={start.name} detail={start.prompt || card.experience?.resources.find(r => r.id === start.locationId)?.name || '장소 미지정'} selected={start.id === card.experience?.defaultStartId} onPress={() => {selected.current = start.id; close();}}/>)}</>}</SettingsSheet>;
}
export function SceneControls({store, roomId, scale: s, report}: {store: SceneStore; roomId: string; scale: number; report: (error: unknown) => void}) {
  const [data, setData] = useState<{card: Card; scene: SceneState} | null>(null);
  const [open, setOpen] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const {settings: p} = useAppearance();
  useEffect(() => {let active = true; void Promise.all([store.getConversationCard?.(roomId), store.getSceneState?.(roomId)]).then(([card, scene]) => {if (active) setData(card?.experience && scene ? {card, scene} : null);}).catch(report); return () => {active = false;};}, [roomId, store, open]);
  if (!data?.card.experience || !store.setSceneState) return null;
  const {card, scene} = data, experience = card.experience!;
  const current = experience.resources.find(r => r.id === scene.locationId)?.name ?? '장소 미지정';
  const update = async (next: SceneState) => {
    setData({card, scene: next});
    const task = writes.current.then(() => store.setSceneState!(roomId, next));
    writes.current = task.catch(() => {});
    try {await task;} catch (error) {report(error);}
  };
  return <View style={{marginBottom: 22 * s}}>
    {!!experience.starts.find(start => start.id === scene.startId)?.intro?.text && <View testID="card-intro" style={{paddingVertical: 24 * s, marginBottom: 24 * s}}>
      <Text style={{color: p.text, fontSize: 28 * s, lineHeight: 44 * s}}>{experience.starts.find(start => start.id === scene.startId)!.intro!.text}</Text>
    </View>}
    <StudioAction label={`장면 설정 · ${current}`} scale={s} onPress={() => setOpen(true)}/>
    {open && <SettingsSheet title="현재 장면" fillHeight onClose={() => setOpen(false)}>{() => <View style={{gap: 14 * s}}>
      <Text style={{color: p.secondary, fontSize: 23 * s, lineHeight: 34 * s}}>장소와 상태를 바꾸면 다음 응답부터 해당 프롬프트가 반영돼요.</Text>
      <StudioSection title="장소" scale={s}>
        <StudioAction label="장소 미지정" scale={s} selected={scene.locationId === null} onPress={() => void update({...scene, locationId: null})}/>
        {experience.resources.filter(r => r.kind === 'place').map(r => <StudioAction key={r.id} label={`${r.name}${isAvailable(r, scene) ? '' : ' · 닫힘'}`} disabled={!isAvailable(r, scene)} selected={r.id === scene.locationId} scale={s} onPress={() => void update({...scene, locationId: r.id})}/>)}
      </StudioSection>
      <StudioSection title="직접 활성화할 항목" scale={s}>
        {experience.resources.filter(r => r.kind !== 'world' && r.kind !== 'place' && r.activation.mode === 'manual').map(r => <StudioAction key={r.id} label={r.name} selected={scene.activeIds.includes(r.id)} scale={s} onPress={() => void update({...scene, activeIds: scene.activeIds.includes(r.id) ? scene.activeIds.filter(id => id !== r.id) : [...scene.activeIds, r.id]})}/>)}
      </StudioSection>
      <StudioSection title="상태값" scale={s}><FlagEditor value={scene.flags} onChange={flags => void update({...scene, flags})} scale={s}/></StudioSection>
      <StudioSection title="지금 포함되는 프롬프트" scale={s}><Text style={{color: p.text, fontSize: 24 * s, lineHeight: 36 * s}}>{activeResources(experience, scene).map(r => r.name).join(' · ')}</Text></StudioSection>
    </View>}</SettingsSheet>}
  </View>;
}
