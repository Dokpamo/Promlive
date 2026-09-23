import {useRef} from 'react';
import {Animated, Platform, Pressable, Text, TextInput, View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {referenceSidebar as r} from '../features/chat/chatAppearance';
import {PressSurface} from './PressSurface';
import {rowPressedScale} from './RowPressable';
import {usePressFeedback} from './usePressFeedback';

/** The card and persona lists share the same input, hit area and press animation. */
export function ListSearch({scale: s, value, onChange, label, testID = 'sidebar-search', transition}: {
  scale: number; value: string; onChange: (value: string) => void; label: string; testID?: string;
  transition?: {progress: Animated.AnimatedInterpolation<number>; from: string; to: string};
}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  const input = useRef<TextInput>(null);
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const size = r.searchHeight * s;
  const travel = 144 * s;
  const mouseFeedback = Platform.OS === 'web' ? {onMouseDown: onPressIn, onMouseUp: onPressOut, onMouseLeave: onPressOut} : {};
  return <Pressable testID={testID} accessible={false} onPress={() => input.current?.focus()} onPressIn={onPressIn} onPressOut={onPressOut} style={{height: size}}>
    <Animated.View testID="sidebar-search-surface" style={{height: size, borderRadius: size / 2, backgroundColor: c.search, borderWidth: isDark ? s : 0, borderColor: c.border, boxShadow: isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 27 * s, gap: 14 * s, transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, rowPressedScale]})}]}}>
      <Animated.View testID="sidebar-search-tint" pointerEvents="none" style={{position: 'absolute', inset: 0, borderRadius: size / 2, backgroundColor: p.selected, opacity: progress}}/>
      <ChatIcon name="search" size={29 * s} color={c.text}/>
      <View style={{flex: 1, minWidth: 0, height: size, overflow: 'hidden'}}>
        <TextInput ref={input} testID={`${testID}-input`} accessibilityLabel={label} value={value} onChangeText={onChange} selectionColor="#3096EB" underlineColorAndroid="transparent" returnKeyType="search" onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut} onBlur={onPressOut} {...mouseFeedback} style={{width: '100%', padding: 0, color: c.text, height: size, fontSize: 27 * s, includeFontPadding: false}}/>
        <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', inset: 0, opacity: value ? 0 : 1}}>
          <Animated.View testID="search-card-placeholder" style={{position: 'absolute', inset: 0, justifyContent: 'center', opacity: transition?.progress.interpolate({inputRange: [0, 0.8, 1], outputRange: [1, 0, 0]}) ?? 1, transform: [{translateX: transition?.progress.interpolate({inputRange: [0, 1], outputRange: [0, travel]}) ?? 0}]}}>
            <Text numberOfLines={1} style={{color: c.placeholder, fontSize: 27 * s, includeFontPadding: false}}>{transition?.from ?? '검색'}</Text>
          </Animated.View>
          {transition && <Animated.View testID="search-history-placeholder" style={{position: 'absolute', inset: 0, justifyContent: 'center', opacity: transition.progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, 0, 1]}), transform: [{translateX: transition.progress.interpolate({inputRange: [0, 1], outputRange: [-travel, 0]})}]}}>
            <Text numberOfLines={1} style={{color: c.placeholder, fontSize: 27 * s, includeFontPadding: false}}>{transition.to}</Text>
          </Animated.View>}
        </View>
      </View>
    </Animated.View>
  </Pressable>;
}

export function ListCreateButton({scale: s, label, onPress, testID = 'sidebar-create', icon = 'new-chat'}: {scale: number; label: string; onPress: () => void; testID?: string; icon?: ChatIconName}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  const size = r.searchHeight * s;
  return <PressSurface compact testID={testID} surfaceTestID="sidebar-create-surface" highlightTestID="sidebar-create-tint" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    radius={size / 2} highlightColor={p.selected} style={{width: size, height: size, flexShrink: 0}}
    contentStyle={{backgroundColor: c.header, boxShadow: isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)', alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={35 * s} color={c.text}/>
    <View pointerEvents="none" style={{position: 'absolute', inset: 0, borderRadius: size / 2, borderWidth: s, borderColor: c.headerBorder}}/>
  </PressSurface>;
}
