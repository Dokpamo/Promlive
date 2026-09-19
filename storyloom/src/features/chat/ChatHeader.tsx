import {Pressable, Text, View} from 'react-native';
import {ChatIcon} from './ChatIcon';
import {chatAvatarColor, chatColors as c, referenceHeader as r} from './chatAppearance';

export function ChatHeader({width, title, conversationId, openHistory, openSettings}: {
  width: number;
  title: string;
  conversationId: string;
  openHistory: () => void;
  openSettings: () => void;
}) {
  const s = (width > 600 ? 412 : width) / r.viewportWidth;
  const height = r.height * s;
  return <View testID="chat-header" style={{height: 96 * s, flexDirection: 'row', alignItems: 'flex-start', paddingTop: r.top * s, paddingLeft: r.left * s, paddingRight: r.right * s, gap: r.gap * s}}>
    <Pressable testID="chat-header-back" accessibilityRole="button" accessibilityLabel="채팅 목록으로 돌아가기" onPress={openHistory} style={({pressed}) => ({width: r.back * s, height, marginRight: (r.backGap - r.gap) * s, borderRadius: height / 2, backgroundColor: pressed ? '#333333' : c.header, alignItems: 'center', justifyContent: 'center'})}>
      <ChatIcon name="back" size={32 * s} color="#FAFAFA"/>
    </Pressable>
    <View testID="chat-header-title" style={{flex: 1, minWidth: 0, height, borderRadius: height / 2, overflow: 'hidden', borderWidth: s, borderColor: c.headerBorder, backgroundColor: c.header, justifyContent: 'center'}}>
      <View accessible={false} style={{position: 'absolute', left: (r.avatarInset - 1) * s, top: (r.avatarInset - 1) * s, width: r.avatar * s, height: r.avatar * s, borderRadius: r.avatar * s / 2, backgroundColor: chatAvatarColor(conversationId), alignItems: 'center', justifyContent: 'center'}}>
        <ChatIcon name="chat" size={35 * s} color="#FFFFFF"/>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{marginLeft: (r.titleInset - 1) * s, marginRight: 16 * s, color: c.text, fontSize: r.titleFont * s, lineHeight: 40 * s, fontWeight: '700', includeFontPadding: false}}>{title}</Text>
    </View>
    <View testID="chat-header-actions" style={{width: r.actions * s, height, flexDirection: 'row', paddingHorizontal: (r.actionInset - 1) * s, borderRadius: height / 2, borderWidth: s, borderColor: c.headerBorder, overflow: 'hidden', backgroundColor: c.header}}>
      <Pressable testID="chat-header-search" accessibilityRole="button" accessibilityLabel="채팅 검색" onPress={openHistory} style={({pressed}) => ({width: r.action * s, height: height - 2 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#383838' : 'transparent'})}>
        <ChatIcon name="search" size={32 * s} color={c.text}/>
      </Pressable>
      <Pressable testID="chat-header-settings" accessibilityRole="button" accessibilityLabel="설정 열기" onPress={openSettings} style={({pressed}) => ({width: r.action * s, height: height - 2 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#383838' : 'transparent'})}>
        <ChatIcon name="more" size={27 * s} color={c.text}/>
      </Pressable>
    </View>
  </View>;
}
