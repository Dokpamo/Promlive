import {Text, View} from 'react-native';
import {ChatIcon} from './ChatIcon';
import {chatAvatarColor, headerScale, referenceHeader as r, referenceTypography, typographyScale} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {HeaderButton, HeaderCapsule, ScreenHeader} from '../../layout/ScreenHeader';

export function ChatHeader({width, title, conversationId, openHistory, openSettings}: {
  width: number;
  title: string;
  conversationId: string;
  openHistory: () => void;
  openSettings: () => void;
}) {
  const {colors: c} = useAppearance();
  const s = headerScale(width);
  const titleScale = typographyScale(width);
  return <ScreenHeader width={width} testID="chat-header">
    <HeaderButton width={width} testID="chat-header-back" icon="back" label="카드 목록 열기" onPress={openHistory}/>
    <HeaderCapsule width={width} testID="chat-header-title" style={{flex: 1, minWidth: 0, justifyContent: 'center'}}>
      <View accessible={false} style={{position: 'absolute', left: r.avatarInset * s, top: r.avatarInset * s, width: r.avatar * s, height: r.avatar * s, borderRadius: r.avatar * s / 2, backgroundColor: chatAvatarColor(conversationId), alignItems: 'center', justifyContent: 'center'}}>
        <ChatIcon name="chat" size={r.icon * s} color="#FFFFFF"/>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{marginLeft: r.titleInset * s, marginRight: 16 * s, color: c.text, fontSize: r.titleFont * titleScale, lineHeight: referenceTypography.titleLineHeight * titleScale, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
    </HeaderCapsule>
    <HeaderCapsule width={width} testID="chat-header-actions" style={{width: r.actions * s, flexDirection: 'row', paddingHorizontal: r.actionInset * s}}>
      <HeaderButton width={width} testID="chat-header-search" icon="search" label="카드 검색 열기" onPress={openHistory} grouped/>
      <HeaderButton width={width} testID="chat-header-settings" icon="more" label="설정 열기" onPress={openSettings} grouped/>
    </HeaderCapsule>
  </ScreenHeader>;
}
