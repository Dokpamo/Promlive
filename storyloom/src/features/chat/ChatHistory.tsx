import {useState} from 'react';
import {FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Conversation} from './model';
import {ChatIcon} from './ChatIcon';
import {chatAvatarColor, chatColors as c} from './chatAppearance';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';

function conversationTime(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    const hour = date.getHours();
    return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function ChatHistory({workspace: w, close, openSettings}: {workspace: Workspace; close: () => void; openSettings: () => void}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const query = search.trim().toLocaleLowerCase();
  const items = w.conversations.filter(item => `${item.title} ${item.preview ?? ''}`.toLocaleLowerCase().includes(query));
  const dismiss = () => {Keyboard.dismiss(); close();};

  return <View style={[styles.drawer, {paddingTop: insets.top + 21, paddingBottom: insets.bottom}]}>
    <Text accessibilityRole="header" style={styles.brand}>Promlive</Text>
    <DrawerGestureBoundary>
      <View style={styles.search}>
        <ChatIcon name="search" size={19} color="#999999"/>
        <TextInput accessibilityLabel="채팅 내역 검색" value={search} onChangeText={setSearch} placeholder="대화 검색" placeholderTextColor="#929292" selectionColor="#3096EB" underlineColorAndroid="transparent" returnKeyType="search" style={styles.searchInput}/>
      </View>
    </DrawerGestureBoundary>
    <FlatList
      testID="chat-history-list"
      data={items}
      keyExtractor={item => item.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListEmptyComponent={<Text style={styles.empty}>{query ? '검색 결과가 없어요.' : '아직 나눈 대화가 없어요.'}</Text>}
      renderItem={({item}) => <HistoryRow conversation={item} selected={item.id === w.conversation?.id} open={() => {
        dismiss();
        void w.openConversation(item).catch(error => w.report(error));
      }}/>}
    />
    <View style={styles.account}>
      <View accessible={false} style={styles.userAvatar}><ChatIcon name="user" size={22} color="#E1D8CC"/></View>
      <Text numberOfLines={1} style={styles.userName}>사용자</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="설정" onPress={openSettings} style={({pressed}) => [styles.settings, {opacity: pressed ? 0.6 : 1}]}>
        <ChatIcon name="settings" size={23} color="#CBCBCB"/>
      </Pressable>
    </View>
  </View>;
}

function HistoryRow({conversation: item, selected, open}: {conversation: Conversation; selected: boolean; open: () => void}) {
  const preview = item.preview?.replace(/\s+/g, ' ').trim() || '아직 메시지가 없어요.';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 열기`} accessibilityHint={preview} accessibilityState={{selected}} onPress={open} style={({pressed}) => [styles.row, {backgroundColor: pressed ? c.historyPressed : selected ? c.historySelected : 'transparent'}]}>
    <View accessible={false} style={[styles.avatar, {backgroundColor: chatAvatarColor(item.id)}]}><ChatIcon name="chat" size={25} color="#FFFFFF"/></View>
    <View style={styles.conversation}>
      <View style={styles.titleLine}>
        <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{conversationTime(item.updatedAt)}</Text>
      </View>
      <Text numberOfLines={1} style={styles.preview}>{preview}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  drawer: {flex: 1, backgroundColor: c.drawer},
  brand: {fontSize: 27, fontWeight: '700', letterSpacing: -0.6, color: '#F3F3F3', marginLeft: 23, marginBottom: 24},
  search: {flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: 46, marginHorizontal: 12, paddingHorizontal: 18, borderRadius: 28, backgroundColor: '#262626'},
  searchInput: {flex: 1, minWidth: 0, minHeight: 46, padding: 0, fontSize: 16, color: c.text},
  list: {flex: 1, marginTop: 16},
  listContent: {paddingHorizontal: 4, paddingBottom: 12},
  empty: {paddingHorizontal: 20, paddingVertical: 28, color: c.muted, fontSize: 14},
  row: {flexDirection: 'row', alignItems: 'center', minHeight: 82, paddingHorizontal: 9, paddingVertical: 12, gap: 13, borderRadius: 20, overflow: 'hidden'},
  avatar: {width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center'},
  conversation: {flex: 1, minWidth: 0, gap: 7},
  titleLine: {flexDirection: 'row', alignItems: 'center', gap: 9},
  title: {flex: 1, color: '#EFEFEF', fontSize: 17, fontWeight: '600'},
  time: {fontSize: 11, color: '#929292'},
  preview: {fontSize: 15, color: '#969696', lineHeight: 21},
  account: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#303030', paddingHorizontal: 18, paddingVertical: 14},
  userAvatar: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#494137', alignItems: 'center', justifyContent: 'center'},
  userName: {flex: 1, fontSize: 16, fontWeight: '500', color: '#E6E6E6'},
  settings: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
});
