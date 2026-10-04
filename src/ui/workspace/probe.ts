/** Optional benchmark observer. Normal application entry points never install it. */
import {useEffect, useRef} from 'react';
export type WorkspaceProbe = {
  mounted: Set<string>;
  target?: string;
  events?: Record<string, unknown>[];
  surface?: {
    inspect(): Record<string, unknown>;
    move(pixels: number): void;
  };
};
export let workspaceProbe: WorkspaceProbe | undefined;
export function installWorkspaceProbe(value: WorkspaceProbe | undefined) {workspaceProbe = value;}

export function useCollectionProbe(scope: string, inspect: () => Record<string, unknown>, move: (pixels: number) => void) {
  const latest = useRef({inspect, move}); latest.current = {inspect, move};
  useEffect(() => {
    const probe = workspaceProbe;
    if (!probe || probe.target !== scope) return;
    const surface = {inspect: () => ({kind: 'list', ...latest.current.inspect()}), move: (pixels: number) => latest.current.move(pixels)};
    probe.surface = surface;
    return () => {if (probe.surface === surface) delete probe.surface;};
  }, [scope]);
}
