import type {ReactNode} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {headerScale, referenceHeader as r} from './metrics';
import {PressSurface} from './PressSurface';

/** Shared flat header. Insets stay stable while screens and keyboards transition. */
export function ScreenHeader({width, testID, children, topInset = 0, surfaceColor}: {width: number; testID?: string; children: ReactNode; topInset?: number; edgeTint?: boolean; surfaceColor?: string}) {
  const s = headerScale(width);
  const {colors: c} = useAppearance();
  return <View testID={testID} style={{height: r.barHeight * s, flexShrink: 0, backgroundColor: surfaceColor ?? c.background, justifyContent: 'center'}}>
    {topInset > 0 && <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: -topInset, height: topInset, backgroundColor: surfaceColor ?? c.background}}/>}
    <View style={{paddingHorizontal: r.inset * s, flexDirection: 'row', alignItems: 'center', gap: r.gap * s}}>{children}</View>
  </View>;
}

export function HeaderCapsule({width, testID, children, style}: {width: number; testID?: string; children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const s = headerScale(width);
  return <View testID={testID} style={[{height: r.height * s}, style]}>{children}</View>;
}

export function HeaderButton({width, icon, label, onPress, testID, disabled = false, bright = false}: {
  width: number; icon: ChatIconName; label: string; onPress: () => void; testID?: string;
  variant?: 'filled' | 'grouped' | 'plain'; disabled?: boolean; bright?: boolean;
}) {
  const {colors: c} = useAppearance();
  const s = headerScale(width), height = r.height * s;
  return <PressSurface compact testID={testID} surfaceTestID="header-button-content" highlightTestID="header-button-highlight" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    radius={12 * s} highlightColor={c.historySelected} style={{width: height, height, flexShrink: 0}}
    contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={36 * s} color={bright ? c.send : c.text}/>
  </PressSurface>;
}
