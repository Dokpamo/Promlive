import {useLayoutEffect, useState} from 'react';
import {Platform, Pressable} from 'react-native';
import {TabIcon} from './TabIcon';
import {tabLabels, type Tab} from './navigationRoutes';
import {createTabPressMotion} from './tabPressMotion';

export function TabButton({name, selected, size, reducedMotion, onChange}: {name: Tab; selected: boolean; size: number; reducedMotion: boolean; onChange: (tab: Tab) => void}) {
  const [motion] = useState(() => createTabPressMotion(selected));
  useLayoutEffect(() => {motion.mount(); return () => motion.dispose();}, [motion]);
  useLayoutEffect(() => motion.setReduced(reducedMotion), [motion, reducedMotion]);
  useLayoutEffect(() => motion.setSelected(selected), [motion, selected]);
  return <Pressable testID={`ui-tab-${name}`} accessibilityRole="tab" accessibilityLabel={tabLabels[name]}
    accessibilityState={{selected}} aria-selected={selected}
    {...(Platform.OS === 'web' ? {delayPressIn: 0} : {unstable_pressDelay: 0})}
    onPressIn={() => {motion.press(); onChange(name);}} onPressOut={motion.endPress} onPress={() => {motion.release(); onChange(name);}}
    style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <TabIcon name={name} size={size} selection={motion.fill} waves={motion.waves}/>
  </Pressable>;
}
