import {useRef, useState, type ReactNode} from 'react';
import {Animated, Platform, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {PressSurface} from '../../layout/PressSurface';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {SettingsIcon} from './SettingsIcon';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary, SwipeBackModal, SwipeBackScrollContent} from '../../layout/SwipeBackModal';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {panelReference} from '../../layout/panelGeometry';
import {SettingsTextEditorHost} from './SettingsTextField';

export {panelReference} from '../../layout/panelGeometry';

export function useSettingsScale() {
  return headerScale(useWindowDimensions().width);
}

export function useSettingsRadius(kind: 'panel' | 'control' = 'panel') {
  return (kind === 'panel' ? panelReference.radius : panelReference.controlRadius) * useSettingsScale();
}

export function SettingsPage({children, onBack, title, titleInHeader = false, home = false, obscured = false}: {
  children: ReactNode;
  onBack: () => void;
  title?: string;
  titleInHeader?: boolean;
  home?: boolean;
  obscured?: boolean;
}) {
  const {settings: p} = useAppearance();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const insets = useSafeAreaInsets();
  return <SettingsTextEditorHost><View style={{flex: 1}} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}><SafeAreaView testID={home ? 'settings-preview' : 'settings-detail'} edges={['left', 'right']} style={{flex: 1, backgroundColor: p.background}}>
    <ScrollView testID={home ? 'settings-scroll' : 'settings-detail-scroll'} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" contentContainerStyle={{width: '100%', maxWidth: panelReference.contentMaxWidth, alignSelf: 'center', paddingHorizontal: panelReference.inset * s, paddingTop: insets.top + referenceHeader.barHeight * s + panelReference.top * s, paddingBottom: insets.bottom + 36 * s}}>
      <SwipeBackScrollContent>
        {title && !titleInHeader && <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, marginHorizontal: 6 * s, marginBottom: 24 * s, includeFontPadding: false}}>{title}</Text>}
        {children}
      </SwipeBackScrollContent>
    </ScrollView>
    <View pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: 0, right: 0}}>
      <ScreenHeader width={width} topInset={insets.top} surfaceColor={p.background} testID={home ? 'settings-header' : 'settings-detail-header'}>
        <HeaderButton width={width} testID={home ? 'settings-back' : 'settings-detail-back'} icon="back" label={home ? '설정 닫기' : '설정으로 돌아가기'} onPress={onBack}/>
        {titleInHeader && title && <>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>
            <Text testID="settings-header-title" accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceHeader.titleFont * s, lineHeight: referenceTypography.titleLineHeight * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
          </View>
          <View pointerEvents="none" style={{width: referenceHeader.height * s}}/>
        </>}
      </ScreenHeader>
    </View>
  </SafeAreaView></View></SettingsTextEditorHost>;
}

export function SettingsGroup({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  return <View testID="settings-group" style={{backgroundColor: p.surface, borderRadius: radius, paddingVertical: panelReference.groupPadding * s, marginBottom: panelReference.groupGap * s, overflow: 'hidden'}}>{children}</View>;
}

export function SettingsRow({label, value, onPress, plain = false, muted = false}: {label: string; value?: string; onPress: () => void; plain?: boolean; muted?: boolean}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <RowPressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value ? {text: value} : undefined} onPress={onPress} radius={radius} highlightInset={plain ? 0 : panelReference.highlightInset * s} contentStyle={{minHeight: panelReference.rowHeight * s, paddingHorizontal: (plain ? 6 : panelReference.rowInset) * s, paddingVertical: panelReference.rowPadding * s, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
    <Text style={{flex: 1, color: p.text, fontSize: panelReference.rowFont * s, lineHeight: panelReference.rowLine * s, includeFontPadding: false}}>{label}</Text>
    {value && <Text numberOfLines={1} style={{maxWidth: '44%', color: muted ? p.secondary : p.accent, fontSize: panelReference.valueFont * s, lineHeight: 38 * s, includeFontPadding: false}}>{value}</Text>}
    <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
  </RowPressable>;
}

export function SettingsSheet({title, caption, onClose, children, fillHeight = false}: {title: string; caption?: string; onClose: () => void; children: (close: () => void) => ReactNode; fillHeight?: boolean}) {
  const {settings: p} = useAppearance();
  const insets = useSafeAreaInsets();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  const {height: windowHeight} = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
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
  const height = fillHeight ? maximumHeight : Math.min(bodyHeight + handleHeight, maximumHeight);
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false});
  scroll.current.canScroll = bodyHeight > height - handleHeight + 1;
  return <SwipeBackModal sheet sheetHeight={bodyHeight ? height + bottom : 0} onClose={onClose} onDismissStart={beginDismiss}>{(close, motionStyle) => <SettingsTextEditorHost><View style={{flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: panelReference.sheetInset * s, paddingBottom: bottom}}>
    <SwipeBackBoundary style={{position: 'absolute', inset: 0}}><Pressable accessibilityRole="button" accessibilityLabel="선택창 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <Animated.View testID="settings-sheet" accessibilityViewIsModal style={[{width: '100%', maxWidth: 560, height, borderRadius: radius, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
      <Pressable testID="settings-sheet-close" accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={close} style={{height: handleHeight, flexShrink: 0, alignItems: 'center', paddingTop: panelReference.sheetHandle.top * s}}><View style={{width: panelReference.sheetHandle.width * s, height: panelReference.sheetHandle.height * s, borderRadius: panelReference.sheetHandle.radius * s, backgroundColor: p.divider}}/></Pressable>
      <ScrollView ref={scrollView} scrollEnabled={!closing} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={(_, measured) => setBodyHeight(old => Math.abs(old - measured) > 0.5 ? measured : old)} onScroll={event => {scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16} contentContainerStyle={{paddingHorizontal: panelReference.sheetPadding * s, paddingTop: 15 * s, paddingBottom: 42 * s}}>
        <SwipeBackScrollContent sheetScroll={scroll}>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
          {caption && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginTop: 20 * s}}>{caption}</Text>}
          <View style={{marginTop: 38 * s}}>{children(close)}</View>
        </SwipeBackScrollContent>
      </ScrollView>
    </Animated.View>
  </View></SettingsTextEditorHost>}</SwipeBackModal>;
}

export function SettingsChoice({label, detail, selected, onPress}: {label: string; detail?: string; selected: boolean; onPress: () => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <RowPressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected}} aria-checked={selected} selected={selected} selectedHighlight="pressed" onPress={onPress} radius={radius} style={{marginHorizontal: -20 * s}} contentStyle={{minHeight: 94 * s, paddingHorizontal: 20 * s, paddingVertical: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 24 * s}}>
    <View style={{flex: 1, gap: 5 * s}}>
      <Text style={{color: selected ? p.accent : p.text, fontSize: 28 * s, lineHeight: 40 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
      {detail && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{detail}</Text>}
    </View>
    <View style={{width: 34 * s, alignItems: 'center'}}>{selected && <SettingsIcon name="check" size={32 * s} color={p.accent}/>}</View>
  </RowPressable>;
}

export function SettingsNote({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginHorizontal: 6 * s, marginTop: 24 * s}}>{children}</Text>;
}

export function SettingsSave({onPress, disabled = false}: {onPress: () => void; disabled?: boolean}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <PressSurface accessibilityRole="button" accessibilityLabel="적용" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} radius={radius} highlightColor={p.onPrimary} highlightOpacity={0.08} style={{marginTop: 32 * s}} contentStyle={{backgroundColor: p.primary, minHeight: 78 * s, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: p.onPrimary, fontSize: 26 * s, fontWeight: '600'}}>적용</Text></PressSurface>;
}
