import {useEffect, useState, useSyncExternalStore} from 'react';
import {View, Text, Pressable, ScrollView, Modal, useWindowDimensions, ActivityIndicator, Platform, StatusBar} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {initialize} from './src/app/runtime';
import {Workspace} from './src/app/workspace';
import {LibraryScreen} from './src/features/cards/LibraryScreen';
import {EditorScreen} from './src/features/cards/EditorScreen';
import {ChatScreen} from './src/features/chat/ChatScreen';
import {SettingsScreen} from './src/app/SettingsScreen';
import {Button, Empty, Icon} from './src/layout/components';
import {colors, styles} from './src/layout/theme';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null); const [error, setError] = useState('');
  useEffect(() => {void initialize().then(async runtime => {const w = new Workspace(runtime); await w.ready(); setWorkspace(w);}).catch(e => setError(e instanceof Error ? e.message : '작업실을 열지 못했어요.'));}, []);
  return <SafeAreaProvider style={{flex: 1}}><StatusBar barStyle="dark-content"/><SafeAreaView style={{flex: 1, backgroundColor: colors.bg}}>{workspace ? <WorkspaceApp workspace={workspace}/> : <View style={{flex: 1, justifyContent: 'center'}}>{error ? <Empty title="저장소를 확인해 주세요">{error}</Empty> : <View style={{alignItems: 'center', gap: 18}}><ActivityIndicator color={colors.accent}/><Text style={styles.small}>이야기 작업실을 열고 있어요…</Text></View>}</View>}</SafeAreaView></SafeAreaProvider>;
}
function WorkspaceApp({workspace: w}: {workspace: Workspace}) {
  useSyncExternalStore(w.subscribe, w.snapshot);
  const {width, fontScale} = useWindowDimensions(); const desktop = width / fontScale >= 870;
  const [creating, setCreating] = useState(false); const [menu, setMenu] = useState(false);
  const contentWidth = (desktop ? width - 226 : width) / fontScale;
  const run = (p: Promise<unknown>) => void p.catch(e => w.report(e));
  const title = w.page === 'library' ? w.filter === 'all' ? '내 서재' : w.filter === 'favorites' ? '아끼는 이야기' : '보관함' : w.page === 'editor' ? w.editor?.card.title ?? '이야기 편집' : w.page === 'chat' ? '이야기 나누기' : '설정';
  useEffect(() => {
    if (!w.notice) return;
    const timer = setTimeout(() => {w.notice = null; w.emit();}, 3500); return () => clearTimeout(timer);
  }, [w, w.notice]);
  return <View style={{flex: 1, flexDirection: 'row'}}>
    {desktop && <Sidebar workspace={w} onCreate={() => setCreating(true)}/>}
    <View style={{flex: 1, minWidth: 0}}>
      <View style={[styles.row, {height: 69, paddingHorizontal: desktop ? 37 : 18, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: '#FDFCF9', gap: 12}]}>
        {!desktop && <Pressable accessibilityRole="button" accessibilityLabel="메뉴 열기" onPress={() => setMenu(true)} style={{padding: 7}}><Icon name="☰" color={colors.ink}/></Pressable>}
        {w.page === 'editor' ? <><Pressable accessibilityRole="button" accessibilityLabel="서재로 돌아가기" onPress={() => run(w.go('library'))}><Text style={styles.small}>내 서재</Text></Pressable><Text style={{color: colors.faint, fontSize: 16}}>›</Text></> : <Icon name={w.page === 'library' ? 'library' : w.page === 'chat' ? 'chat' : 'settings'} size={17} color={colors.ink}/>}
        <Text numberOfLines={1} style={{fontSize: 13, color: colors.ink, fontWeight: '500', flex: 1}}>{title}</Text>
        <View style={[styles.row, {gap: 6}]}><View style={{width: 5, height: 5, borderRadius: 3, backgroundColor: '#8C9B7B'}}/><Text style={{fontSize: 10, color: colors.muted}}>로컬 작업실</Text></View>
        {desktop && <View style={{height: 24, width: 1, backgroundColor: colors.line, marginHorizontal: 5}}/>}
        {desktop && <Text style={{fontSize: 10, letterSpacing: 1.2, color: colors.faint}}>MAKE ROOM FOR IMAGINATION</Text>}
      </View>
      {w.error && <Pressable accessibilityRole="button" accessibilityLabel="오류 안내 닫기" onPress={() => w.clearMessage()} style={{backgroundColor: '#F8E9E4', padding: 14, flexDirection: 'row', gap: 10}}><Text style={{fontSize: 12, lineHeight: 20, color: colors.danger, flex: 1}}>{w.error}</Text><Icon name="close" color={colors.danger}/></Pressable>}
      {w.page === 'library' && <LibraryScreen workspace={w} width={contentWidth} onCreate={() => setCreating(true)}/>}
      {w.page === 'editor' && w.editor && <EditorScreen key={w.editor.card.id} workspace={w} width={contentWidth}/>}
      {w.page === 'chat' && <ChatScreen key={w.conversation?.id ?? 'empty'} workspace={w} width={contentWidth}/>}
      {w.page === 'settings' && <SettingsScreen workspace={w}/>}
      {w.notice && <View pointerEvents="none" style={{position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: '#3D393F', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 9}}><Text style={{color: '#FFF', fontSize: 12}}>✓ {w.notice}</Text></View>}
    </View>
    <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#24212666'}}><View style={{backgroundColor: colors.bg, padding: 30, width: '100%', maxWidth: 500, borderRadius: 18, gap: 21}}>
        <View style={[styles.row, {justifyContent: 'space-between'}]}><Text style={styles.heading}>어떻게 시작할까요?</Text><Button small variant="ghost" onPress={() => setCreating(false)}>닫기 ×</Button></View><Text style={styles.small}>빈 페이지에서 시작해도, 작은 설정 하나면 충분해요.</Text>
        <Button icon="world" onPress={() => {setCreating(false); run(w.create('template'));}}>템플릿으로 이야기 만들기</Button><Button variant="secondary" icon="code" onPress={() => {setCreating(false); run(w.create('code'));}}>HTML · CSS · JavaScript로 만들기</Button><Text style={[styles.small, {fontSize: 11}]}>두 방식 모두 같은 서재에 저장됩니다. 나중에도 자유롭게 수정할 수 있어요.</Text>
      </View></View>
    </Modal>
    <Modal visible={menu && !desktop} transparent animationType="fade" onRequestClose={() => setMenu(false)}><View style={{flex: 1, flexDirection: 'row', backgroundColor: '#24212666'}}><Sidebar workspace={w} onCreate={() => {setMenu(false); setCreating(true);}} onNavigate={() => setMenu(false)}/><Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={() => setMenu(false)} style={{flex: 1}}/></View></Modal>
  </View>;
}
function Sidebar({workspace: w, onCreate, onNavigate}: {workspace: Workspace; onCreate: () => void; onNavigate?: () => void}) {
  const run = (p: Promise<unknown>) => {onNavigate?.(); void p.catch(e => w.report(e));};
  const chooseFilter = (filter: 'all' | 'favorites' | 'archived') => {run(w.flush().then(() => w.setFilter(filter)));};
  return <View style={{width: 226, backgroundColor: colors.side, borderRightWidth: 1, borderColor: colors.line, paddingTop: Platform.OS === 'ios' ? 8 : 0}}>
    <View style={{paddingTop: 36, paddingHorizontal: 25, paddingBottom: 29, gap: 9}}><View style={[styles.row, {gap: 11}]}><View style={{height: 34, width: 31, borderRadius: 11, backgroundColor: '#DCD4E3', justifyContent: 'center', alignItems: 'center'}}><Text style={{fontSize: 21, color: '#8C749D'}}>❧</Text></View><Text style={{fontSize: 27, fontWeight: '500', letterSpacing: 4, color: '#4E4355'}}>여백</Text></View><Text style={{fontSize: 10, color: '#A49B91', letterSpacing: 0.4}}>당신의 이야기가 머무는 곳</Text></View>
    <View style={{paddingHorizontal: 19, marginBottom: 27}}><Button icon="plus" onPress={onCreate}>새 이야기</Button></View>
    <View style={{paddingHorizontal: 13, gap: 5}}>
      <Nav icon="library" label="내 서재" active={w.page !== 'settings' && w.page !== 'chat' && w.filter === 'all'} count={w.cards.filter(c => !c.archived).length} onPress={() => chooseFilter('all')}/>
      <Nav icon="chat" label="나눈 대화" active={w.page === 'chat'} onPress={() => run(w.go('chat'))}/>
      <Nav icon="star" label="아끼는 이야기" active={w.page === 'library' && w.filter === 'favorites'} onPress={() => chooseFilter('favorites')}/>
      <Nav icon="archive" label="보관함" active={w.page === 'library' && w.filter === 'archived'} onPress={() => chooseFilter('archived')}/>
    </View>
    <View style={{height: 1, backgroundColor: colors.line, marginHorizontal: 23, marginVertical: 25}}/>
    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 24, gap: 16}}>
      <Text style={{fontSize: 10, letterSpacing: 1.5, color: '#ADA59A'}}>최근 나눈 이야기</Text>
      {w.conversations.length === 0 ? <Text style={{fontSize: 11, lineHeight: 20, color: '#AAA297'}}>아직 펼치지 않은 대화들.{ '\n'}인물에게 첫인사를 건네 보세요.</Text> : w.conversations.slice(0, 8).map(c => <Pressable accessibilityRole="button" key={c.id} onPress={() => run(w.openConversation(c))} style={[styles.row, {gap: 8}]}><Icon name="chat" size={16}/><Text numberOfLines={1} style={{fontSize: 11, color: colors.muted, flex: 1}}>{c.title}</Text></Pressable>)}
    </ScrollView>
    <View style={{margin: 19, padding: 16, backgroundColor: '#E8E7DF', borderRadius: 10, gap: 8}}><Icon name="leaf" size={23} color="#9B9E8A"/><Text style={{fontSize: 11, lineHeight: 20, color: '#8D8B7C'}}>서두르지 않아도 괜찮아요.{ '\n'}좋은 이야기는 여백에서 시작돼요.</Text></View>
    <View style={{borderTopWidth: 1, borderColor: colors.line, padding: 15}}><Nav icon="settings" label="설정" active={w.page === 'settings'} onPress={() => run(w.go('settings'))}/></View>
  </View>;
}
function Nav({icon, label, active, count, onPress}: {icon: string; label: string; active: boolean; count?: number; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected: active}} onPress={onPress} style={({pressed}) => [styles.row, {gap: 12, minHeight: 42, borderRadius: 7, paddingHorizontal: 12, backgroundColor: active ? '#E5DEEB' : pressed ? '#EAE7E0' : 'transparent'}]}><Icon name={icon} size={20} color={active ? colors.accent : '#9A9388'}/><Text style={{fontSize: 12, fontWeight: active ? '600' : '400', color: active ? colors.accent : '#898276', flex: 1}}>{label}</Text>{count !== undefined && <Text style={{fontSize: 10, color: active ? colors.accent : colors.muted}}>{count}</Text>}</Pressable>;
}
