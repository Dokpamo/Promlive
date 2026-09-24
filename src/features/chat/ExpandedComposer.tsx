import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, BackHandler, Platform, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {DragClickBoundary} from '../../layout/DragClickBoundary';
import {SheetGestureRoot} from '../../layout/SheetGestureRoot';
import {SheetScrollView} from '../../layout/SheetScrollView';
import {useBlankDismiss} from '../../layout/useBlankDismiss';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {panelReference} from '../../layout/panelGeometry';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {useAppearance} from '../appearance/AppAppearance';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle, ComposerSelection} from './ComposerInput.types';
import type {ComposerAction} from './ChatSession';
import {composerScale, referenceComposer as r, typographyScale} from './chatAppearance';
import {composerEditorHeight, expandedComposerFrame} from './composerGeometry';

interface Props {
  value: string; onChange: (value: string) => void; onSend: () => void; onCancel: () => void;
  ready: boolean; action: ComposerAction; width: number; textWidth: number; initialHeight: number;
  initialSelection: ComposerSelection; onReturnFocus: (selection: ComposerSelection, keepKeyboard: boolean) => void; onClose: () => void;
}

/** A finished full-screen layout slides above the dock without resizing either editor. */
export function ExpandedComposer(p: Props) {
  const {settings} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  const s = composerScale(p.width), textScale = typographyScale(p.width), headerSize = headerScale(p.width);
  const sheet = expandedComposerFrame(window);
  const input = useRef<ComposerInputHandle>(null);
  const [keyboardStarted, setKeyboardStarted] = useState(keyboard.height > 0);
  const [exiting, setExiting] = useState(false);
  const exitStarted = useRef(false);
  const initialSelection = useRef(p.initialSelection);
  const [contentHeight, setContentHeight] = useState(p.initialHeight);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const pull = useBlankDismiss({active: true, height: sheet.height, entrance: keyboardStarted ? 'ready' : 'waiting', onClose: p.onClose, onDismissStart: () => {
    exitStarted.current = true;
    setExiting(true);
    // Transfer focus before unmounting so the IME never loses its served input.
    p.onReturnFocus(input.current?.getSelection() ?? initialSelection.current, Platform.OS === 'web' || keyboard.height > 0);
  }});
  useEffect(() => {
    let cancelled = false;
    input.current?.setSelection(initialSelection.current);
    input.current?.focusForExpansion(() => {if (!cancelled && !exitStarted.current) setKeyboardStarted(true);});
    return () => {cancelled = true;};
  }, []);
  useEffect(() => {
    if (Platform.OS === 'android') {
      const back = BackHandler.addEventListener('hardwareBackPress', () => {pull.dismiss(); return true;});
      return () => back.remove();
    }
    if (Platform.OS !== 'web') return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); pull.dismiss();}
      if (event.key !== 'Tab') return;
      const controls = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="expanded-composer-surface"] textarea, [data-testid="expanded-composer-surface"] [role="button"][tabindex="0"]'))
        .filter(node => node.getAttribute('aria-disabled') !== 'true');
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
        event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus({preventScroll: true});
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [pull.dismiss]);
  const fixedFraction = useRef(new Animated.Value(0)).current.interpolate({inputRange: [0, 1], outputRange: [0, 0]});
  const footerFraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  const line = r.lineHeight * textScale * window.fontScale;
  const measured = p.value ? Math.max(line, contentHeight) : line;
  const inputTop = insets.top + referenceHeader.barHeight * headerSize + 16 * s;
  const footerHeight = Math.max(0, insets.bottom - keyboard.height) + panelReference.sheetInset * s + referenceHeader.height * headerSize + 16 * s;
  const editorHeight = composerEditorHeight(sheet, inputTop, measured, line, footerHeight, window.height - keyboard.height);
  const scrollable = measured + inputTop + footerHeight > editorHeight + 1;
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false, maxOffset: 0});
  scroll.current.canScroll = scrollable;
  scroll.current.maxOffset = Math.max(0, measured + inputTop + footerHeight - editorHeight);
  const canScrollInput = useCallback(() => {
    const selection = input.current?.getSelection();
    return !selection || selection.start === selection.end;
  }, []);
  const cancelling = p.action.kind === 'cancel';

  return <KeyboardDock fraction={fixedFraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={!exiting}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
      <Animated.View testID="expanded-composer-surface" accessibilityViewIsModal onAccessibilityEscape={pull.dismiss} pointerEvents={exiting ? 'none' : 'auto'}
        style={{position: 'absolute', inset: 0, backgroundColor: settings.sheet, overflow: 'hidden', transform: [{translateY: pull.y}]}}>
        <SheetGestureRoot><View style={{flex: 1}} {...pull.panHandlers}>
          <View testID="expanded-composer-scroll-viewport" onStartShouldSetResponderCapture={() => scrollable ? pull.block() : false}
            style={{position: 'absolute', left: (sheet.width - p.textWidth) / 2, width: p.textWidth, top: 0, height: editorHeight, overflow: 'hidden'}}>
            <SheetScrollView testID="expanded-composer-scroll" nativeID="promlive-composer-scroll" sheetScroll={scroll} sheetDrag={null} canStartInputScroll={canScrollInput} scrollEnabled={scrollable}
              bounces={false} overScrollMode="never" keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets={false}
              showsVerticalScrollIndicator={false} scrollEventThrottle={16} style={{flex: 1}} onScroll={event => {
                const state = scroll.current, offset = event.nativeEvent.contentOffset.y;
                if (Math.abs(state.offset - offset) > 1) state.hasScrolled = true;
                state.offset = offset;
              }}>
              <View pointerEvents="none" style={{height: inputTop}}/>
              <View onStartShouldSetResponderCapture={pull.block} style={{height: measured}}>
                <ComposerInput focusRef={input} testID="expanded-composer-input" label="확장 메시지 입력" value={p.value} onChange={p.onChange} onFocus={() => {}}
                  onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={measured} fillHeight scroll={false} ready={p.ready}/>
              </View>
              <View pointerEvents="none" style={{height: footerHeight}}/>
            </SheetScrollView>
          </View>
          <View onStartShouldSetResponderCapture={pull.block} pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: insets.left, right: insets.right}}>
            <ScreenHeader width={p.width} testID="expanded-composer-header" edgeTint={false}>
              <View style={{flex: 1}} pointerEvents="none"/>
              <HeaderButton width={p.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={pull.dismiss}/>
            </ScreenHeader>
          </View>
          <KeyboardDock fraction={footerFraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={false}>
            <View testID="expanded-composer-footer" onStartShouldSetResponderCapture={pull.block} pointerEvents="box-none" style={{position: 'absolute', right: insets.right + referenceHeader.inset * headerSize, bottom: insets.bottom + panelReference.sheetInset * s}}>
              <HeaderButton width={p.width} testID="expanded-composer-send" icon={cancelling ? 'stop' : 'send'} label={p.action.label} bright disabled={!p.action.enabled}
                onPress={() => {if (cancelling) p.onCancel(); else {p.onSend(); pull.dismiss();}}}/>
            </View>
          </KeyboardDock>
        </View></SheetGestureRoot>
      </Animated.View>
    </DragClickBoundary>
  </KeyboardDock>;
}
