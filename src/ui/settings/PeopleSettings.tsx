import {useRef, useState, useSyncExternalStore} from 'react';
import {Image, Pressable, Text, View} from 'react-native';
import {canMovePersonaFolders, libraryPersonas, personaFolderPath, type PersonaFields} from '../../features/personas/personaPreferences';
import {pickProfileImage} from '../../adapters/profile/pickProfileImage';
import {cropProfileImage} from '../../adapters/profile/cropProfileImage';
import {usePalette} from '../Theme';
import type {SettingsServices} from './SettingsServices';
import {ChoicePage, Field, Note, SettingRow, SettingsPage, TextAction, type SettingsNavigation} from './controls';

export function Avatar({image, name, size = 52}: {image: string | null; name: string; size?: number}) {
  const colors = usePalette();
  return <View style={{width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface}}>
    {image ? <Image source={{uri: image}} style={{width: size, height: size}}/> : <Text style={{fontSize: size * .36, color: colors.foreground}}>{Array.from(name)[0] || '나'}</Text>}
  </View>;
}
function PhotoField({image, name, onChange}: {image: string | null; name: string; onChange: (image: string | null) => void}) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const selecting = useRef(false);
  const pick = async () => {
    if (selecting.current) return;
    selecting.current = true; setBusy(true); setError('');
    try {
      const photo = await pickProfileImage();
      if (photo) {
        const size = Math.min(photo.width, photo.height);
        onChange(await cropProfileImage(photo, {x: Math.round((photo.width - size) / 2), y: Math.round((photo.height - size) / 2), size}));
      }
    } catch {setError('사진을 불러오지 못했어요. 다시 선택해 주세요.');}
    finally {selecting.current = false; setBusy(false);}
  };
  return <><View style={{paddingHorizontal: 18.67, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12}}>
    <Avatar image={image} name={name} size={76}/><TextAction label={busy ? '불러오는 중' : '사진 변경'} disabled={busy} onPress={() => {void pick();}}/>
    {!!image && <TextAction label="사진 제거" onPress={() => onChange(null)}/>}</View>{!!error && <Note error>{error}</Note>}</>;
}
export function ProfileSettings({services, nav}: {services: SettingsServices; nav: SettingsNavigation}) {
  const state = useSyncExternalStore(services.profile.subscribe, services.profile.snapshot);
  const [name, setName] = useState(state.value.name), [image, setImage] = useState(state.value.image);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try {await services.profile.save({name, image}); nav.back();} catch {setError('프로필을 저장하지 못했어요. 다시 시도해 주세요.');} finally {setBusy(false);}
  };
  return <SettingsPage title="프로필 편집" nav={nav} testID="ui-profile-settings" action={<TextAction label="완료" disabled={busy || !name.trim() || !state.ready} onPress={() => {void save();}}/>}>
    {!state.ready ? <><Note error={!!state.error}>{state.error || '프로필을 불러오고 있어요.'}</Note>{!!state.error && <TextAction label="다시 불러오기" onPress={() => {void services.profile.load();}}/>}</> : <>
      <PhotoField image={image} name={name} onChange={setImage}/><Field label="이름" testID="ui-profile-name" value={name} onChange={setName} maxLength={24}/></>}
    {!!error && <Note error>{error}</Note>}
  </SettingsPage>;
}

