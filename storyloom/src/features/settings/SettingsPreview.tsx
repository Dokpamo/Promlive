import {useState, type ReactNode} from 'react';
import {Keyboard, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatIcon} from '../chat/ChatIcon';
import {SettingsIcon, type SettingsIconName} from './SettingsIcon';

const dark = {background: '#111111', surface: '#1F1F1F', control: '#292929', selected: '#2A2A2A', text: '#EFEFEF', secondary: '#969696', faint: '#727272', divider: '#2D2D2D', icon: '#C6C6C6', accent: '#B4C8BF'};
const light: Palette = {background: '#F5F5F5', surface: '#FFFFFF', control: '#FFFFFF', selected: '#EEEEEE', text: '#1D1D1D', secondary: '#777777', faint: '#909090', divider: '#EEEEEE', icon: '#505050', accent: '#517B69'};
type Palette = typeof dark;
type Sheet = 'profile' | 'connection' | 'model' | 'response' | 'text' | 'theme' | 'about' | null;
type Theme = '다크' | '라이트' | '시스템';
const sheetTitles: Record<Exclude<Sheet, null>, string> = {profile: '프로필', connection: 'AI 연결', model: '기본 모델', response: '응답 스타일', text: '글자 크기', theme: '화면 테마', about: 'Promlive'};

/** Interactive UI preview. No authentication, network calls, or persisted settings. */
export function SettingsPreview({onClose}: {onClose: () => void}) {
  return <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider><SettingsContent onClose={onClose}/></SafeAreaProvider>
  </Modal>;
}

