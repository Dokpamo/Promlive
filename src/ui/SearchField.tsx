import {useRef, useState, type RefObject} from 'react';
import {Platform, TextInput, View} from 'react-native';
import {usePalette} from './Theme';
import {Icon} from './Icon';
import {useDesktopPane} from './desktop/DesktopPane';
import {FieldOutline, HoverPressable, HoverSurface, desktopInputProps, desktopInputStyle} from './desktop/DesktopFeedback';

export type SearchScope = 'library' | 'chats' | 'create' | 'persona';
type Props = {
  scope: SearchScope; query: string; onQueryChange: (query: string) => void; onClose: () => void;
  inputRef?: RefObject<TextInput | null>; editable?: boolean; showOutline?: boolean; onFocus?: () => void; onBlur?: () => void; onLayout?: () => void;
};

/** Text sits above the independently animated header surface, without scaling or reflow. */
export function SearchField({scope, query, onQueryChange, onClose, inputRef, editable = true, showOutline = true, onFocus, onBlur, onLayout}: Props) {
  const colors = usePalette(), desktop = useDesktopPane(), ownRef = useRef<TextInput>(null);
  const ref = inputRef ?? ownRef;
  const [focused, setFocused] = useState(false);
  const height = desktop ? 40 : 44, radius = desktop ? 12 : 14;
  const label = scope === 'library' ? '카드 검색' : scope === 'chats' ? '채팅 검색' : scope === 'persona' ? '페르소나 검색' : '제작물 검색';
  return <HoverSurface style={{flex: 1, height, borderRadius: radius}}>{hovered => <>
    <View style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
      <TextInput ref={ref} testID={scope === 'persona' ? 'ui-persona-search' : `ui-${scope}-search-input`}
        {...(onLayout ? {onLayout} : {})}
        accessibilityLabel={scope === 'persona' ? label : `${label}어`} editable={editable}
        {...desktopInputProps(!!desktop)} onFocus={() => {setFocused(true); onFocus?.();}} onBlur={() => {setFocused(false); onBlur?.();}}
        onKeyPress={event => {if (event.nativeEvent.key === 'Escape') {event.preventDefault(); onClose();}}}
        value={query} onChangeText={onQueryChange} placeholder={label} placeholderTextColor={colors.secondaryForeground}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" underlineColorAndroid="transparent" textAlignVertical="center"
        style={[{flex: 1, minWidth: 0, height, paddingLeft: 14, paddingRight: 0, paddingVertical: 0,
          fontSize: desktop ? 14 : 16, color: colors.foreground, includeFontPadding: false,
          ...(desktop && Platform.OS === 'macos' ? {fontFamily: 'Apple SD Gothic Neo'} : {})}, desktopInputStyle(!!desktop || Platform.OS === 'web')]}/>
      <HoverPressable accessibilityRole="button" accessibilityLabel="검색어 지우기" disabled={!query || !editable}
        aria-hidden={!query} accessibilityElementsHidden={!query} importantForAccessibility={query ? 'auto' : 'no-hide-descendants'}
        onPress={() => {onQueryChange(''); ref.current?.focus();}}
        style={{width: height, height, borderRadius: radius, opacity: query ? 1 : 0, alignItems: 'center', justifyContent: 'center'}}>
        <Icon name="close" size={18}/>
      </HoverPressable>
    </View>
    {!!desktop && showOutline && <FieldOutline focused={focused} hovered={hovered} radius={radius} testID={`ui-${scope}-search-outline`}/>}
  </>}</HoverSurface>;
}
