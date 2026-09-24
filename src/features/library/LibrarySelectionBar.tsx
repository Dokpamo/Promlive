import {Animated} from 'react-native';
import {PressSurface} from '../../layout/PressSurface';
import {panelReference as g} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';
import {ChatIcon} from '../chat/ChatIcon';

export const librarySelectionHeight = 78;
export function LibrarySelectionBar({count, canMove, progress, present, scale: s, bottom, onFolder, onDelete, onCancel, scope = 'persona'}: {
  scope?: string; count: number; canMove: boolean; progress: Animated.Value; present: boolean; scale: number; bottom: number; onFolder: () => void; onDelete: () => void; onCancel: () => void;
}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  if (!present) return null;
  return <Animated.View testID={`${scope}-selection-footer`} pointerEvents={count ? 'auto' : 'none'} aria-hidden={!count} accessibilityElementsHidden={!count} importantForAccessibility={count ? 'auto' : 'no-hide-descendants'}
    style={{position: 'absolute', bottom, alignSelf: 'center', height: librarySelectionHeight * s, opacity: progress, flexDirection: 'row', padding: 5 * s, gap: 4 * s,
      borderRadius: g.controlRadius * s, backgroundColor: p.sheet, boxShadow: isDark ? '0px 3px 16px rgba(0,0,0,0.24)' : '0px 3px 16px rgba(0,0,0,0.07)',
      transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [20 * s, 0]})}, {scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
    {([
      {id: 'folder', icon: 'folder', accessibilityLabel: '선택한 항목 폴더 이동', disabled: !canMove, onPress: onFolder, color: p.text},
      {id: 'delete', icon: 'delete', accessibilityLabel: '선택한 항목 삭제', disabled: !count, onPress: onDelete, color: c.error},
      {id: 'cancel', icon: 'close', accessibilityLabel: '선택 취소', disabled: !count, onPress: onCancel, color: p.text},
    ] as const).map(action => <PressSurface compact key={action.id} testID={`${scope}-${action.id}-selected`} surfaceTestID={`${scope}-${action.id}-surface`} accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel} disabled={action.disabled} onPress={action.onPress}
        radius={(g.controlRadius - 5) * s} highlightColor={p.selected} style={{height: '100%', width: 86 * s}}
        contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
        {action.icon === 'close' ? <ChatIcon name="close" size={30 * s} color={action.color}/> : <SettingsIcon name={action.icon} size={30 * s} color={action.color}/>}
      </PressSurface>)}
  </Animated.View>;
}
