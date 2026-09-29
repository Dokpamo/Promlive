import {Animated, StyleSheet} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';

export function SelectionMark({scale: s, selectionProgress, checkedProgress, testID}: {testID?: string | undefined; scale: number; selectionProgress: Animated.Value; checkedProgress: Animated.Value}) {
  const {colors: c} = useAppearance();
  return <Animated.View testID={testID} pointerEvents="none" accessible={false} aria-hidden style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0, 46 * s]}), opacity: selectionProgress, alignItems: 'flex-end', overflow: 'hidden'}}>
    <Animated.View style={{opacity: checkedProgress}}><SettingsIcon name="check" size={28 * s} color={c.text}/></Animated.View>
  </Animated.View>;
}

/** Covers keep their text width; the whole tile still acts as the selection target. */
export function CoverSelectionMark({scale: s, selectionProgress, checkedProgress, testID}: {testID?: string; scale: number; selectionProgress: Animated.Value; checkedProgress: Animated.Value}) {
  const {colors: c} = useAppearance();
  return <Animated.View testID={testID} pointerEvents="none" accessible={false} aria-hidden style={{position: 'absolute', top: 12 * s, left: 12 * s,
    width: 34 * s, height: 34 * s, borderRadius: 17 * s, backgroundColor: 'rgba(0,0,0,0.18)', borderWidth: 2 * s, borderColor: '#FFF',
    opacity: selectionProgress, overflow: 'hidden', transform: [{scale: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0.85, 1]})}]}}>
    <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor: c.button, opacity: checkedProgress, alignItems: 'center', justifyContent: 'center'}]}>
      <SettingsIcon name="check" size={24 * s} color={c.text}/>
    </Animated.View>
  </Animated.View>;
}
