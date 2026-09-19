import {useCallback, useState} from 'react';
import {Pressable, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';
import {composerScale, referenceComposer as r} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {SwipeBackBoundary, SwipeBackModal} from '../settings/SwipeBackModal';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onHint: (message: string) => void;
  width: number;
  bottom: number;
  ready: boolean;
  sending: boolean;
  generating: boolean;
}

export function ChatComposer(p: Props) {
  const {colors: c, isDark} = useAppearance();
  const {fontScale} = useWindowDimensions();
  const s = composerScale(p.width);
  const line = r.lineHeight * s * fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [expanded, setExpanded] = useState(false);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const filled = p.value.length > 0;
  const measured = Math.max(line, contentHeight);
  const maxHeight = r.maxHeight * s + Math.max(0, fontScale - 1) * line * 2;
  const height = filled ? Math.min(maxHeight, r.firstLineHeight * s + measured - line) : r.compactHeight * s;
  const inputHeight = filled ? Math.max(line, height - (r.firstLineHeight - r.lineHeight) * s) : line;
  const overflowing = filled && measured > inputHeight + 1;
  const expandable = filled && height >= maxHeight - 1;
  const button = r.button * s;
  const actionBottom = filled ? 14 * s : (height - button) / 2;
  return <>
    <DrawerGestureBoundary><View style={{width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: r.inset * s, paddingBottom: p.bottom + r.bottom * s}}>
      <View testID="chat-composer" style={{height, borderRadius: (filled ? 40 : r.compactHeight / 2) * s, backgroundColor: c.composer, borderWidth: 1 * s, borderColor: c.border, boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)'}}>
        <View style={{position: 'absolute', top: filled ? 25 * s : (height - line) / 2, left: (filled ? 26 : 116) * s, right: (filled ? expandable ? 76 : 26 : 116) * s}}>
          <ComposerInput value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * s} lineHeight={r.lineHeight * s} height={inputHeight} scroll={overflowing} ready={p.ready}/>
        </View>
        {expandable && <Pressable accessibilityRole="button" accessibilityLabel="입력창 크게 열기" hitSlop={8} onPress={() => setExpanded(true)} style={{position: 'absolute', top: 24 * s, right: 29 * s, padding: 3 * s}}><ChatIcon name="expand" size={25 * s} color="#707070"/></Pressable>}
        <View style={{position: 'absolute', left: (filled ? 12 : 20) * s, bottom: actionBottom}}>
          <Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/>
        </View>
        <View style={{position: 'absolute', right: (filled ? 13 : 20) * s, bottom: actionBottom, flexDirection: 'row', gap: 13 * s}}>
          <Circle label="음성 입력" icon="voice" size={button} iconSize={30 * s} onPress={() => p.onHint('음성 입력은 아직 연결하지 않았어요.')}/>
          {(filled || p.generating) && <Circle label={p.generating ? '응답 중단' : '메시지 보내기'} icon={p.generating ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={p.sending || !p.ready || (!p.generating && !p.value.trim())} onPress={p.generating ? p.onCancel : p.onSend}/>}
        </View>
      </View>
    </View></DrawerGestureBoundary>
    {expanded && <SwipeBackModal onClose={() => setExpanded(false)}>{close =>
      <SafeAreaView style={{flex: 1, backgroundColor: c.background, paddingHorizontal: 24}}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18}}><Text style={{color: c.text, fontSize: 17}}>메시지 작성</Text><Pressable accessibilityRole="button" accessibilityLabel="입력창 접기" hitSlop={12} onPress={close}><ChatIcon name="close"/></Pressable></View>
        <SwipeBackBoundary style={{flex: 1}}><TextInput accessibilityLabel="확장 메시지 입력" autoFocus multiline value={p.value} onChangeText={p.onChange} maxLength={8000} placeholder="무엇이든 물어보세요." placeholderTextColor={c.placeholder} textAlignVertical="top" style={{flex: 1, color: c.text, fontSize: 18, lineHeight: 28, paddingVertical: 20}}/></SwipeBackBoundary>
        <Pressable accessibilityRole="button" onPress={close} style={{alignSelf: 'flex-end', backgroundColor: c.button, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, marginBottom: 16}}><Text style={{color: c.text, fontSize: 15}}>완료</Text></Pressable>
      </SafeAreaView>
    }</SwipeBackModal>}
  </>;
}

function Circle({label, icon, size, iconSize, onPress, bright = false, disabled = false}: {label: string; icon: ChatIconName; size: number; iconSize: number; onPress: () => void; bright?: boolean; disabled?: boolean}) {
  const {colors: c} = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => ({width: size, height: size, borderRadius: size / 2, backgroundColor: bright ? c.send : c.button, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.7 : 1})}><ChatIcon name={icon} size={iconSize} color={bright ? c.sendIcon : c.buttonIcon}/></Pressable>;
}
