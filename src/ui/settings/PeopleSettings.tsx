import {useContext, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Image, Keyboard, Pressable, Text, View} from 'react-native';
import {ListPressable} from '../ListPressable';
import {canMovePersonaFolders, libraryPersonas, personaFolderPath, searchPersonas, type PersonaFields} from '../../features/personas/personaPreferences';
import {pickProfileImage} from '../../adapters/profile/pickProfileImage';
import {cropProfileImage} from '../../adapters/profile/cropProfileImage';
import {usePalette} from '../Theme';
import {settingsDetailLayout} from '../tokens';
import {FilterChips} from '../FilterChips';
import {NavigationButton} from '../Navigation';
import {Icon} from '../Icon';
import {ProfilePhotoEditor} from './ProfilePhotoEditor';
import type {SettingsServices} from './SettingsServices';
import {ChoicePage, Field, Note, SettingsFocusContext, SettingsPage, TextAction, type SettingsNavigation} from './controls';

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
  return <><View style={{paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12}}>
    <Avatar image={image} name={name} size={76}/><TextAction label={busy ? '불러오는 중' : '사진 변경'} disabled={busy} onPress={() => {void pick();}}/>
    {!!image && <TextAction label="사진 제거" onPress={() => onChange(null)}/>}</View>{!!error && <Note error>{error}</Note>}</>;
}
export function ProfileSettings({services, nav}: {services: SettingsServices; nav: SettingsNavigation}) {
  const state = useSyncExternalStore(services.profile.subscribe, services.profile.snapshot);
  return <SettingsPage title="프로필 편집" nav={nav} testID="ui-profile-settings">
    {!state.ready ? <><Note error={!!state.error}>{state.error || '프로필을 불러오고 있어요.'}</Note>{!!state.error && <TextAction label="다시 불러오기" onPress={() => {void services.profile.load();}}/>}</> : <>
      <ProfileFields services={services} nav={nav}/></>}
  </SettingsPage>;
}
function ProfileFields({services, nav}: {services: SettingsServices; nav: SettingsNavigation}) {
  const {value} = useSyncExternalStore(services.profile.subscribe, services.profile.snapshot);
  const colors = usePalette();
  const [name, setName] = useState(value.name), [nameError, setNameError] = useState(false);
  const [photoError, setPhotoError] = useState(''), [picking, setPicking] = useState(false);
  const mounted = useRef(false), selecting = useRef(false), nameWrite = useRef(0);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const saveName = async (text: string) => {
    const attempt = ++nameWrite.current;
    setNameError(false);
    // An empty input is a temporary editing state, never a persisted empty name.
    if (!text.trim()) return;
    try {await services.profile.update({name: text.trim()});}
    catch {if (mounted.current && nameWrite.current === attempt) setNameError(true);}
  };
  const pick = async () => {
    if (selecting.current || nav.closing) return;
    selecting.current = true; setPicking(true); setPhotoError(''); Keyboard.dismiss();
    try {
      const photo = await pickProfileImage();
      if (photo && mounted.current) nav.push(child => <ProfilePhotoEditor photo={photo} nav={child}
        onSave={image => services.profile.update({image})}/>, {swipeBack: false});
    } catch {if (mounted.current) setPhotoError('사진을 불러오지 못했어요. 다시 선택해 주세요.');}
    finally {selecting.current = false; if (mounted.current) setPicking(false);}
  };
  return <>
    <View style={{alignItems: 'center', paddingTop: 20, paddingBottom: 26}}>
      <View testID="ui-profile-avatar" style={{width: 152, height: 152}}>
        <Avatar image={value.image} name={name} size={152}/>
        <Pressable testID="ui-profile-photo-edit" accessibilityRole="button" accessibilityLabel="프로필 사진 편집"
          accessibilityState={{busy: picking, disabled: picking || !!nav.closing}} disabled={picking || !!nav.closing} onPress={() => {void pick();}}
          style={{position: 'absolute', bottom: 0, right: 0, width: 48, height: 48, borderRadius: 24,
            borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface}}>
          {picking ? <ActivityIndicator color={colors.foreground}/> : <Icon name="compose" size={24}/>}
        </Pressable>
      </View>
    </View>
    {!!photoError && <Note error>{photoError}</Note>}
    <Field label="이름" testID="ui-profile-name" value={name} maxLength={24} editable={!nav.closing} returnKeyType="done"
      onChange={text => {setName(text); void saveName(text);}}
      onBlur={() => {if (!name.trim()) setName(services.profile.snapshot().value.name);}}/>
    {nameError && <><Note error>이름을 저장하지 못했어요. 다시 시도해 주세요.</Note>
      <TextAction label="이름 저장 다시 시도" onPress={() => {void saveName(name);}}/></>}
  </>;
}