function SettingsContent({onClose}: {onClose: () => void}) {
  const systemTheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [theme, setTheme] = useState<Theme>('다크');
  const [name, setName] = useState('사용자');
  const [nameDraft, setNameDraft] = useState(name);
  const [model, setModel] = useState('자동 선택');
  const [response, setResponse] = useState('균형 있게');
  const [textSize, setTextSize] = useState('보통');
  const [haptic, setHaptic] = useState(true);
  const [notification, setNotification] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const isDark = theme === '다크' || (theme === '시스템' && systemTheme !== 'light');
  const p = isDark ? dark : light;
  const closeSheet = () => {Keyboard.dismiss(); setSheet(null);};
  const choose = (setter: (value: string) => void, value: string) => {setter(value); closeSheet();};

  return <SafeAreaView testID="settings-preview" edges={['left', 'right', 'bottom']} style={[styles.page, {backgroundColor: p.background}]}>
    <StatusBar barStyle="light-content"/>
    <View style={{height: insets.top, backgroundColor: dark.background}}/>
    <View style={styles.frame}>
      <View style={styles.header}>
        <Pressable testID="settings-back" accessibilityRole="button" accessibilityLabel="설정 닫기" onPress={onClose} style={({pressed}) => [styles.back, {backgroundColor: p.control, opacity: pressed ? 0.7 : 1}]}><ChatIcon name="back" size={22} color={p.text}/></Pressable>
        <Text accessibilityRole="header" style={[styles.heading, {color: p.text}]}>설정</Text>
        <View style={[styles.badge, {backgroundColor: p.surface}]}><Text style={[styles.badgeText, {color: p.secondary}]}>미리보기</Text></View>
      </View>
      <ScrollView testID="settings-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable testID="settings-profile" accessibilityRole="button" accessibilityLabel="프로필 수정" onPress={() => {setNameDraft(name); setSheet('profile');}} style={({pressed}) => [styles.profile, {backgroundColor: pressed ? p.selected : p.surface}]}>
          <View style={styles.avatar}><ChatIcon name="user" size={28} color="#E1D8CC"/></View>
          <View style={styles.profileText}><Text numberOfLines={1} style={[styles.profileName, {color: p.text}]}>{name}</Text><Text style={[styles.profileCaption, {color: p.secondary}]}>나의 프로필</Text></View>
          <SettingsIcon name="edit" size={19} color={p.secondary}/>
        </Pressable>

        <Group title="AI" palette={p}>
          <Row icon="connection" label="AI 연결" value="연결 안 됨" onPress={() => setSheet('connection')} palette={p}/>
          <Row icon="model" label="기본 모델" value={model} onPress={() => setSheet('model')} palette={p} separator/>
          <Row icon="response" label="응답 스타일" value={response} onPress={() => setSheet('response')} palette={p} separator/>
        </Group>
        <Group title="대화" palette={p}>
          <Row icon="text" label="글자 크기" value={textSize} onPress={() => setSheet('text')} palette={p}/>
          <ToggleRow icon="haptic" label="터치 진동" value={haptic} onChange={setHaptic} palette={p}/>
          <ToggleRow icon="bell" label="응답 알림" value={notification} onChange={setNotification} palette={p}/>
        </Group>
        <Group title="앱" palette={p}>
          <Row icon="theme" label="화면 테마" value={theme} onPress={() => setSheet('theme')} palette={p}/>
          <Row icon="info" label="앱 정보" onPress={() => setSheet('about')} palette={p} separator/>
        </Group>
        <Text style={[styles.footnote, {color: p.faint}]}>미리보기에서 바꾼 설정은 저장되지 않아요.</Text>
      </ScrollView>
    </View>

    <Modal visible={sheet !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={closeSheet}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={closeSheet} style={StyleSheet.absoluteFill}/>
        <View testID="settings-sheet" accessibilityViewIsModal style={[styles.sheet, {backgroundColor: p.surface, paddingBottom: Math.max(insets.bottom, 18), maxHeight: '85%'}]}>
          <View style={[styles.handle, {backgroundColor: p.divider}]}/>
          <View style={styles.sheetHeader}><Text accessibilityRole="header" style={[styles.sheetTitle, {color: p.text}]}>{sheet ? sheetTitles[sheet] : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={closeSheet} style={styles.sheetClose}><ChatIcon name="close" size={16} color={p.secondary}/></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            {sheet === 'profile' && <>
              <Text style={[styles.sheetCaption, {color: p.secondary}]}>대화에서 사용할 이름</Text>
              <TextInput accessibilityLabel="프로필 이름" value={nameDraft} onChangeText={setNameDraft} maxLength={24} placeholder="이름" placeholderTextColor={p.faint} returnKeyType="done" onSubmitEditing={() => {if (nameDraft.trim()) {setName(nameDraft.trim()); closeSheet();}}} style={[styles.nameInput, {color: p.text, backgroundColor: p.background, borderColor: p.divider}]}/>
              <Pressable accessibilityRole="button" accessibilityLabel="프로필 이름 적용" disabled={!nameDraft.trim()} onPress={() => {setName(nameDraft.trim()); closeSheet();}} style={[styles.primary, {backgroundColor: p.text, opacity: nameDraft.trim() ? 1 : 0.35}]}><Text style={[styles.primaryText, {color: p.background}]}>적용</Text></Pressable>
            </>}
            {sheet === 'connection' && <>
              <View style={styles.provider}><View style={[styles.providerIcon, {backgroundColor: p.background}]}><Text style={[styles.providerLetter, {color: p.text}]}>G</Text></View><View style={{flex: 1, gap: 5}}><Text style={[styles.providerName, {color: p.text}]}>Grok</Text><Text style={[styles.sheetCaption, {color: p.secondary}]}>연결 안 됨</Text></View><View style={[styles.statusDot, {backgroundColor: p.faint}]}/></View>
              <Text style={[styles.connectionNote, {color: p.secondary}]}>AI 연결은 다음 단계에서 진행해요.{ '\n' }지금은 설정 화면을 먼저 살펴볼 수 있어요.</Text>
              <View style={[styles.primary, {backgroundColor: p.control}]}><Text style={[styles.primaryText, {color: p.secondary}]}>연결 준비 중</Text></View>
            </>}
            {sheet === 'model' && <>
              <Text style={[styles.sheetCaption, {color: p.secondary, marginBottom: 14}]}>연결 후 사용할 모델의 선택 화면 예시예요.</Text>
              <Choice label="자동 선택" detail="연결한 서비스의 기본 모델" selected={model === '자동 선택'} onPress={() => choose(setModel, '자동 선택')} palette={p}/>
              <Choice label="Grok" detail="모델 미리보기" selected={model === 'Grok'} onPress={() => choose(setModel, 'Grok')} palette={p}/>
            </>}
            {sheet === 'response' && <>
              <Choice label="간결하게" detail="핵심 위주로 짧게" selected={response === '간결하게'} onPress={() => choose(setResponse, '간결하게')} palette={p}/>
              <Choice label="균형 있게" detail="필요한 설명을 알맞게" selected={response === '균형 있게'} onPress={() => choose(setResponse, '균형 있게')} palette={p}/>
              <Choice label="자세하게" detail="맥락과 예시까지 충분하게" selected={response === '자세하게'} onPress={() => choose(setResponse, '자세하게')} palette={p}/>
            </>}
            {sheet === 'text' && <>
              <View style={[styles.textPreview, {backgroundColor: p.background}]}><Text style={{color: p.text, fontSize: textSize === '작게' ? 14 : textSize === '크게' ? 20 : 17, lineHeight: 30}}>오늘은 어떤 이야기를 나눌까요?</Text></View>
              {['작게', '보통', '크게'].map(value => <Choice key={value} label={value} selected={textSize === value} onPress={() => setTextSize(value)} palette={p}/>)}
            </>}
            {sheet === 'theme' && (['다크', '라이트', '시스템'] as const).map(value => <Choice key={value} label={value} selected={theme === value} onPress={() => {setTheme(value); closeSheet();}} palette={p}/>)}
            {sheet === 'about' && <View style={styles.about}><Text style={[styles.aboutBrand, {color: p.text}]}>Promlive</Text><Text style={[styles.sheetCaption, {color: p.secondary}]}>버전 0.1.0</Text><Text style={[styles.aboutDescription, {color: p.secondary}]}>이야기가 시작되는 대화.{ '\n' }대화 기록은 이 기기에 저장됩니다.</Text></View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

function Group({title, palette: p, children}: {title: string; palette: Palette; children: ReactNode}) {
  return <View style={styles.group}><Text style={[styles.groupTitle, {color: p.secondary}]}>{title}</Text><View style={[styles.groupBody, {backgroundColor: p.surface}]}>{children}</View></View>;
}

function Row({icon, label, value, onPress, palette: p, separator = false}: {icon: SettingsIconName; label: string; value?: string; onPress: () => void; palette: Palette; separator?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value ? {text: value} : undefined} onPress={onPress} style={({pressed}) => [styles.row, {backgroundColor: pressed ? p.selected : 'transparent'}]}>
    {separator && <View style={[styles.separator, {backgroundColor: p.divider}]}/>}
    <SettingsIcon name={icon} color={p.icon}/><Text style={[styles.rowLabel, {color: p.text}]}>{label}</Text>
    {value && <Text numberOfLines={1} style={[styles.rowValue, {color: p.secondary}]}>{value}</Text>}<SettingsIcon name="chevron" size={16} color={p.faint}/>
  </Pressable>;
}

function ToggleRow({icon, label, value, onChange, palette: p}: {icon: SettingsIconName; label: string; value: boolean; onChange: (value: boolean) => void; palette: Palette}) {
  return <View style={styles.row}><View style={[styles.separator, {backgroundColor: p.divider}]}/><SettingsIcon name={icon} color={p.icon}/><Text style={[styles.rowLabel, {color: p.text}]}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{false: '#464646', true: p.accent}} thumbColor="#FFFFFF" {...(Platform.OS === 'web' ? {activeThumbColor: '#FFFFFF'} : {})} ios_backgroundColor="#464646"/></View>;
}

function Choice({label, detail, selected, onPress, palette: p}: {label: string; detail?: string; selected: boolean; onPress: () => void; palette: Palette}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected}} onPress={onPress} style={({pressed}) => [styles.choice, {backgroundColor: selected || pressed ? p.selected : 'transparent'}]}><View style={{flex: 1, gap: 5}}><Text style={[styles.choiceLabel, {color: p.text}]}>{label}</Text>{detail && <Text style={[styles.choiceDetail, {color: p.secondary}]}>{detail}</Text>}</View>{selected && <SettingsIcon name="check" size={20} color={p.text}/>}</Pressable>;
}

const styles = StyleSheet.create({
  page: {flex: 1},
  frame: {flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10, minHeight: 68},
  back: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  heading: {flex: 1, fontSize: 23, fontWeight: '700', letterSpacing: -0.6},
  badge: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12},
  badgeText: {fontSize: 11, fontWeight: '500'},
  content: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24},
  profile: {flexDirection: 'row', alignItems: 'center', gap: 15, padding: 17, borderRadius: 22, minHeight: 88},
  avatar: {width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#494137'},
  profileText: {flex: 1, minWidth: 0, gap: 6},
  profileName: {fontSize: 19, fontWeight: '600'},
  profileCaption: {fontSize: 13},
  group: {marginTop: 23},
  groupTitle: {fontSize: 12, fontWeight: '500', marginLeft: 5, marginBottom: 10},
  groupBody: {borderRadius: 20, overflow: 'hidden'},
  row: {minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 12},
  rowLabel: {flex: 1, fontSize: 15, fontWeight: '500'},
  rowValue: {fontSize: 13, maxWidth: '38%'},
  separator: {position: 'absolute', left: 51, right: 16, top: 0, height: StyleSheet.hairlineWidth},
  footnote: {fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 25},
  sheetOverlay: {flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.58)'},
  sheet: {width: '100%', maxWidth: 560, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, overflow: 'hidden'},
  handle: {width: 32, height: 4, borderRadius: 3, alignSelf: 'center', marginBottom: 14},
  sheetHeader: {flexDirection: 'row', alignItems: 'center', paddingLeft: 23, paddingRight: 12, paddingBottom: 12},
  sheetTitle: {flex: 1, fontSize: 21, fontWeight: '700', letterSpacing: -0.5},
  sheetClose: {width: 44, height: 40, alignItems: 'center', justifyContent: 'center'},
  sheetContent: {paddingHorizontal: 18, paddingBottom: 12},
  sheetCaption: {fontSize: 13, lineHeight: 20},
  choice: {minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 4},
  choiceLabel: {fontSize: 16, fontWeight: '500'},
  choiceDetail: {fontSize: 12, lineHeight: 18},
  nameInput: {fontSize: 18, minHeight: 54, borderRadius: 15, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginTop: 14, marginBottom: 20},
  primary: {minHeight: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 8},
  primaryText: {fontSize: 15, fontWeight: '600'},
  provider: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 5},
  providerIcon: {width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center'},
  providerLetter: {fontSize: 28, fontWeight: '500'},
  providerName: {fontSize: 18, fontWeight: '600'},
  statusDot: {width: 7, height: 7, borderRadius: 4, marginRight: 10},
  connectionNote: {fontSize: 14, lineHeight: 23, marginVertical: 18, marginHorizontal: 5},
  textPreview: {padding: 20, borderRadius: 16, marginBottom: 16},
  about: {alignItems: 'center', paddingTop: 14, paddingBottom: 20, gap: 9},
  aboutBrand: {fontSize: 32, fontWeight: '700', letterSpacing: -1},
  aboutDescription: {fontSize: 14, textAlign: 'center', lineHeight: 24, marginTop: 14},
});
