import {useLayoutEffect, useState} from 'react';
import type {Animated} from 'react-native';

interface CompactMotion {height: Animated.Value; input: Animated.Value; filled: Animated.Value}
interface LayoutFrame {progress: number; height: number; input: number; filled: number}

/** Commit the surface, viewport and scrolling insets in one React layout.
 * Separate Animated layout props can reach Fabric in different frames, making
 * the editor move backwards briefly even when the spring itself is monotonic.
 */
export function useComposerLayoutFrame(progress: Animated.Value, motion: CompactMotion, initial: Omit<LayoutFrame, 'progress'>) {
  const [frame, setFrame] = useState<LayoutFrame>(() => ({progress: 0, ...initial}));
  useLayoutEffect(() => {
    const values: [keyof LayoutFrame, Animated.Value][] = [
      ['progress', progress], ['height', motion.height], ['input', motion.input], ['filled', motion.filled],
    ];
    const listeners = values.map(([key, node]) => {
      const id = node.addListener(({value}) => setFrame(current => current[key] === value ? current : {...current, [key]: value}));
      return () => node.removeListener(id);
    });
    return () => listeners.forEach(remove => remove());
  }, [motion, progress]);
  return frame;
}
