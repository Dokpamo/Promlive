import type {ReactNode} from 'react';
import {Animated, Pressable, View, type StyleProp, type ViewStyle} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {headerScale, referenceHeader as r} from '../features/chat/chatAppearance';
import {usePressFeedback} from './usePressFeedback';

/** Place inside the screen's safe area; width is the viewport, including in a drawer. */
export function ScreenHeader({width, testID, children}: {width: number; testID?: string; children: ReactNode}) {
  const s = headerScale(width);
  return <View testID={testID} style={{height: r.barHeight * s, flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', paddingTop: r.top * s, paddingLeft: r.left * s, paddingRight: r.right * s, gap: r.gap * s}}>{children}</View>;
}

/** The outline overlays the surface so it never changes button height or icon centers. */
export function HeaderCapsule({width, testID, children, style}: {width: number; testID?: string; children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const {colors: c, isDark} = useAppearance();
  const s = headerScale(width);
  const height = r.height * s;
  return <View testID={testID} style={[{height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: c.header, boxShadow: isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)'}, style]}>
    {children}
    <View pointerEvents="none" style={{position: 'absolute', inset: 0, borderRadius: height / 2, borderWidth: s, borderColor: c.headerBorder}}/>
  </View>;
}

export function HeaderButton({width, icon, label, onPress, testID, variant = 'filled', disabled = false, bright = false}: {
  width: number;
  icon: ChatIconName;
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: 'filled' | 'grouped' | 'plain';
  disabled?: boolean;
  bright?: boolean;
}) {
  const {colors: c, isDark} = useAppearance();
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const s = headerScale(width);
  const height = r.height * s;
  const filled = variant === 'filled';
  const highlightSize = r.highlight * s;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{
    width: height,
    height,
    flexShrink: 0,
    borderRadius: height / 2,
    backgroundColor: filled ? bright ? c.send : c.header : 'transparent',
    opacity: disabled ? 0.4 : 1,
    boxShadow: !filled || isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)',
    alignItems: 'center', justifyContent: 'center',
  }}>
    <Animated.View testID="header-button-content" style={{width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0.98]})}]}}>
      <Animated.View testID="header-button-highlight" pointerEvents="none" style={{position: 'absolute', left: (height - highlightSize) / 2, top: (height - highlightSize) / 2, width: highlightSize, height: highlightSize, borderRadius: highlightSize / 2, backgroundColor: bright ? c.sendIcon : variant === 'grouped' ? c.actionPressed : variant === 'plain' ? c.historySelected : c.headerPressed, opacity: bright ? Animated.multiply(progress, 0.08) : progress}}/>
      <ChatIcon name={icon} size={r.icon * s} color={bright ? c.sendIcon : icon === 'back' ? c.backIcon : c.text}/>
    </Animated.View>
  </Pressable>;
}
