import {useRef} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary} from '../../layout/SwipeBackModal';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon} from '../settings/SettingsIcon';
import type {PersonaFolder} from './personaPreferences';

/** Keep the current folder visible while allowing horizontal travel through its ancestors. */
export function PersonaBreadcrumbs({path, scale: s, onNavigate, labelPrefix = '', testID = 'persona-folder-path', disabled = false}: {
  path: PersonaFolder[]; scale: number; onNavigate: (id: string | null) => void;
  labelPrefix?: string; testID?: string; disabled?: boolean;
}) {
  const {colors: c} = useAppearance();
  const scroll = useRef<ScrollView>(null);
  const crumbs = [{id: null, name: '페르소나'}, ...path];
  return <SwipeBackBoundary>
    <ScrollView ref={scroll} horizontal testID={testID} showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scroll.current?.scrollToEnd({animated: false})}
      contentContainerStyle={{alignItems: 'center', minHeight: 64 * s}}>
      {crumbs.map((item, index) => <View key={item.id ?? 'root'} style={{flexDirection: 'row', alignItems: 'center'}}>
        {index > 0 && <SettingsIcon name="chevron" size={18 * s} color={c.muted}/>}
        <RowPressable accessibilityRole="button" accessibilityLabel={`${labelPrefix}${item.name} 경로`} accessibilityState={{selected: index === crumbs.length - 1}} disabled={disabled}
          onPress={() => onNavigate(item.id)} radius={20 * s} contentStyle={{paddingHorizontal: 12 * s, paddingVertical: 16 * s}}>
          <Text numberOfLines={1} style={{color: index === crumbs.length - 1 ? c.text : c.muted, fontSize: 23 * s}}>{item.name}</Text>
        </RowPressable>
      </View>)}
    </ScrollView>
  </SwipeBackBoundary>;
}
