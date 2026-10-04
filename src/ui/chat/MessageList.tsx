import {createContext, forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, type MutableRefObject} from 'react';
import {Animated, Platform, ScrollView, View, type FlatList, type FlatListProps, type LayoutChangeEvent, type LayoutRectangle, type ScrollViewProps} from 'react-native';
import type {ChatMessage} from '../../features/workspace/model';
import type {ListScrollHandle} from '../workspace/useListScroll';
import {workspaceProbe} from '../workspace/probe';

export const CellLayout = createContext<MutableRefObject<(id: string, layout: LayoutRectangle) => void> | null>(null);
export const nativeMessageAnchoring = Platform.OS === 'ios' || Platform.OS === 'android';
export function ManualAnchorScroll({maintainVisibleContentPosition: _position, ...props}: ScrollViewProps) {
  return <ScrollView {...props}/>;
}
type MessageCellProps = {children?: import('react').ReactNode; item: ChatMessage; onLayout?: ((event: LayoutChangeEvent) => void) | undefined; style?: import('react-native').StyleProp<import('react-native').ViewStyle>};
export function MessageCell({children, item, onLayout, style}: MessageCellProps) {
  const layout = useContext(CellLayout);
  const ref = useRef<View>(null);
  useEffect(() => {
    const probe = workspaceProbe;
    if (!probe) return;
    probe.mounted.add(item.id);
    return () => {probe.mounted.delete(item.id);};
  }, [item.id]);
  useLayoutEffect(() => {
    // RN Web's ResizeObserver reports size, not a same-sized cell moving after
    // a prepend. Read its new parent-relative position once after the commit.
    if (nativeMessageAnchoring) return;
    ref.current?.measure((x, y, width, height) => layout?.current(item.id, {x, y, width, height}));
  });
  return <View ref={ref} style={style} onLayout={event => {onLayout?.(event); layout?.current(item.id, event.nativeEvent.layout);}}>{children}</View>;
}

// The storage window already bounds message bodies. On iOS a second virtual
// window can replace UIKit's native anchor with a spacer during a fling.
export interface MessageListHandle extends ListScrollHandle {
  scrollToEnd(options?: {animated?: boolean}): void;
}
type Props = Omit<FlatListProps<ChatMessage>, 'data'> & {data: readonly ChatMessage[]; bounded: boolean};
export const MessageList = forwardRef<MessageListHandle, Props>(function MessageList({bounded, ...props}, ref) {
  const list = useRef<FlatList<ChatMessage>>(null), native = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({offset, animated}) => bounded ? native.current?.scrollTo({y: offset, animated}) : list.current?.scrollToOffset({offset, animated}),
    scrollToEnd: options => bounded ? native.current?.scrollToEnd(options) : list.current?.scrollToEnd(options),
    getScrollResponder: () => bounded ? native.current : list.current?.getScrollResponder(),
  }), [bounded]);
  if (!bounded) return <Animated.FlatList {...props} ref={list}/>;
  const {data, renderItem, keyExtractor, CellRendererComponent: _cell, initialNumToRender: _initial,
    maxToRenderPerBatch: _batch, windowSize: _window, renderScrollComponent: _renderScroll, ...scrollProps} = props;
  return <Animated.ScrollView {...scrollProps} ref={native}>
    {data.map((item, index) => <MessageCell key={keyExtractor?.(item, index) ?? item.id} item={item}>
      {renderItem?.({item, index, separators: {highlight() {}, unhighlight() {}, updateProps() {}}})}
    </MessageCell>)}
  </Animated.ScrollView>;
});
