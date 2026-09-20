import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, TextInput, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {ChatIcon} from './ChatIcon';
import {composerScale, headerScale, referenceComposer as r, referenceHeader, typographyScale} from './chatAppearance';
import {panelSpring} from './usePanelMotion';
import {DragClickBoundary} from '../settings/DragClickBoundary';
import {useComposerPull} from './useComposerPull';

export interface ComposerFrame {x: number; y: number; width: number; height: number; radius: number}

interface Props {
  origin: ComposerFrame;
  measureOrigin: (done: (frame: ComposerFrame) => void) => void;
  sourceInputHeight: number;
  sourceExpandable: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClose: () => void;
  ready: boolean;
  sending: boolean;
  generating: boolean;
  reduceMotion: boolean;
}

/** One surface grows from the composer bounds and returns to its current bounds. */
export function ExpandedComposer(p: Props) {
  const {colors: c, isDark} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = composerScale(window.width);
  const textScale = typographyScale(window.width);
  const progress = useRef(new Animated.Value(0)).current;
  const input = useRef<TextInput>(null);
  const [frame, setFrame] = useState(p.origin);
  const [viewport, setViewport] = useState({width: window.width, height: window.height});
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const mounted = useRef(true);
  const stopWaiting = useRef<(() => void) | null>(null);
  const entered = useRef(false);
  const opening = useRef(true);
  const callbacks = useRef(p);
  callbacks.current = p;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopWaiting.current?.();
      progress.stopAnimation();
    };
  }, [progress]);

  useEffect(() => {
    if (!shown || entered.current) return;
    entered.current = true;
    if (p.reduceMotion) {progress.setValue(1); opening.current = false;}
    else Animated.spring(progress, {...panelSpring, toValue: 1, useNativeDriver: false}).start(({finished}) => {if (finished) opening.current = false;});
    input.current?.focus();
  }, [p.reduceMotion, progress, shown]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const collapse = () => {
      stopWaiting.current?.();
      stopWaiting.current = null;
      // Keyboard dismissal changes the original composer's position and safe-area padding.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!mounted.current) return;
        callbacks.current.measureOrigin(next => {
          if (!mounted.current) return;
          setFrame(next);
          requestAnimationFrame(() => {
            if (!mounted.current) return;
            if (callbacks.current.reduceMotion) {progress.setValue(0); callbacks.current.onClose();}
            else Animated.spring(progress, {...panelSpring, toValue: 0, useNativeDriver: false}).start(({finished}) => {if (finished) callbacks.current.onClose();});
          });
        });
      }));
    };
    if (Platform.OS !== 'web' && Keyboard.isVisible()) {
      let finished = false;
      const finish = () => {if (!finished) {finished = true; collapse();}};
      const listener = Keyboard.addListener('keyboardDidHide', finish);
      const timer = setTimeout(finish, 350);
      stopWaiting.current = () => {listener.remove(); clearTimeout(timer);};
      Keyboard.dismiss();
    } else collapse();
  }, [progress]);

  const pull = useComposerPull(progress, {travel: frame.y, opening, closing: closingRef, reduceMotion: p.reduceMotion, close});
  const tween = (from: number, to: number) => progress.interpolate({inputRange: [0, 1], outputRange: [from, to]});
  const inputTop = insets.top + referenceHeader.barHeight * headerScale(window.width) + 16 * s;
  const filled = p.value.length > 0;
  const canSend = p.ready && !p.sending && (!!p.value.trim() || p.generating);
  const ghostOpacity = progress.interpolate({inputRange: [0, 0.25, 1], outputRange: [1, 0, 0], extrapolate: 'clamp'});
  const controlsOpacity = progress.interpolate({inputRange: [0, 0.45, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});

  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true);}} onRequestClose={close}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
    <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
      <View testID="expanded-composer-root" style={{flex: 1}} {...pull.panHandlers} onLayout={event => {
        const {width, height} = event.nativeEvent.layout;
        setViewport(old => old.width === width && old.height === height ? old : {width, height});
      }}>
        <Animated.View testID="expanded-composer-surface" accessibilityViewIsModal onAccessibilityEscape={close} style={{
          position: 'absolute', left: tween(frame.x, 0), top: tween(frame.y, 0), width: tween(frame.width, viewport.width), height: tween(frame.height, viewport.height),
          borderRadius: tween(frame.radius, 0), borderWidth: tween(s, 0), borderColor: c.border, backgroundColor: c.composer, overflow: 'hidden',
          boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)',
        }}>
          <Animated.View onStartShouldSetResponderCapture={pull.blockInput} style={{position: 'absolute', left: tween((filled ? 26 : 116) * s, 26 * s), right: 26 * s, top: tween(filled ? 25 * s : (r.compactHeight * s - r.lineHeight * textScale * window.fontScale) / 2, inputTop), height: tween(p.sourceInputHeight, Math.max(60, viewport.height - inputTop - insets.bottom - 20 * s)), overflow: 'hidden'}}>
            <TextInput ref={input} testID="expanded-composer-input" accessibilityLabel="확장 메시지 입력" multiline scrollEnabled value={p.value} onChangeText={p.onChange} editable={p.ready && !closing} maxLength={8000} placeholder="무엇이든 물어보세요." placeholderTextColor={c.placeholder} selectionColor="#3096EB" underlineColorAndroid="transparent" textAlignVertical="top" style={{flex: 1, color: c.text, fontSize: r.fontSize * textScale, lineHeight: r.lineHeight * textScale, padding: 0, margin: 0, includeFontPadding: false}}/>
          </Animated.View>
          <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', left: (filled ? 12 : 20) * s, right: (filled ? 13 : 20) * s, bottom: (filled ? 14 : (r.compactHeight - r.button) / 2) * s, flexDirection: 'row', alignItems: 'center', opacity: ghostOpacity}}>
            <GhostAction icon="plus" scale={s}/><View style={{flex: 1}}/>{p.sourceExpandable && <GhostAction icon="expand" scale={s}/>}{(!!p.value.trim() || p.generating) && <><View style={{width: p.sourceExpandable ? 13 * s : 0}}/><GhostAction icon="send" scale={s} bright/></>}
          </Animated.View>
          <Animated.View pointerEvents={closing ? 'none' : 'auto'} style={{position: 'absolute', top: insets.top, left: 0, right: 0, opacity: controlsOpacity}}>
            <ScreenHeader width={viewport.width} testID="expanded-composer-header">
              <HeaderButton width={viewport.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={close} leading/>
              <View style={{flex: 1}}/>
              <HeaderButton width={viewport.width} testID="expanded-composer-send" icon={p.generating ? 'stop' : 'send'} label={p.generating ? '응답 중단' : '메시지 보내기'} bright disabled={!canSend} onPress={() => {if (p.generating) p.onCancel(); else {p.onSend(); close();}}}/>
            </ScreenHeader>
          </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
    </DragClickBoundary>
  </Modal>;
}

function GhostAction({icon, scale: s, bright = false}: {icon: 'plus' | 'expand' | 'send'; scale: number; bright?: boolean}) {
  const {colors: c} = useAppearance();
  return <View style={{width: r.button * s, height: r.button * s, borderRadius: r.button * s / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bright ? c.send : c.button}}><ChatIcon name={icon} size={(icon === 'plus' ? 27 : 25) * s} color={bright ? c.sendIcon : c.buttonIcon}/></View>;
}
