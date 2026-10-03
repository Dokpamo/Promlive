import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Keyboard, Platform, ScrollView, View} from 'react-native';
import {DesktopPane, useDesktopPane} from '../desktop/DesktopPane';
import {usePalette} from '../Theme';
import {useReducedMotion} from '../useReducedMotion';
import {SettingsFocusContext, type SettingsNavigation, type SettingsRender} from './controls';

type Entry = {id: number; render: SettingsRender};

/** Parent settings stay editable; each drill-down opens the column to its right. */
export function DesktopSettingsNavigator({renderRoot, onClose, scale}: {
  renderRoot: SettingsRender; onClose: () => void; scale: number;
}) {
  const pane = useDesktopPane()!, colors = usePalette(), reducedMotion = useReducedMotion();
  const nextId = useRef(0), blocked = useRef(new Set<number>());
  const [stack, setStack] = useState<Entry[]>(() => [{id: 0, render: renderRoot}]);
  const scroll = useRef<ScrollView>(null), reveal = useRef(false), contentWidth = useRef(0);
  const width = stack.length === 1 ? Math.min(760, pane.width)
    : Math.min(560, Math.max(Math.min(360, pane.width), (pane.width - 1) / 2));
  const revealRight = useCallback(() => {
    const expected = Math.max(pane.width, width * stack.length + stack.length - 1);
    if (!reveal.current || Math.abs(contentWidth.current - expected) > 1) return;
    reveal.current = false;
    scroll.current?.scrollToEnd({animated: !reducedMotion});
  }, [pane.width, width, stack.length, reducedMotion]);
  // A replacement branch can have the same width, so no size event will fire.
  // New columns wait for their native layout before scrolling to the right.
  useLayoutEffect(revealRight, [stack, revealRight]);
  const canRemove = useCallback((entries: Entry[]) => !entries.some(entry => blocked.current.has(entry.id)), []);
  const back = useCallback((index: number) => {
    if (!canRemove(stack.slice(index))) return;
    Keyboard.dismiss();
    for (const entry of stack.slice(index)) blocked.current.delete(entry.id);
    if (index === 0) onClose(); else setStack(old => old.slice(0, index));
  }, [stack, canRemove, onClose]);
  const push = (index: number, render: SettingsRender) => {
    if (!canRemove(stack.slice(index + 1))) return;
    Keyboard.dismiss();
    reveal.current = true;
    for (const entry of stack.slice(index + 1)) blocked.current.delete(entry.id);
    setStack(old => [...old.slice(0, index + 1), {id: ++nextId.current, render}]);
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); back(stack.length - 1);}
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [back, stack.length]);
  return <ScrollView ref={scroll} horizontal testID="ui-desktop-settings-columns" style={{flex: 1, minHeight: 0}}
    contentContainerStyle={{minWidth: pane.width, flexGrow: 1, justifyContent: stack.length === 1 ? 'center' : 'flex-start'}}
    showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}
    onContentSizeChange={value => {contentWidth.current = value; revealRight();}}>
    {stack.map((entry, index) => <View key={entry.id} testID={`ui-desktop-settings-column-${entry.id}`}
      style={{width: width + (index ? 1 : 0), height: pane.height, flexDirection: 'row'}}>
      {index > 0 && <View style={{width: 1, backgroundColor: colors.separator}}/>}
      <DesktopPane width={width} height={pane.height}>
        <DesktopEntry render={entry.render} nav={{back: () => back(index), push: render => push(index, render), scale, bottomInset: 0,
          blockBack: value => {if (value) blocked.current.add(entry.id); else blocked.current.delete(entry.id);}}}/>
      </DesktopPane>
    </View>)}
  </ScrollView>;
}

function DesktopEntry({render, nav}: {render: SettingsRender; nav: SettingsNavigation}) {
  const [, setFocused] = useState(false);
  return <SettingsFocusContext.Provider value={setFocused}>{render(nav)}</SettingsFocusContext.Provider>;
}
