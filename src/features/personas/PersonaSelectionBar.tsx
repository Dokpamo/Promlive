import {Animated} from 'react-native';
import {PressSurface} from '../../layout/PressSurface';
import {panelReference as g} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';

export const personaSelectionHeight = 78;
export function PersonaSelectionBar({count, canMove, progress, present, scale: s, bottom, onFolder, onDelete}: {
  count: number; canMove: boolean; progress: Animated.Value; present: boolean; scale: number; bottom: number; onFolder: () => void; onDelete: () => void;
}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  if (!present) return null;
  return <Animated.View testID="persona-selection-footer" pointerEvents={count ? 'auto' : 'none'} aria-hidden={!count} accessibilityElementsHidden={!count} importantForAccessibility={count ? 'auto' : 'no-hide-descendants'}
    style={{position: 'absolute', bottom, alignSelf: 'center', height: personaSelectionHeight * s, opacity: progress, flexDirection: 'row', padding: 5 * s, gap: 4 * s,
      borderRadius: g.controlRadius * s, backgroundColor: p.sheet, boxShadow: isDark ? '0px 3px 16px rgba(0,0,0,0.24)' : '0px 3px 16px rgba(0,0,0,0.07)',
      transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [20 * s, 0]})}, {scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
    {([
      {id: 'folder', icon: 'folder', accessibilityLabel: '선택한 항목 폴더 이동', disabled: !canMove, onPress: onFolder, color: p.text},
      {id: 'delete', icon: 'delete', accessibilityLabel: '선택한 항목 삭제', disabled: !count, onPress: onDelete, color: c.error},
    ] as const).map(action => <PressSurface key={action.id} testID={`persona-${action.id}-selected`} accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel} disabled={action.disabled} onPress={action.onPress}
        radius={(g.controlRadius - 5) * s} highlightColor={p.selected} style={{height: '100%', width: 86 * s}}
        contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
        <SettingsIcon name={action.icon} size={30 * s} color={action.color}/>
      </PressSurface>)}
  </Animated.View>;
}
