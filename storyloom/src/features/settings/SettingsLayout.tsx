import type {ReactNode} from 'react';
import {Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale} from '../chat/chatAppearance';
import {SettingsIcon} from './SettingsIcon';
import {SwipeBackModal, SwipeBackScrollContent} from './SwipeBackModal';

/** 618px reference geometry; panel corners follow photo_6159075255742305500_y.jpg. */
export const settingsReference = {
  inset: 34, top: 42, radius: 48, controlRadius: 30, groupGap: 18, groupPadding: 14,
  rowHeight: 82, rowInset: 34, rowFont: 28, rowLine: 40, valueFont: 26,
  profileSize: 96, profileInset: 11, profileGap: 27, profileBottom: 42,
  sheetInset: 17, sheetPadding: 42,
} as const;

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
    <ScrollView testID={home ? 'settings-scroll' : 'settings-detail-scroll'} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: settingsReference.inset * s, paddingTop: settingsReference.top * s, paddingBottom: 36 * s}}>
      <SwipeBackScrollContent>
        {title && <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: '700', marginHorizontal: 6 * s, marginBottom: 24 * s, includeFontPadding: false}}>{title}</Text>}
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
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value ? {text: value} : undefined} onPress={onPress} style={({pressed}) => ({minHeight: settingsReference.rowHeight * s, paddingHorizontal: (plain ? 6 : settingsReference.rowInset) * s, paddingVertical: 17 * s, flexDirection: 'row', alignItems: 'center', gap: 16 * s, borderRadius: radius, backgroundColor: pressed ? p.pressed : 'transparent'})}>
    <Text style={{flex: 1, color: p.text, fontSize: settingsReference.rowFont * s, lineHeight: settingsReference.rowLine * s, includeFontPadding: false}}>{label}</Text>
    {value && <Text numberOfLines={1} style={{maxWidth: '44%', color: muted ? p.secondary : p.accent, fontSize: settingsReference.valueFont * s, lineHeight: 38 * s, includeFontPadding: false}}>{value}</Text>}
    <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
  </Pressable>;
}

export function SettingsSheet({title, caption, onClose, children}: {title: string; caption?: string; onClose: () => void; children: (close: () => void) => ReactNode}) {
  const {settings: p} = useAppearance();
  const insets = useSafeAreaInsets();
  const s = useSettingsScale();
  const radius = useSettingsRadius();
  return <SwipeBackModal sheet onClose={onClose}>{close => <View style={{flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: settingsReference.sheetInset * s, paddingBottom: Math.max(insets.bottom, settingsReference.sheetInset * s)}}>
    <Pressable accessibilityRole="button" accessibilityLabel="선택창 바깥 눌러 닫기" onPress={close} style={{position: 'absolute', inset: 0}}/>
    <View testID="settings-sheet" accessibilityViewIsModal style={{width: '100%', maxWidth: 560, maxHeight: '85%', borderRadius: radius, backgroundColor: p.sheet, overflow: 'hidden'}}>
      <Pressable testID="settings-sheet-close" accessibilityRole="button" accessibilityLabel="선택창 닫기" onPress={close} style={{height: 58 * s, alignItems: 'center', paddingTop: 21 * s}}><View style={{width: 82 * s, height: 7 * s, borderRadius: 4 * s, backgroundColor: p.divider}}/></Pressable>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: settingsReference.sheetPadding * s, paddingTop: 15 * s, paddingBottom: 42 * s}}>
        <SwipeBackScrollContent>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: '700', includeFontPadding: false}}>{title}</Text>
          {caption && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginTop: 20 * s}}>{caption}</Text>}
          <View style={{marginTop: 38 * s}}>{children(close)}</View>
        </SwipeBackScrollContent>
      </ScrollView>
    </View>
  </View>}</SwipeBackModal>;
}

export function SettingsChoice({label, detail, selected, onPress}: {label: string; detail?: string; selected: boolean; onPress: () => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected}} aria-checked={selected} onPress={onPress} style={({pressed}) => ({minHeight: 94 * s, marginHorizontal: -20 * s, paddingHorizontal: 20 * s, paddingVertical: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 24 * s, backgroundColor: pressed ? p.pressed : selected ? p.selected : 'transparent', borderRadius: radius})}>
    <View style={{flex: 1, gap: 5 * s}}>
      <Text style={{color: selected ? p.accent : p.text, fontSize: 28 * s, lineHeight: 40 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
      {detail && <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{detail}</Text>}
    </View>
    <View style={{width: 34 * s, alignItems: 'center'}}>{selected && <SettingsIcon name="check" size={32 * s} color={p.accent}/>}</View>
  </Pressable>;
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
