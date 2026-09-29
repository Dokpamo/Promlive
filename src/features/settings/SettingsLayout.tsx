import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Platform, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceTypography} from '../../layout/metrics';
import {SettingsIcon} from './SettingsIcon';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary, SwipeBackModal, SwipeBackScrollContent, type SheetDrag} from '../../layout/SwipeBackModal';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {SheetScrollView} from '../../layout/SheetScrollView';
import {panelReference} from '../../layout/panelGeometry';
import {SettingsTextEditorHost} from './SettingsTextField';
import {useCollectionChrome} from '../../app/NavigationChrome';
import {SettingsMenuRow} from './SettingsMenuRow';
import {IconButton, TopBar, ui, useDesign} from '../../design/foundation';
import {MainTabHeader} from '../../app/MainTabHeader';

export {panelReference} from '../../layout/panelGeometry';
export {SettingsMenuRow, SettingsMenuRow as SettingsRow};

export function useSettingsScale() {
  return headerScale(useWindowDimensions().width);
}

export function useSettingsRadius(kind: 'panel' | 'control' = 'panel') {
  return (kind === 'panel' ? panelReference.radius : panelReference.controlRadius) * useSettingsScale();
}

export function SettingsPage({children, onBack, title, titleInHeader = true, home = false, obscured = false, embedded = false, active = true, headerRight}: {
  children: ReactNode;
  onBack: () => void;
  title?: string;
  titleInHeader?: boolean;
  home?: boolean;
  obscured?: boolean;
  embedded?: boolean;
  active?: boolean;
  headerRight?: ReactNode;
}) {
  const {s, color} = useDesign();
  const insets = useSafeAreaInsets();
  const chrome = useCollectionChrome();
  return <SettingsTextEditorHost><View style={{flex: 1}} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>
    <SafeAreaView testID={home ? 'settings-preview' : 'settings-detail'} edges={['left', 'right']} style={{flex: 1, backgroundColor: color.background}}>
      <View style={{paddingTop: insets.top, backgroundColor: color.background}}>
        {home && embedded ? <MainTabHeader testID="settings-header" titleTestID="settings-header-title" title={title ?? '설정'} right={headerRight}/> :
          <TopBar testID={home ? 'settings-header' : 'settings-detail-header'} titleTestID="settings-header-title" title={titleInHeader ? title ?? '설정' : ''} align="left"
            {...(!embedded ? {left: <IconButton testID={home ? 'settings-back' : 'settings-detail-back'} icon="back" label={home ? '설정 닫기' : '설정으로 돌아가기'} onPress={onBack}/>} : {})}/>}
      </View>
      <ScrollView testID={home ? 'settings-scroll' : 'settings-detail-scroll'} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never" alwaysBounceVertical={!home}
        scrollEnabled={active} contentContainerStyle={{width: '100%', maxWidth: panelReference.contentMaxWidth, alignSelf: 'center', paddingHorizontal: ui.inset * s, paddingTop: 14 * s, paddingBottom: (embedded ? chrome?.bottomInset ?? insets.bottom : insets.bottom) + 24 * s}}>
        <SwipeBackScrollContent>
          {title && !titleInHeader && <Text accessibilityRole="header" style={{color: color.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: '700', marginBottom: 24 * s}}>{title}</Text>}
          {children}
        </SwipeBackScrollContent>
      </ScrollView>
    </SafeAreaView>
  </View></SettingsTextEditorHost>;
}

export function SettingsSection({title, children, first = false}: {title: string; children: ReactNode; first?: boolean}) {
  const {s, color} = useDesign();
  return <View style={{marginHorizontal: -ui.inset * s, borderTopWidth: first ? 0 : .5, borderTopColor: color.line, paddingTop: 26 * s, paddingBottom: 18 * s, paddingHorizontal: ui.inset * s}}>
    <Text accessibilityRole="header" style={{color: color.muted, fontSize: 22 * s, lineHeight: 32 * s, fontWeight: '600', marginBottom: 20 * s}}>{title}</Text>
    {children}
  </View>;
}

export function SettingsGroup({children}: {children: ReactNode}) {
  const s = useSettingsScale();
  return <View testID="settings-group" style={{marginBottom: panelReference.groupGap * s}}>{children}</View>;
}

