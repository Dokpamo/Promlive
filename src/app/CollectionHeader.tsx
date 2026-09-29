import type {ReactNode, Ref} from 'react';
import {View, type TextInput} from 'react-native';
import {SearchField, ui, useDesign} from '../design/foundation';
import {MainHeaderButton, MainTabHeader} from './MainTabHeader';

export const collectionHeaderGeometry = {searchTop: 14, searchBottom: 24, categories: 84} as const;

/** Library and inbox share one fixed title, search and category layout. */
export function CollectionHeader({title, search, onSearch, actionLabel, onAction, onBack, categories, showSearch = true, inputRef, onFocus, onBlur, disabled = false}: {
  title: string; search: string; onSearch: (text: string) => void; actionLabel: string; onAction: () => void; onBack?: () => void;
  categories?: ReactNode; showSearch?: boolean; inputRef?: Ref<TextInput>; onFocus?: () => void; onBlur?: () => void; disabled?: boolean;
}) {
  const {s} = useDesign();
  return <>
    <MainTabHeader title={title} testID="main-tab-header" titleTestID="collection-title" {...(onBack ? {left: <MainHeaderButton icon="back" label="채팅 목록으로 돌아가기" onPress={onBack}/>} : {})}
      right={<MainHeaderButton testID="collection-add" icon={actionLabel.includes('채팅') ? 'compose' : 'plus'} label={actionLabel} disabled={disabled} onPress={onAction}/>}/>
    <View pointerEvents={disabled ? 'none' : 'auto'} aria-hidden={disabled} accessibilityElementsHidden={disabled} importantForAccessibility={disabled ? 'no-hide-descendants' : 'auto'}>
      {showSearch && <View style={{paddingHorizontal: ui.inset * s, paddingTop: collectionHeaderGeometry.searchTop * s, paddingBottom: collectionHeaderGeometry.searchBottom * s}}>
        <SearchField {...(inputRef ? {inputRef} : {})} testID="collection-search-input" label={`${title} 검색`} value={search} onChange={onSearch}
          {...(onFocus ? {onFocus} : {})} {...(onBlur ? {onBlur} : {})}/>
      </View>}
      {categories}
    </View>
  </>;
}
