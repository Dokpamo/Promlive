import {useLayoutEffect, useMemo, type ReactNode} from 'react';
import {Animated, Platform, StyleSheet} from 'react-native';
import {createBackUnderlay, type BackTransition, type BackUnderlaySource} from './backTransition';
import {useDesktopPane} from './desktop/DesktopPane';

/** Native scroll views must keep their viewport while another screen covers them. */
export function ScreenLayer({hidden = false, prepared = false, children, backTransition, alternateTransition, useAlternate = false, testID}: {
  hidden?: boolean; prepared?: boolean; children: ReactNode; backTransition?: BackTransition | undefined; testID: string;
  alternateTransition?: BackTransition; useAlternate?: boolean;
}) {
  const desktop = useDesktopPane();
  const source: BackUnderlaySource = hidden ? (useAlternate ? 1 : 0) : null;
  // Route/visibility changes only update weights, never replace the attached graph.
  const underlay = useMemo(() => createBackUnderlay(backTransition, alternateTransition, source), [backTransition, alternateTransition]);
  useLayoutEffect(() => {underlay.select(source);}, [underlay, source]);
  return <Animated.View testID={testID} collapsable={false} aria-hidden={hidden} accessibilityElementsHidden={hidden}
    {...(Platform.OS === 'web' ? {inert: hidden} : {})}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} pointerEvents={hidden ? 'none' : 'auto'}
    style={[StyleSheet.absoluteFillObject, {opacity: hidden && (!prepared || desktop) ? 0 : 1,
      zIndex: hidden ? 0 : 1, transform: [{translateX: desktop ? 0 : underlay.translateX}]},
      ((Platform.OS === 'web' && !prepared) || desktop) && hidden && {display: 'none'}]}>
    {children}
    {!desktop && <Animated.View testID={`${testID}-dim`} pointerEvents="none" accessible={false}
      style={[StyleSheet.absoluteFillObject, {backgroundColor: '#000', opacity: underlay.dimOpacity}]}/>}
  </Animated.View>;
}
