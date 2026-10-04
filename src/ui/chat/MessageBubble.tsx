import {memo} from 'react';
import {Text, View, type LayoutChangeEvent} from 'react-native';
import type {ChatMessage} from '../../features/workspace/model';
import {usePalette} from '../Theme';
import {PreviewArtwork} from '../PreviewArtwork';
import {useDesktopPane} from '../desktop/DesktopPane';
import {desktopMetrics} from '../desktop/desktopMetrics';
import {useChatStyles} from './styles';

export const MessageBubble = memo(function MessageBubble({message, group, width, height, ghost = false, onLayout}: {message: ChatMessage; group: {before: boolean; after: boolean};
  width?: number; height?: number; ghost?: boolean; onLayout?: (event: LayoutChangeEvent) => void}) {
  const styles = useChatStyles(), colors = usePalette(), outgoing = message.role === 'user', desktop = useDesktopPane();
  return <View onLayout={onLayout} style={[styles.bubble, desktop && {paddingHorizontal: 13, paddingVertical: 9}, {backgroundColor: outgoing ? colors.selectedBackground : colors.surface},
    width === undefined ? {} : {width, maxWidth: '100%'},
    height === undefined ? {} : {height},
    outgoing ? {borderTopRightRadius: group.before ? 6 : 24, borderBottomRightRadius: group.after ? 6 : 24}
      : {borderTopLeftRadius: group.before ? 6 : 24, borderBottomLeftRadius: group.after ? 6 : 24}]}>
    {message.image && <View style={styles.messageImage}><PreviewArtwork tile={message.image.tile} width={200} height={160}/></View>}
    {!!message.text && <Text selectable={!ghost} textBreakStrategy="simple" android_hyphenationFrequency="none"
      style={[styles.messageText, desktop && desktopMetrics.conversation, {color: outgoing ? colors.selectedForeground : colors.foreground}]}>{message.text}</Text>}
  </View>;
}, (a, b) => a.message === b.message && a.group.before === b.group.before && a.group.after === b.group.after &&
  a.width === b.width && a.height === b.height && a.ghost === b.ghost);
