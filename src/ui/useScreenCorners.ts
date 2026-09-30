import {useEffect, useState} from 'react';
import {NativeModules, Platform, useWindowDimensions} from 'react-native';
import {resolveScreenCorners, type ScreenCorners} from './screenCorners';

/** Read the existing OS bridge, without importing any legacy screen or layout code. */
export function useScreenCorners() {
  const {width, height} = useWindowDimensions();
  const [corners, setCorners] = useState(() => resolveScreenCorners(null));
  useEffect(() => {
    const bridge = NativeModules.ScreenCorners as {
      getCorners: () => Promise<Partial<Record<keyof ScreenCorners, number | null>> | null>;
    } | undefined;
    if ((Platform.OS !== 'android' && Platform.OS !== 'ios') || !bridge) return;
    let mounted = true;
    void bridge.getCorners().then(result => {
      if (mounted) setCorners(resolveScreenCorners(result));
    }).catch(() => {if (mounted) setCorners(resolveScreenCorners(null));});
    return () => {mounted = false;};
  }, [width, height]);
  return corners;
}
