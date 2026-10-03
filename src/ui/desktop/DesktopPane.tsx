import {createContext, useContext, type ReactNode} from 'react';
import {View} from 'react-native';

type PaneSize = {width: number; height: number};
const Context = createContext<PaneSize | null>(null);
export const useDesktopPane = () => useContext(Context);

/** Nested screens measure their own pane, not the entire desktop window. */
export function DesktopPane({width, height, children, testID}: PaneSize & {children: ReactNode; testID?: string}) {
  return <Context.Provider value={{width, height}}><View testID={testID}
    style={{width, flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden'}}>{children}</View></Context.Provider>;
}