export function SettingsSheet({title, caption, onClose, children, footer, contentKey, fillHeight = false, slideFrom = 'bottom', dismiss = false, overlay, obscured = false, horizontalDrag, onBackRequest}: {
  title: string; caption?: string; onClose: () => void; children: (close: () => void) => ReactNode; fillHeight?: boolean;
  footer?: (close: () => void) => ReactNode; contentKey?: string | null;
  slideFrom?: 'bottom' | 'right'; dismiss?: boolean; overlay?: ReactNode; obscured?: boolean;
  horizontalDrag?: SheetDrag; onBackRequest?: () => boolean;
}) {
  const {settings: p} = useAppearance();
  const insets = useSafeAreaInsets();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  const {height: windowHeight} = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const scrollView = useRef<ScrollView>(null);
  const beginDismiss = () => {
    setClosing(true);
    // Moving a still-scrollable Android view under a new finger looks like a
    // vertical drag to ScrollView. Disable it before starting the native spring.
    if (Platform.OS !== 'web') scrollView.current?.setNativeProps({scrollEnabled: false});
  };
  const bottom = Math.max(insets.bottom, panelReference.sheetInset * s);
  const handleHeight = 58 * s;
  const maximumHeight = (windowHeight - bottom) * 0.85;
  // Choice lists fit their content; reading surfaces may reserve the full height.
  const fixedHeight = handleHeight + (footer ? footerHeight : 0);
  const height = fillHeight ? maximumHeight : Math.min(bodyHeight + fixedHeight, maximumHeight);
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false});
  scroll.current.horizontalGesture = !!horizontalDrag;
  scroll.current.maxOffset = Math.max(0, bodyHeight - (height - fixedHeight));
  scroll.current.canScroll = scroll.current.maxOffset > 1;
  useEffect(() => {
    if (contentKey === undefined) return;
    scrollView.current?.scrollTo({y: 0, animated: false});
    scroll.current.offset = 0;
    scroll.current.hasScrolled = false;
  }, [contentKey]);
  return <SwipeBackModal sheet sheetHeight={bodyHeight ? height + bottom : 0} slideFrom={slideFrom} dismiss={dismiss} active={!obscured} {...(onBackRequest ? {onBackRequest} : {})} onClose={onClose} onDismissStart={beginDismiss}>{(close, motionStyle) => <SettingsTextEditorHost><View pointerEvents={obscured ? 'none' : 'auto'} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'} style={{flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: panelReference.sheetInset * s, paddingBottom: bottom}}>
    <SwipeBackBoundary style={{position: 'absolute', inset: 0}}><Pressable accessibilityRole="button" accessibilityLabel="선택창 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <Animated.View testID="settings-sheet" accessibilityViewIsModal style={[{width: '100%', maxWidth: 560, height, borderRadius: radius, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
      <Pressable testID="settings-sheet-close" accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={close} style={{height: handleHeight, flexShrink: 0, alignItems: 'center', paddingTop: panelReference.sheetHandle.top * s}}><View style={{width: panelReference.sheetHandle.width * s, height: panelReference.sheetHandle.height * s, borderRadius: panelReference.sheetHandle.radius * s, backgroundColor: p.divider}}/></Pressable>
      <SheetScrollView ref={scrollView} sheetScroll={scroll} {...(horizontalDrag ? {horizontalDrag} : {})} scrollEnabled={!closing && !obscured} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={(_, measured) => setBodyHeight(old => Math.abs(old - measured) > 0.5 ? measured : old)} onScroll={event => {
        const offset = Math.max(0, event.nativeEvent.contentOffset.y);
        if (Math.abs(offset - scroll.current.offset) > 0.5) scroll.current.hasScrolled = true;
        scroll.current.offset = offset;
      }} scrollEventThrottle={16} contentContainerStyle={{paddingHorizontal: panelReference.sheetPadding * s, paddingTop: 15 * s, paddingBottom: panelReference.groupPadding * s}}>
        <SwipeBackScrollContent sheetScroll={scroll}>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
          {caption && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginTop: 20 * s}}>{caption}</Text>}
          <View style={{marginTop: panelReference.sheetContentGap * s}}>{children(close)}</View>
        </SwipeBackScrollContent>
      </SheetScrollView>
      {footer && <View testID="settings-sheet-footer" onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
        style={{flexShrink: 0, paddingHorizontal: panelReference.sheetPadding * s, paddingBottom: panelReference.groupPadding * s, paddingTop: 12 * s}}>{footer(close)}</View>}
    </Animated.View>
  </View>{overlay}</SettingsTextEditorHost>}</SwipeBackModal>;
}

export function SettingsChoice({label, detail, selected, onPress}: {label: string; detail?: string; selected: boolean; onPress: () => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <RowPressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected}} aria-checked={selected} selected={selected} selectedHighlight="pressed" onPress={onPress} radius={radius} highlightInset={panelReference.highlightInset * s} style={{marginHorizontal: -panelReference.sheetPadding * s}} contentStyle={{minHeight: panelReference.rowHeight * s, paddingHorizontal: panelReference.rowInset * s, paddingVertical: panelReference.rowPadding * s, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
    <View style={{flex: 1, gap: 5 * s}}>
      <Text style={{color: selected ? p.accent : p.text, fontSize: panelReference.rowFont * s, lineHeight: panelReference.rowLine * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{label}</Text>
      {detail && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{detail}</Text>}
    </View>
    <View style={{width: 34 * s, alignItems: 'center'}}>{selected && <SettingsIcon name="check" size={32 * s} color={p.accent}/>}</View>
  </RowPressable>;
}

export function SettingsNote({children, inset = 6}: {children: ReactNode; inset?: number}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginLeft: inset * s, marginRight: 6 * s, marginTop: 24 * s}}>{children}</Text>;
}

export function SettingsSave({onPress, disabled = false}: {onPress: () => void; disabled?: boolean}) {
  return <SettingsMenuRow icon="check" label="적용" onPress={onPress} disabled={disabled}/>;
}
