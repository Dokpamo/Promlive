import type {ReactNode} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {headerScale, referenceHeader as r} from './metrics';
import {PressSurface} from './PressSurface';
import {EdgeTint} from './EdgeTint';

/** Place inside the screen's safe area; width is the viewport, including in a drawer. */
export function ScreenHeader({width, testID, children, topInset = 0, edgeTint = true, surfaceColor}: {width: number; testID?: string; children: ReactNode; topInset?: number; edgeTint?: boolean; surfaceColor?: string}) {
  const s = headerScale(width);
  const controls = <View pointerEvents="box-none" style={{paddingTop: (edgeTint ? topInset : 0) + r.top * s, paddingHorizontal: r.inset * s, flexDirection: 'row', alignItems: 'flex-start', gap: r.gap * s}}>{children}</View>;
  return <View testID={testID} pointerEvents="box-none" style={{height: r.barHeight * s, flexShrink: 0}}>
    {edgeTint ? <EdgeTint edge="top" testID="header-tint" {...(surfaceColor ? {surfaceColor} : {})} style={{position: 'absolute', top: -topInset, left: 0, right: 0, height: topInset + (r.barHeight + 20) * s}}>{controls}</EdgeTint> : controls}
  </View>;
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
  const {colors: c, settings: p, isDark} = useAppearance();
  const s = headerScale(width);
  const height = r.height * s;
  const filled = variant === 'filled';
  return <PressSurface compact testID={testID} surfaceTestID="header-button-content" highlightTestID="header-button-highlight" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    radius={height / 2} highlightColor={bright ? c.sendIcon : p.selected} highlightOpacity={bright ? 0.08 : 1} highlightInset={filled ? 0 : (r.height - r.highlight) * s / 2}
    style={{width: height, height, flexShrink: 0}}
    contentStyle={{backgroundColor: filled ? bright ? c.send : c.header : 'transparent', boxShadow: !filled || isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)', alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={r.icon * s} color={bright ? c.sendIcon : icon === 'back' ? c.backIcon : c.text}/>
  </PressSurface>;
}
