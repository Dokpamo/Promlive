import {Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatIcon} from './ChatIcon';
import {chatAvatarColor} from './chatAppearance';
import {headerScale} from '../../layout/metrics';
import {useAppearance} from '../appearance/AppAppearance';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';

export function ChatHeader({width, title, conversationId, openHistory, openSettings, onBack}: {
  width: number; title: string; conversationId: string; openHistory: () => void; openSettings: () => void; onBack?: () => void;
}) {
  const {colors: c} = useAppearance();
  const s = headerScale(width), insets = useSafeAreaInsets();
  return <ScreenHeader width={width} topInset={insets.top} testID="chat-header">
    <HeaderButton width={width} testID="chat-header-back" icon="back" label={onBack ? '채팅 목록으로 돌아가기' : '카드 목록 열기'} onPress={onBack ?? openHistory}/>
    <View testID="chat-header-title" style={{flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
      <View accessible={false} style={{width: 48 * s, height: 48 * s, borderRadius: 24 * s, backgroundColor: chatAvatarColor(conversationId), alignItems: 'center', justifyContent: 'center'}}>
        <ChatIcon name="chat" size={26 * s} color="#FFFFFF"/>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{flex: 1, color: c.text, fontSize: 28 * s, lineHeight: 38 * s, fontWeight: '600', includeFontPadding: false}}>{title}</Text>
    </View>
    <View testID="chat-header-actions" style={{flexDirection: 'row'}}>
      <HeaderButton width={width} testID="chat-header-search" icon="search" label="채팅 목록 열기" onPress={openHistory}/>
      <HeaderButton width={width} testID="chat-header-settings" icon="more" label="설정 열기" onPress={openSettings}/>
    </View>
  </ScreenHeader>;
}
