import {usePalette, themedStyles} from './Theme';
import {Pressable, Text, TextInput, View} from 'react-native';
import {Icon} from './Icon';
import {useDesktopPane} from './desktop/DesktopPane';
import {desktopMetrics} from './desktop/desktopMetrics';

type Props = {
  scope: 'library' | 'chats' | 'create';
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  autoFocus?: boolean;
};

export function SearchField({scope, query, onQueryChange, onClose, autoFocus = true}: Props) {
  const colors = usePalette();
  const base = useStyles(), desktop = useDesktopPane();
  const styles = desktop ? {...base, field: {...base.field, minHeight: 40, borderRadius: 12},
    input: {...base.input, ...desktopMetrics.body, paddingVertical: 8}, cancelText: {...base.cancelText, fontSize: 14}} : base;
  const label = scope === 'library' ? '카드 검색' : scope === 'chats' ? '채팅 검색' : '제작물 검색';
  return <View testID={`ui-${scope}-search`} style={styles.row}>
    <View style={styles.field}>
      <Icon name="search" size={22}/>
      <TextInput testID={`ui-${scope}-search-input`} accessibilityLabel={`${label}어`} autoFocus={autoFocus}
        value={query} onChangeText={onQueryChange} placeholder={label} placeholderTextColor={colors.secondaryForeground}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" underlineColorAndroid="transparent"
        style={styles.input}/>
      {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기"
        onPress={() => onQueryChange('')} style={styles.clearButton}>
        <Icon name="close" size={18}/>
      </Pressable>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="검색 닫기" onPress={onClose} style={styles.cancelButton}>
      <Text style={styles.cancelText}>취소</Text>
    </Pressable>
  </View>;
}

const useStyles = themedStyles(colors => ({
  row: {flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, paddingTop: 4, paddingBottom: 16, gap: 4},
  field: {flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: 14, paddingLeft: 12, backgroundColor: colors.surface},
  input: {flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, fontSize: 16, color: colors.foreground},
  clearButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  cancelButton: {minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center'},
  cancelText: {fontSize: 15, color: colors.foreground},
}));
