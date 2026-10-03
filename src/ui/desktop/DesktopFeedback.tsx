import {useEffect, useState, type ReactNode} from 'react';
import {Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type TextStyle, type ViewProps, type ViewStyle} from 'react-native';
import {useDesktopPane} from './DesktopPane';
import {usePalette} from '../Theme';

/** Hover never changes selection and never responds on the mobile shell. */
export function useDesktopHover(disabled = false, enabled?: boolean) {
  const pane = useDesktopPane();
  const desktop = enabled ?? (Platform.OS === 'macos' || Platform.OS === 'windows' || (Platform.OS === 'web' && !!pane));
  const [inside, setInside] = useState(false);
  useEffect(() => {if (disabled || !desktop) setInside(false);}, [disabled, desktop]);
  return {desktop, hovered: desktop && !disabled && inside,
    events: desktop && !disabled ? {onHoverIn: () => setInside(true), onHoverOut: () => setInside(false)} : {}};
}

/** Plain containers stay plain on touch screens; only PC needs a hover target. */
export function HoverSurface({children, ...props}: Omit<ViewProps, 'children'> & {children: (hovered: boolean) => ReactNode}) {
  const {desktop} = useDesktopHover();
  return desktop ? <HoverPressable {...props} accessible={false} focusable={false} feedback="none">{children}</HoverPressable>
    : <View {...props}>{children(false)}</View>;
}

export function FieldOutline({focused, hovered, radius = 14, testID}: {focused: boolean; hovered: boolean; radius?: ViewStyle['borderRadius']; testID?: string | undefined}) {
  const colors = usePalette();
  return <View testID={testID} pointerEvents="none" accessible={false} aria-hidden style={[StyleSheet.absoluteFill,
    {borderRadius: radius, borderWidth: 1, borderColor: focused ? colors.foreground : hovered ? colors.secondaryForeground : 'transparent'}]}/>;
}

export const desktopInputProps = (desktop: boolean, multiline?: boolean) => ({
  ...(desktop && Platform.OS !== 'web' ? {enableFocusRing: false} : {}),
  ...(!multiline ? {numberOfLines: 1, scrollEnabled: true} : {}),
});
export const desktopInputStyle = (desktop: boolean): TextStyle | undefined =>
  desktop && Platform.OS === 'web' ? {outlineWidth: 0} : undefined;

type HoverProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>; children: ReactNode | ((hovered: boolean) => ReactNode);
  feedback?: 'background' | 'border' | 'none'; selected?: boolean; desktop?: boolean;
  outlineInset?: number;
};
export function HoverPressable({style, children, feedback = 'background', selected = false, disabled, desktop, outlineInset = 0, ...props}: HoverProps) {
  const colors = usePalette(), hover = useDesktopHover(!!disabled || selected, desktop);
  const radius = StyleSheet.flatten(style)?.borderRadius ?? 12;
  return <Pressable {...props} disabled={disabled} {...hover.events}
    style={[style, hover.hovered && feedback === 'background' && {backgroundColor: colors.surface}]}>
    {typeof children === 'function' ? children(hover.hovered) : children}
    {feedback === 'border' && <View testID={props.testID ? `${props.testID}-hover` : undefined} pointerEvents="none" accessible={false} aria-hidden
      style={[StyleSheet.absoluteFill, {top: outlineInset, left: outlineInset, right: outlineInset, bottom: outlineInset, borderWidth: 1, borderRadius: radius,
        borderColor: hover.hovered ? colors.secondaryForeground : 'transparent'}]}/>}
  </Pressable>;
}
