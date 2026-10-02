import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {if (mounted) setReduced(value);};
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    return () => {mounted = false; subscription?.remove();};
  }, []);
  return reduced;
}
