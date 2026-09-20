import {useRef, useState, type ReactNode} from 'react';
import {Animated, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceTypography} from '../chat/chatAppearance';
import {SettingsIcon} from './SettingsIcon';
import {SettingsPressable} from './SettingsPressable';
import {SwipeBackBoundary, SwipeBackModal, SwipeBackScrollContent} from './SwipeBackModal';
import type {SheetScrollState} from './sheetMotion';
import {settingsReference} from './settingsGeometry';

export {settingsReference} from './settingsGeometry';

export function useSettingsScale() {
  return headerScale(useWindowDimensions().width);
}

export function useSettingsRadius(kind: 'panel' | 'control' = 'panel') {
  return (kind === 'panel' ? settingsReference.radius : settingsReference.controlRadius) * useSettingsScale();
}

export function SettingsPage({children, onBack, title, home = false}: {
  children: ReactNode;
  onBack: () => void;
  title?: string;
  home?: boolean;
}) {
  const {settings: p} = useAppearance();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const insets = useSafeAreaInsets();
  return <SafeAreaView testID={home ? 'settings-preview' : 'settings-detail'} edges={['left', 'right', 'bottom']} style={{flex: 1, backgroundColor: p.background}}>
    <View style={{height: insets.top}}/>
    <ScreenHeader width={width} testID={home ? 'settings-header' : 'settings-detail-header'}>
      <HeaderButton width={width} testID={home ? 'settings-back' : 'settings-detail-back'} icon="back" label={home ? '설정 닫기' : '설정으로 돌아가기'} onPress={onBack} leading/>
    </ScreenHeader>
    <ScrollView testID={home ? 'settings-scroll' : 'settings-detail-scroll'} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{width: '100%', maxWidth: settingsReference.contentMaxWidth, alignSelf: 'center', paddingHorizontal: settingsReference.inset * s, paddingTop: settingsReference.top * s, paddingBottom: 36 * s}}>
      <SwipeBackScrollContent>
        {title && <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, marginHorizontal: 6 * s, marginBottom: 24 * s, includeFontPadding: false}}>{title}</Text>}
        {children}
      </SwipeBackScrollContent>
    </ScrollView>
  </SafeAreaView>;
}

export function SettingsGroup({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  return <View testID="settings-group" style={{backgroundColor: p.surface, borderRadius: radius, paddingVertical: settingsReference.groupPadding * s, marginBottom: settingsReference.groupGap * s, overflow: 'hidden'}}>{children}</View>;
}

export function SettingsRow({label, value, onPress, plain = false, muted = false}: {label: string; value?: string; onPress: () => void; plain?: boolean; muted?: boolean}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <SettingsPressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value ? {text: value} : undefined} onPress={onPress} radius={radius} highlightInset={plain ? 0 : settingsReference.highlightInset * s} contentStyle={{minHeight: settingsReference.rowHeight * s, paddingHorizontal: (plain ? 6 : settingsReference.rowInset) * s, paddingVertical: settingsReference.rowPadding * s, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
    <Text style={{flex: 1, color: p.text, fontSize: settingsReference.rowFont * s, lineHeight: settingsReference.rowLine * s, includeFontPadding: false}}>{label}</Text>
    {value && <Text numberOfLines={1} style={{maxWidth: '44%', color: muted ? p.secondary : p.accent, fontSize: settingsReference.valueFont * s, lineHeight: 38 * s, includeFontPadding: false}}>{value}</Text>}
    <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
  </SettingsPressable>;
}

export function SettingsSheet({title, caption, onClose, children}: {title: string; caption?: string; onClose: () => void; children: (close: () => void) => ReactNode}) {
  const {settings: p} = useAppearance();
  const insets = useSafeAreaInsets();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  const {height: windowHeight} = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const bottom = Math.max(insets.bottom, settingsReference.sheetInset * s);
  const handleHeight = 58 * s;
  const height = Math.min(bodyHeight + handleHeight, (windowHeight - bottom) * 0.85);
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false});
  scroll.current.canScroll = bodyHeight > height - handleHeight + 1;
  return <SwipeBackModal sheet sheetHeight={bodyHeight ? height + bottom : 0} onClose={onClose}>{(close, motionStyle) => <View style={{flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: settingsReference.sheetInset * s, paddingBottom: bottom}}>
    <SwipeBackBoundary style={{position: 'absolute', inset: 0}}><Pressable accessibilityRole="button" accessibilityLabel="선택창 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <Animated.View testID="settings-sheet" accessibilityViewIsModal style={[{width: '100%', maxWidth: 560, height, borderRadius: radius, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
      <Pressable testID="settings-sheet-close" accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={close} style={{height: handleHeight, flexShrink: 0, alignItems: 'center', paddingTop: 21 * s}}><View style={{width: 82 * s, height: 7 * s, borderRadius: 4 * s, backgroundColor: p.divider}}/></Pressable>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={(_, measured) => setBodyHeight(old => Math.abs(old - measured) > 0.5 ? measured : old)} onScroll={event => {scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16} contentContainerStyle={{paddingHorizontal: settingsReference.sheetPadding * s, paddingTop: 15 * s, paddingBottom: 42 * s}}>
        <SwipeBackScrollContent sheetScroll={scroll}>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
          {caption && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginTop: 20 * s}}>{caption}</Text>}
          <View style={{marginTop: 38 * s}}>{children(close)}</View>
        </SwipeBackScrollContent>
      </ScrollView>
    </Animated.View>
  </View>}</SwipeBackModal>;
}

export function SettingsChoice({label, detail, selected, onPress}: {label: string; detail?: string; selected: boolean; onPress: () => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <SettingsPressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected}} aria-checked={selected} selected={selected} onPress={onPress} radius={radius} style={{marginHorizontal: -20 * s}} contentStyle={{minHeight: 94 * s, paddingHorizontal: 20 * s, paddingVertical: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 24 * s}}>
    <View style={{flex: 1, gap: 5 * s}}>
      <Text style={{color: selected ? p.accent : p.text, fontSize: 28 * s, lineHeight: 40 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
      {detail && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{detail}</Text>}
    </View>
    <View style={{width: 34 * s, alignItems: 'center'}}>{selected && <SettingsIcon name="check" size={32 * s} color={p.accent}/>}</View>
  </SettingsPressable>;
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
  return <Pressable accessibilityRole="button" accessibilityLabel="적용" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => ({backgroundColor: p.primary, opacity: disabled ? 0.35 : pressed ? 0.75 : 1, minHeight: 78 * s, marginTop: 32 * s, borderRadius: radius, alignItems: 'center', justifyContent: 'center'})}><Text style={{color: p.onPrimary, fontSize: 26 * s, fontWeight: '600'}}>적용</Text></Pressable>;
}
