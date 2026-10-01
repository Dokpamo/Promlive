import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, BackHandler, Keyboard, Platform, useWindowDimensions} from 'react-native';
import {ScreenLayer} from '../ScreenLayer';
import {SwipeBack} from '../SwipeBack';
import {createBackTransition, type BackTransition} from '../backTransition';
import {useScreenCorners} from '../useScreenCorners';
import {useSettingsServices} from './SettingsServices';
import {AiSettings} from './AiSettings';
import {PersonasSettings, ProfileSettings} from './PeopleSettings';
import {OtherSettings, type SettingsDestination} from './OtherSettings';
import {Note, SettingsFocusContext, SettingsPage, TextAction, type SettingsNavigation, type SettingsRender} from './controls';

type Entry = {id: number; render: SettingsRender; transition: BackTransition};
export function SettingsNavigator({initial, transition, onClose, scale, bottomInset}: {initial: SettingsDestination; transition: BackTransition; onClose: () => void; scale: number; bottomInset: number}) {
  const {width} = useWindowDimensions(), corners = useScreenCorners();
  const nextId = useRef(0);
  const [stack, setStack] = useState<Entry[]>(() => [{id: 0, transition, render: nav => <Destination page={initial} nav={nav}/>}]);
  const [closing, setClosing] = useState<number | null>(null);
  const closingRef = useRef<number | null>(null);
  const completedRef = useRef<number | null>(null);
  const back = useCallback(() => {
    if (closingRef.current !== null) return;
    const id = stack.at(-1)!.id;
    closingRef.current = id;
    Keyboard.dismiss();
    setClosing(id);
  }, [stack]);
  const completeBack = useCallback((id: number) => {
    const entry = stack.at(-1);
    if (entry?.id !== id || completedRef.current === id) return;
    completedRef.current = id;
    entry.transition.finish();
    closingRef.current = null; setClosing(null);
    if (stack.length === 1) {onClose(); return;}
    setStack(old => old.at(-1)?.id === id ? old.slice(0, -1) : old);
  }, [stack, onClose]);
  const push = useCallback((render: SettingsRender) => {
    if (closingRef.current !== null) return;
    Keyboard.dismiss();
    const motion = createBackTransition(new Animated.Value(0), width, corners); motion.prepareOpen();
    setStack(old => [...old, {id: ++nextId.current, render, transition: motion}]);
  }, [width, corners]);
  useEffect(() => {
    if (Platform.OS === 'android') {
      const event = BackHandler.addEventListener('hardwareBackPress', () => {back(); return true;}); return () => event.remove();
    }
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); back();}};
      document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
    }
  }, [back]);
  return <>{stack.map((entry, index) => <ScreenLayer key={entry.id} testID={`ui-settings-layer-${entry.id}`} hidden={index !== stack.length - 1} prepared={index === stack.length - 2} backTransition={stack[index + 1]?.transition}>
    <SettingsEntry entry={entry} active={index === stack.length - 1} dismiss={closing === entry.id}
      onBack={() => completeBack(entry.id)} nav={{back, push, scale, bottomInset}}/>
  </ScreenLayer>)}</>;
}
function SettingsEntry({entry, active, dismiss, onBack, nav}: {entry: Entry; active: boolean; dismiss: boolean; onBack: () => void; nav: SettingsNavigation}) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {if (!active) setFocused(false);}, [active]);
  return <SettingsFocusContext.Provider value={setFocused}><SwipeBack identity={`settings-${entry.id}`} transition={entry.transition} enabled={active && !focused} dismiss={dismiss} onBack={onBack}>
    {entry.render(nav)}
  </SwipeBack></SettingsFocusContext.Provider>;
}
function Destination({page, nav}: {page: SettingsDestination; nav: SettingsNavigation}) {
  const {services, error, retry} = useSettingsServices();
  if (!services) return <SettingsPage title={{ai: 'AI', personas: '페르소나', profile: '프로필 편집', prompt: '프롬프트', theme: '테마', language: '언어', plugins: '플러그인', info: '정보'}[page]} nav={nav}>
    <Note error={!!error}>{error || '저장한 설정을 불러오고 있어요.'}</Note>{!!error && <TextAction label="다시 시도" onPress={retry}/>}</SettingsPage>;
  if (page === 'ai') return <AiSettings services={services} nav={nav}/>;
  if (page === 'personas') return <PersonasSettings services={services} nav={nav}/>;
  if (page === 'profile') return <ProfileSettings services={services} nav={nav}/>;
  return <OtherSettings page={page} services={services} nav={nav}/>;
}