export function PersonasSettings({services, nav}: {services: SettingsServices; nav: SettingsNavigation}) {
  const {value, ready, error} = useSyncExternalStore(services.personas.subscribe, services.personas.snapshot);
  const colors = usePalette();
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false), [selected, setSelected] = useState<string[]>([]), [notice, setNotice] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const setFocused = useContext(SettingsFocusContext);
  const [folder, setFolder] = useState<string | null>(null);
  const folderId = value.folders.find(item => item.id === folder)?.id ?? null;
  const entries = folderId === null ? searchPersonas(value.items, query) : libraryPersonas(value, folderId, query);
  const selectedPeople = selected.filter(id => id.startsWith('p:')).map(id => id.slice(2)), selectedFolders = selected.filter(id => id.startsWith('f:')).map(id => id.slice(2));
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);
  const beginSelection = (id: string) => {
    if (!ready) return;
    Keyboard.dismiss(); setFocused(false); setManaging(true); setNotice('');
    setSelected(old => old.includes(id) ? old : [...old, id]);
  };
  const toggleSearch = () => {
    if (searchOpen) {setQuery(''); Keyboard.dismiss(); setFocused(false);}
    setSearchOpen(!searchOpen);
  };
  const filters = [
    {id: 'all', label: '전체', disabled: managing},
    ...value.folders.map(item => ({id: item.id, label: personaFolderPath(value, item.id).map(parent => parent.name).join(' / '),
      onLongPress: () => beginSelection(`f:${item.id}`)})),
  ];
  const changeFolder = (id: string) => {
    if (managing) {toggle(`f:${id}`); return;}
    setFolder(id === 'all' ? null : id); setSelected([]); setNotice('');
  };
  const mutate = async (action: () => Promise<unknown>) => {try {await action(); setSelected([]); setManaging(false); setNotice('');} catch {setNotice('변경을 저장하지 못했어요. 다시 시도해 주세요.');}};
  const move = () => nav.push(child => <ChoicePage nav={child} title="폴더 이동" value="" choices={[{value: '', label: '전체 보관함'}, ...value.folders.filter(folder => canMovePersonaFolders(value, selectedFolders, folder.id)).map(folder => ({value: folder.id, label: folder.name,
    detail: personaFolderPath(value, folder.parentId).map(parent => parent.name).join(' / ')}))]}
    onChoose={id => {void mutate(() => services.personas.move(selectedPeople, id || null, selectedFolders));}}/>);
  return <SettingsPage title="페르소나" nav={nav} testID="ui-personas-settings" action={<View style={{flexDirection: 'row', alignItems: 'center'}}>
    {managing ? <TextAction label="완료" onPress={() => {setManaging(false); setSelected([]); setNotice('');}}/> :
      <NavigationButton testID="ui-persona-search-button" icon="search" label="페르소나 검색" scale={nav.scale} expanded={searchOpen} onPress={toggleSearch}/>}
    {!managing && <NavigationButton testID="ui-persona-add" icon="plus" label="페르소나 추가" scale={nav.scale}
      onPress={ready ? () => nav.push(child => <PersonaEditor services={services} nav={child} folderId={folderId}/>) : undefined}/>}
  </View>}>
    {!!error && <Note error>{error}</Note>}{!!notice && <Note error>{notice}</Note>}
    <View testID="ui-persona-folder-bar">
      <FilterChips scope="personas" items={filters} selected={managing ? selectedFolders : folderId ?? 'all'} onChange={changeFolder}
        scale={nav.scale} horizontalInset={settingsDetailLayout.horizontalInset} {...(nav.scrollBlocker ? {blockerRef: nav.scrollBlocker} : {})}
        trailingAction={managing ? undefined : {testID: 'ui-persona-folder-add', icon: 'listPlus', label: '폴더 만들기', disabled: !ready,
          onPress: () => nav.push(child => <FolderEditor services={services} nav={child} parentId={folderId}/>)}}/>
    </View>
    {searchOpen && <Field label="페르소나 검색" search testID="ui-persona-search" value={query} onChange={setQuery} placeholder="이름 또는 설명" autoFocus returnKeyType="search"/>}
    {managing && <View style={{flexDirection: 'row', paddingHorizontal: settingsDetailLayout.horizontalInset - settingsDetailLayout.textActionInset}}>
      {selectedFolders.length === 1 && !selectedPeople.length && <TextAction label="폴더 이름" onPress={() => nav.push(child => <FolderEditor services={services} nav={child} parentId={selectedFolders[0]!} rename/>)}/>}
      <TextAction label="이동" disabled={!selected.length} onPress={move}/>
      <TextAction label="삭제" danger disabled={!selected.length} onPress={() => nav.push(child => <ConfirmDelete nav={child} onDelete={async () => {await services.personas.removeMany(selectedPeople, selectedFolders); setSelected([]); setManaging(false);}}/>)}/></View>}
    {entries.map(persona => <ListPressable key={persona.id} testID={`ui-persona-${persona.id}`} accessibilityRole={managing ? 'checkbox' : 'button'} accessibilityLabel={persona.name}
      accessibilityHint="길게 눌러 선택" accessibilityActions={[{name: 'longpress', label: '선택'}]}
      onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') beginSelection(`p:${persona.id}`);}}
      onLongPress={() => beginSelection(`p:${persona.id}`)}
      accessibilityState={managing ? {checked: selected.includes(`p:${persona.id}`)} : {}} aria-checked={managing ? selected.includes(`p:${persona.id}`) : undefined}
      onPress={() => managing ? toggle(`p:${persona.id}`) : nav.push(child => <PersonaEditor services={services} nav={child} id={persona.id} folderId={persona.folderId}/>)}
      style={{paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 14, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: managing && selected.includes(`p:${persona.id}`) ? colors.surface : 'transparent'}}>
      <Avatar image={persona.image} name={persona.name}/><View style={{flex: 1, gap: 4}}><Text numberOfLines={1} style={{fontSize: 16, lineHeight: 22, color: colors.foreground}}>{persona.name}</Text>
        <Text numberOfLines={1} style={{fontSize: 14, lineHeight: 20, color: colors.secondaryForeground}}>{persona.description || '설명을 추가해 보세요.'}</Text></View>
      {managing && selected.includes(`p:${persona.id}`) && <Icon name="check" size={settingsDetailLayout.selectionIconSize}/>}
    </ListPressable>)}
    {!entries.length && <Note>{query ? '검색 결과가 없어요.' : '플러스 버튼으로 페르소나를 만들어 보세요.'}</Note>}
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
  return <SettingsPage title="삭제 확인" nav={nav}><Note>선택한 항목을 삭제할까요? 폴더 안에서 선택하지 않은 항목은 유지돼요.</Note>
    <TextAction label="삭제" danger disabled={busy} onPress={() => {setBusy(true); void onDelete().then(nav.back).catch(() => setError('삭제하지 못했어요. 다시 시도해 주세요.')).finally(() => setBusy(false));}}/>
    <TextAction label="취소" onPress={nav.back}/>{!!error && <Note error>{error}</Note>}
  </SettingsPage>;
}
