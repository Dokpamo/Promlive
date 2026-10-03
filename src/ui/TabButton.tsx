import {useLayoutEffect, useState} from 'react';
import {Animated, Platform, Pressable} from 'react-native';
import {TabIcon} from './TabIcon';
import {tabLabels, type Tab} from './navigationRoutes';
import {createTabPressMotion} from './tabPressMotion';
import {useDesktopHover} from './desktop/DesktopFeedback';
import {usePalette} from './Theme';

export function TabButton({name, selected, size, reducedMotion, onChange, desktop}: {name: Tab; selected: boolean; size: number; reducedMotion: boolean; onChange: (tab: Tab) => void; desktop?: boolean}) {
  const [motion] = useState(() => createTabPressMotion(selected));
  const [hoverFill] = useState(() => new Animated.Value(1));
  const colors = usePalette(), hover = useDesktopHover(selected, desktop);
  useLayoutEffect(() => {motion.mount(); return () => motion.dispose();}, [motion]);
  useLayoutEffect(() => motion.setReduced(reducedMotion), [motion, reducedMotion]);
  useLayoutEffect(() => motion.setSelected(selected), [motion, selected]);
  return <Pressable testID={`ui-tab-${name}`} accessibilityRole="tab" accessibilityLabel={tabLabels[name]}
    {...hover.events}
    accessibilityState={{selected}} aria-selected={selected}
    {...(Platform.OS === 'web' ? {delayPressIn: 0} : {unstable_pressDelay: 0})}
    onPressIn={() => {motion.press(); onChange(name);}} onPressOut={motion.endPress} onPress={() => {motion.release(); onChange(name);}}
    style={{flex: 1, borderRadius: 12, backgroundColor: hover.hovered ? colors.surface : 'transparent', alignItems: 'center', justifyContent: 'center'}}>
    <TabIcon name={name} size={size} selection={hover.hovered ? hoverFill : motion.fill} waves={motion.waves}/>
  </Pressable>;
}
