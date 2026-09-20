import type {ReactNode} from 'react';
import {Animated, Pressable, View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {headerScale, referenceHeader as r} from '../features/chat/chatAppearance';
import {usePressFeedback} from './usePressFeedback';

/** Place inside the screen's safe area; width is the viewport, including in a drawer. */
export function ScreenHeader({width, testID, children}: {width: number; testID?: string; children: ReactNode}) {
  const s = headerScale(width);
  return <View testID={testID} style={{height: r.barHeight * s, flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', paddingTop: r.top * s, paddingLeft: r.left * s, paddingRight: r.right * s, gap: r.gap * s}}>{children}</View>;
}

export function HeaderButton({width, icon, label, onPress, testID, leading = false, grouped = false, disabled = false, bright = false}: {
  width: number;
  icon: ChatIconName;
  label: string;
  onPress: () => void;
  testID?: string;
  leading?: boolean;
  grouped?: boolean;
  disabled?: boolean;
  bright?: boolean;
}) {
  const {colors: c, isDark} = useAppearance();
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const s = headerScale(width);
  const height = (grouped ? r.height - 2 : r.height) * s;
  const buttonWidth = (grouped ? r.action : r.back) * s;
  const highlightSize = r.highlight * s;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{
    width: buttonWidth,
    height,
    flexShrink: 0,
    marginRight: leading ? (r.backGap - r.gap) * s : 0,
    borderRadius: grouped ? 0 : height / 2,
    backgroundColor: grouped ? 'transparent' : bright ? c.send : c.header,
    opacity: disabled ? 0.4 : 1,
    boxShadow: grouped || isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)',
    alignItems: 'center', justifyContent: 'center',
  }}>
    <Animated.View testID="header-button-content" style={{width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0.98]})}]}}>
      <Animated.View testID="header-button-highlight" pointerEvents="none" style={{position: 'absolute', left: (buttonWidth - highlightSize) / 2, top: (height - highlightSize) / 2, width: highlightSize, height: highlightSize, borderRadius: highlightSize / 2, backgroundColor: bright ? c.sendIcon : grouped ? c.actionPressed : c.headerPressed, opacity: bright ? Animated.multiply(progress, 0.08) : progress}}/>
      <ChatIcon name={icon} size={(icon === 'more' ? r.moreIcon : r.icon) * s} color={bright ? c.sendIcon : icon === 'back' ? c.backIcon : c.text}/>
    </Animated.View>
  </Pressable>;
}
