import {useEffect, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Pressable, StatusBar, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {initialize} from './src/app/runtime';
import {Workspace} from './src/app/workspace';
import {ChatScreen} from './src/features/chat/ChatScreen';
import {ChatDrawer} from './src/features/chat/ChatDrawer';
import {ChatIcon} from './src/features/chat/ChatIcon';
import {chatColors as c, composerScale} from './src/features/chat/chatAppearance';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void initialize().then(async runtime => {
      const next = new Workspace(runtime);
      await next.readyChat();
      if (active) setWorkspace(next);
    }).catch(e => {if (active) setError(e instanceof Error ? e.message : '저장소를 열지 못했어요.');});
    return () => {active = false;};
  }, []);
  return <SafeAreaProvider style={{flex: 1}}>
    <StatusBar barStyle="light-content"/>
    <View style={{flex: 1, backgroundColor: c.background}}>
      {workspace ? <ChatApp workspace={workspace}/> : <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32}}>{error ? <Text style={{color: c.text, fontSize: 15, lineHeight: 24}}>{error}</Text> : <ActivityIndicator color={c.muted}/>}</View>}
    </View>
  </SafeAreaProvider>;
}

function ChatApp({workspace: w}: {workspace: Workspace}) {
  useSyncExternalStore(w.subscribe, w.snapshot);
  const {width} = useWindowDimensions();
  const s = composerScale(width);
  useEffect(() => {
    if (!w.notice) return;
    const timer = setTimeout(() => {w.notice = null; w.emit();}, 3500);
    return () => clearTimeout(timer);
  }, [w, w.notice]);
  return <ChatDrawer workspace={w}>{openHistory => <SafeAreaView edges={['top', 'left', 'right']} style={{flex: 1, backgroundColor: c.background}}>
    <View style={{height: 96 * s, paddingHorizontal: 28 * s, paddingTop: 1 * s}}>
      <Pressable accessibilityRole="button" accessibilityLabel="채팅 내역 열기" onPress={openHistory} style={({pressed}) => ({width: 76 * s, height: 76 * s, borderRadius: 38 * s, borderWidth: 1 * s, borderColor: '#3D3D3D', backgroundColor: pressed ? '#353535' : '#262626', alignItems: 'center', justifyContent: 'center'})}>
        <ChatIcon name="menu" size={30 * s}/>
      </Pressable>
    </View>
    <ChatScreen key={w.conversation?.id ?? 'new'} workspace={w} width={width}/>
    {(w.notice || w.error) && <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={() => w.clearMessage()} style={{position: 'absolute', top: 100 * s, alignSelf: 'center', maxWidth: '88%', paddingVertical: 12, paddingHorizontal: 18, backgroundColor: '#353535', borderRadius: 14, borderWidth: 1, borderColor: '#484848'}}><Text style={{fontSize: 13, lineHeight: 20, color: w.error ? '#FFB9B9' : c.text}}>{w.error ?? w.notice}</Text></Pressable>}
  </SafeAreaView>}</ChatDrawer>;
}
