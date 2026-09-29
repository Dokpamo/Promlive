import {useRef} from 'react';
import {Animated, Text, View, useWindowDimensions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';
import {ChatIcon} from '../chat/ChatIcon';
import {HeaderButton} from '../../layout/ScreenHeader';
import {PressSurface} from '../../layout/PressSurface';
import {referenceHeader as r} from '../../layout/metrics';
import {panelReference} from '../../layout/panelGeometry';

export const librarySelectionPageHeight = 96;

/** Selection replaces the fixed navigation with contextual actions. */
export function LibrarySelectionChrome({scope, count, allSelected, canMove, progress, present, scale: s, bottom, onToggleAll, onCancel, onFolder, onDelete, onMore}: {
  scope: string; count: number; allSelected: boolean; canMove: boolean; progress: Animated.Value; present: boolean; scale: number; bottom: number;
  onToggleAll: () => void; onCancel: () => void; onFolder: () => void; onDelete: () => void; onMore: (anchor: View) => void;
}) {
  const {width} = useWindowDimensions();
  const {colors: c, settings: p} = useAppearance();
  const more = useRef<View>(null);
  if (!present) return null;
  const height = r.height * s;
  return <>
    <Animated.View testID={`${scope}-selection-header`} pointerEvents={count ? 'box-none' : 'none'} aria-hidden={!count} accessibilityElementsHidden={!count}
      style={{position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: c.background, opacity: progress,
        transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [-8 * s, 0]})}]}}>
      <View pointerEvents="box-none" style={{height: r.barHeight * s, width: '100%', maxWidth: panelReference.contentMaxWidth, alignSelf: 'center', paddingHorizontal: r.inset * s,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <PressSurface compact testID={`${scope}-select-all`} accessibilityRole="button" accessibilityLabel={`${count}개 선택, ${allSelected ? '전체 선택 해제' : '전체 선택'}`}
          accessibilityState={{selected: allSelected}} onPress={onToggleAll} radius={12 * s} highlightColor={p.selected} style={{height, minWidth: 132 * s}}
          contentStyle={{paddingHorizontal: 8 * s, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 * s}}>
            <View accessible={false} style={{width: 28 * s, height: 28 * s, borderRadius: 14 * s, borderWidth: 2 * s, borderColor: allSelected ? c.text : c.placeholder, alignItems: 'center', justifyContent: 'center'}}>
              {allSelected && <SettingsIcon name="check" size={20 * s} color={c.text}/>}
            </View>
            <Text testID={`${scope}-selection-count`} accessibilityLiveRegion="polite" style={{color: c.text, fontSize: 30 * s, lineHeight: 40 * s, fontWeight: '600', includeFontPadding: false}}>{count}</Text>
        </PressSurface>
        <HeaderButton width={width} testID={`${scope}-selection-cancel`} icon="close" label="선택 취소" onPress={onCancel}/>
      </View>
    </Animated.View>
    <Animated.View testID={`${scope}-selection-footer`} pointerEvents={count ? 'auto' : 'none'} aria-hidden={!count} accessibilityElementsHidden={!count}
      style={{position: 'absolute', bottom: Math.max(0, bottom - 10 * s), left: 0, right: 0, height: librarySelectionPageHeight * s,
        backgroundColor: p.sheet, borderTopWidth: .5, borderTopColor: c.divider, paddingHorizontal: 16 * s, flexDirection: 'row', opacity: progress,
        transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [24 * s, 0]})}]}}>
      {([
        {id: 'folder', label: '분류 이동', icon: 'folder', accessibilityLabel: '선택한 항목 폴더 이동', disabled: !canMove, onPress: onFolder},
        {id: 'delete', label: '삭제', icon: 'delete', accessibilityLabel: '선택한 항목 삭제', disabled: !count, onPress: onDelete},
        {id: 'more', label: '더보기', icon: 'more', accessibilityLabel: '선택한 항목 더보기', disabled: !count, onPress: () => {if (more.current) onMore(more.current);}},
      ] as const).map(action => <View key={action.id} ref={action.id === 'more' ? more : undefined} collapsable={false} style={{flex: 1}}>
        <PressSurface compact testID={`${scope}-${action.id}-selected`} surfaceTestID={`${scope}-${action.id}-surface`} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel}
          disabled={action.disabled} onPress={action.onPress} radius={0} highlightColor={p.selected} style={{flex: 1}}
          contentStyle={{alignItems: 'center', justifyContent: 'center', gap: 5 * s}}>
          {action.icon === 'more' ? <ChatIcon name="more" size={32 * s} color={c.text}/> : <SettingsIcon name={action.icon} size={32 * s} color={c.text}/>}
          <Text style={{color: c.text, fontSize: 19 * s, lineHeight: 26 * s, includeFontPadding: false}}>{action.label}</Text>
        </PressSurface>
      </View>)}
    </Animated.View>
  </>;
}
