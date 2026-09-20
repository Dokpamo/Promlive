import {Text, View} from 'react-native';
import {ChatIcon} from './ChatIcon';
import {chatAvatarColor, headerScale, referenceHeader as r, referenceTypography, typographyScale} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';

export function ChatHeader({width, title, conversationId, openHistory, openSettings}: {
  width: number;
  title: string;
  conversationId: string;
  openHistory: () => void;
  openSettings: () => void;
}) {
  const {colors: c, isDark} = useAppearance();
  const shadow = isDark ? undefined : '0px 8px 24px rgba(0, 0, 0, 0.035)';
  const s = headerScale(width);
  const titleScale = typographyScale(width);
  const height = r.height * s;
  return <ScreenHeader width={width} testID="chat-header">
    <HeaderButton width={width} testID="chat-header-back" icon="back" label="카드 목록 열기" onPress={openHistory} leading/>
    <View testID="chat-header-title" style={{flex: 1, minWidth: 0, height, borderRadius: height / 2, overflow: 'hidden', borderWidth: s, borderColor: c.headerBorder, backgroundColor: c.header, boxShadow: shadow, justifyContent: 'center'}}>
      <View accessible={false} style={{position: 'absolute', left: (r.avatarInset - 1) * s, top: (r.avatarInset - 1) * s, width: r.avatar * s, height: r.avatar * s, borderRadius: r.avatar * s / 2, backgroundColor: chatAvatarColor(conversationId), alignItems: 'center', justifyContent: 'center'}}>
        <ChatIcon name="chat" size={35 * s} color="#FFFFFF"/>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{marginLeft: (r.titleInset - 1) * s, marginRight: 16 * s, color: c.text, fontSize: r.titleFont * titleScale, lineHeight: referenceTypography.titleLineHeight * titleScale, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text>
    </View>
    <View testID="chat-header-actions" style={{width: r.actions * s, height, flexDirection: 'row', paddingHorizontal: (r.actionInset - 1) * s, borderRadius: height / 2, borderWidth: s, borderColor: c.headerBorder, overflow: 'hidden', backgroundColor: c.header, boxShadow: shadow}}>
      <HeaderButton width={width} testID="chat-header-search" icon="search" label="카드 검색 열기" onPress={openHistory} grouped/>
      <HeaderButton width={width} testID="chat-header-settings" icon="more" label="설정 열기" onPress={openSettings} grouped/>
    </View>
  </ScreenHeader>;
}
