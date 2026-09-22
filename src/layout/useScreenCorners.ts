import {useEffect, useState} from 'react';
import {NativeModules, Platform, useWindowDimensions} from 'react-native';

type Corners = {topLeft: number; topRight: number; bottomLeft: number; bottomRight: number};
const fallback: Corners = {topLeft: 32, topRight: 32, bottomLeft: 32, bottomRight: 32};
const screenCorners = NativeModules.ScreenCorners as {
  getCorners: () => Promise<Partial<Record<keyof Corners, number | null>> | null>;
} | undefined;

export function useScreenCorners() {
  const {width, height} = useWindowDimensions();
  const [corners, setCorners] = useState(fallback);
  useEffect(() => {
    if (Platform.OS !== 'android' || !screenCorners) return;
    let active = true;
    void screenCorners.getCorners().then(result => {
      if (!active) return;
      const next = {...fallback};
      for (const key of Object.keys(next) as (keyof Corners)[]) {
        const radius = result?.[key];
        if (typeof radius === 'number' && Number.isFinite(radius) && radius > 0) next[key] = radius;
      }
      setCorners(next);
    }).catch(() => {if (active) setCorners(fallback);});
    return () => {active = false;};
  }, [width, height]);
  return corners;
}
