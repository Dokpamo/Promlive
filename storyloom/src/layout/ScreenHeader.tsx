import type {ReactNode} from 'react';
import {Pressable, View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {headerScale, referenceHeader as r} from '../features/chat/chatAppearance';

/** Place inside the screen's safe area; width is the viewport, including in a drawer. */
export function ScreenHeader({width, testID, children}: {width: number; testID?: string; children: ReactNode}) {
  const s = headerScale(width);
  return <View testID={testID} style={{height: r.barHeight * s, flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', paddingTop: r.top * s, paddingLeft: r.left * s, paddingRight: r.right * s, gap: r.gap * s}}>{children}</View>;
}

export function HeaderButton({width, icon, label, onPress, testID, leading = false, grouped = false}: {
  width: number;
  icon: ChatIconName;
  label: string;
  onPress: () => void;
  testID?: string;
  leading?: boolean;
  grouped?: boolean;
}) {
  const {colors: c, isDark} = useAppearance();
  const s = headerScale(width);
  const height = (grouped ? r.height - 2 : r.height) * s;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed}) => ({
    width: (grouped ? r.action : r.back) * s,
    height,
    flexShrink: 0,
    marginRight: leading ? (r.backGap - r.gap) * s : 0,
    borderRadius: grouped ? 0 : height / 2,
    backgroundColor: grouped ? pressed ? c.actionPressed : 'transparent' : pressed ? c.headerPressed : c.header,
    boxShadow: grouped || isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)',
    alignItems: 'center', justifyContent: 'center',
  })}>
    <ChatIcon name={icon} size={(icon === 'more' ? r.moreIcon : r.icon) * s} color={icon === 'back' ? c.backIcon : c.text}/>
  </Pressable>;
}
