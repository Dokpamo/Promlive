import {useLayoutEffect, useState} from 'react';
import type {Animated} from 'react-native';

interface CompactMotion {height: Animated.Value; filled: Animated.Value}
interface LayoutFrame {height: number; filled: number}

/** Commit the animated bar and its controls in one layout. The text viewport
 * takes its measured height immediately, without waiting for this spring.
 */
export function useComposerLayoutFrame(motion: CompactMotion, initial: LayoutFrame) {
  const [frame, setFrame] = useState<LayoutFrame>(initial);
  useLayoutEffect(() => {
    const values: [keyof LayoutFrame, Animated.Value][] = [
      ['height', motion.height], ['filled', motion.filled],
    ];
    const listeners = values.map(([key, node]) => {
      const id = node.addListener(({value}) => setFrame(current => current[key] === value ? current : {...current, [key]: value}));
      return () => node.removeListener(id);
    });
    return () => listeners.forEach(remove => remove());
  }, [motion]);
  return frame;
}