export function PersonasSettings({services, nav, folderId = null}: {services: SettingsServices; nav: SettingsNavigation; folderId?: string | null}) {
  const {value, ready, error} = useSyncExternalStore(services.personas.subscribe, services.personas.snapshot);
  const colors = usePalette();
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false), [selected, setSelected] = useState<string[]>([]), [notice, setNotice] = useState('');
  const title = value.folders.find(item => item.id === folderId)?.name ?? '페르소나';
  const entries = libraryPersonas(value, folderId, query);
  const folders = value.folders.filter(folder => query ? folder.name.toLowerCase().includes(query.toLowerCase()) && (folderId === null || folder.parentId === folderId) : folder.parentId === folderId);
  const selectedPeople = selected.filter(id => id.startsWith('p:')).map(id => id.slice(2)), selectedFolders = selected.filter(id => id.startsWith('f:')).map(id => id.slice(2));
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);
  const mutate = async (action: () => Promise<unknown>) => {try {await action(); setSelected([]); setManaging(false); setNotice('');} catch {setNotice('변경을 저장하지 못했어요. 다시 시도해 주세요.');}};
  const move = () => nav.push(child => <ChoicePage nav={child} title="폴더 이동" value="" choices={[{value: '', label: '전체 보관함'}, ...value.folders.filter(folder => canMovePersonaFolders(value, selectedFolders, folder.id)).map(folder => ({value: folder.id, label: folder.name,
    detail: personaFolderPath(value, folder.parentId).map(parent => parent.name).join(' / ')}))]}
    onChoose={id => {void mutate(() => services.personas.move(selectedPeople, id || null, selectedFolders));}}/>);
  return <SettingsPage title={title} nav={nav} testID="ui-personas-settings" action={<TextAction label={managing ? '완료' : '추가'} disabled={!ready} onPress={() => managing ? (setManaging(false), setSelected([])) : nav.push(child => <PersonaEditor services={services} nav={child} folderId={folderId}/>)}/>}>
    {!!error && <Note error>{error}</Note>}{!!notice && <Note error>{notice}</Note>}
    <Field label="페르소나 검색" testID="ui-persona-search" value={query} onChange={setQuery} placeholder="이름 또는 설명"/>
    <View style={{flexDirection: 'row', paddingHorizontal: 6}}>
      <TextAction label="폴더 만들기" disabled={!ready} onPress={() => nav.push(child => <FolderEditor services={services} nav={child} parentId={folderId}/>)}/>
      {!!folderId && <TextAction label="폴더 이름" onPress={() => nav.push(child => <FolderEditor services={services} nav={child} parentId={folderId} rename/>)}/>}
      <TextAction label={managing ? '선택 취소' : '관리'} onPress={() => {setManaging(!managing); setSelected([]);}}/>
    </View>
    {managing && <View style={{flexDirection: 'row', paddingHorizontal: 6}}><TextAction label="이동" disabled={!selected.length} onPress={move}/>
      <TextAction label="삭제" danger disabled={!selected.length} onPress={() => nav.push(child => <ConfirmDelete nav={child} onDelete={async () => {await services.personas.removeMany(selectedPeople, selectedFolders); setSelected([]); setManaging(false);}}/>)}/></View>}
    {folders.map(folder => <SettingRow key={folder.id} testID={`ui-persona-folder-${folder.id}`} label={folder.name} value={managing ? selected.includes(`f:${folder.id}`) ? '선택됨' : '선택' : '폴더'}
      onPress={() => managing ? toggle(`f:${folder.id}`) : nav.push(child => <PersonasSettings services={services} nav={child} folderId={folder.id}/>)}/>)}
    {entries.map(persona => <Pressable key={persona.id} testID={`ui-persona-${persona.id}`} accessibilityRole={managing ? 'checkbox' : 'button'} accessibilityLabel={persona.name}
      accessibilityState={managing ? {checked: selected.includes(`p:${persona.id}`)} : {}}
      onPress={() => managing ? toggle(`p:${persona.id}`) : nav.push(child => <PersonaEditor services={services} nav={child} id={persona.id} folderId={persona.folderId}/>)}
      style={({pressed}) => ({paddingHorizontal: 18.67, paddingVertical: 14, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? .55 : 1})}>
      <Avatar image={persona.image} name={persona.name}/><View style={{flex: 1, gap: 4}}><Text numberOfLines={1} style={{fontSize: 16, lineHeight: 22, color: colors.foreground}}>{persona.name}</Text>
        <Text numberOfLines={1} style={{fontSize: 14, lineHeight: 20, color: colors.secondaryForeground}}>{persona.description || '설명을 추가해 보세요.'}</Text></View>
      {managing && <Text style={{fontSize: 14, color: colors.secondaryForeground}}>{selected.includes(`p:${persona.id}`) ? '선택됨' : '선택'}</Text>}
    </Pressable>)}
    {!entries.length && !folders.length && <Note>{query ? '검색 결과가 없어요.' : '추가 버튼으로 페르소나를 만들어 보세요.'}</Note>}
  </SettingsPage>;
}
function PersonaEditor({services, nav, id, folderId}: {services: SettingsServices; nav: SettingsNavigation; id?: string; folderId: string | null}) {
  const {value} = useSyncExternalStore(services.personas.subscribe, services.personas.snapshot);
  const initial = value.items.find(item => item.id === id);
  const [draft, setDraft] = useState<PersonaFields>(() => initial ? {name: initial.name, description: initial.description, image: initial.image} : {name: '', description: '', image: null});
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy || !draft.name.trim()) return;
    setBusy(true); setError('');
    try {if (id) await services.personas.update(id, draft); else await services.personas.create(draft, folderId); nav.back();}
    catch {setError('페르소나를 저장하지 못했어요. 다시 시도해 주세요.');} finally {setBusy(false);}
  };
  return <SettingsPage title={id ? '페르소나 편집' : '페르소나 만들기'} nav={nav} testID="ui-persona-editor" action={<TextAction testID="ui-persona-save" label="완료" disabled={!draft.name.trim() || busy} onPress={() => {void save();}}/>}>
    <PhotoField image={draft.image} name={draft.name} onChange={image => setDraft(old => ({...old, image}))}/>
    <Field label="이름" testID="ui-persona-name" value={draft.name} onChange={name => setDraft(old => ({...old, name}))} maxLength={40} placeholder="페르소나 이름"/>
    <Field label="설명" testID="ui-persona-description" value={draft.description} onChange={description => setDraft(old => ({...old, description}))} maxLength={2000} multiline placeholder="성격, 배경, 말투를 적어 주세요."/>
    <Note>이름은 40자, 설명은 2,000자까지 입력할 수 있어요.</Note>
    {!!error && <Note error>{error}</Note>}
    {!!id && <TextAction label="복제" disabled={busy} onPress={() => {setBusy(true); void services.personas.duplicate(id).then(() => nav.back()).catch(() => setError('복제하지 못했어요. 다시 시도해 주세요.')).finally(() => setBusy(false));}}/>}
  </SettingsPage>;
}
function FolderEditor({services, nav, parentId, rename = false}: {services: SettingsServices; nav: SettingsNavigation; parentId: string | null; rename?: boolean}) {
  const [name, setName] = useState(rename ? services.personas.snapshot().value.folders.find(item => item.id === parentId)?.name ?? '' : ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {if (rename && parentId) await services.personas.renameFolder(parentId, name); else await services.personas.createFolder(name, [], parentId); nav.back();}
    catch {setError('폴더를 저장하지 못했어요. 다시 시도해 주세요.');} finally {setBusy(false);}
  };
  return <SettingsPage title={rename ? '폴더 이름' : '폴더 만들기'} nav={nav} action={<TextAction label="완료" disabled={!name.trim() || busy} onPress={() => {void save();}}/>}>
    <Field label="폴더 이름" testID="ui-persona-folder-name" value={name} onChange={setName} maxLength={40}/>{!!error && <Note error>{error}</Note>}
  </SettingsPage>;
}
function ConfirmDelete({nav, onDelete}: {nav: SettingsNavigation; onDelete: () => Promise<void>}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <SettingsPage title="삭제 확인" nav={nav}><Note>선택한 항목을 삭제할까요? 폴더 안에서 선택하지 않은 항목은 보관함으로 옮겨져요.</Note>
    <TextAction label="삭제" danger disabled={busy} onPress={() => {setBusy(true); void onDelete().then(nav.back).catch(() => setError('삭제하지 못했어요. 다시 시도해 주세요.')).finally(() => setBusy(false));}}/>
    <TextAction label="취소" onPress={nav.back}/>{!!error && <Note error>{error}</Note>}
  </SettingsPage>;
}
