import {Animated} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';

export function SelectionMark({scale: s, selectionProgress, checkedProgress, testID}: {testID?: string | undefined; scale: number; selectionProgress: Animated.Value; checkedProgress: Animated.Value}) {
  const {colors: c} = useAppearance();
  return <Animated.View testID={testID} pointerEvents="none" accessible={false} aria-hidden style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0, 46 * s]}), opacity: selectionProgress, alignItems: 'flex-end', overflow: 'hidden'}}>
    <Animated.View style={{opacity: checkedProgress}}><SettingsIcon name="check" size={28 * s} color={c.text}/></Animated.View>
  </Animated.View>;
}
