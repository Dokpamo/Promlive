import {memo, useMemo} from 'react';
import {Text, View} from 'react-native';
import type {Message} from './model';
import {composerScale, referenceMessage as r, typographyScale} from './chatAppearance';
import {referenceTypography} from '../../layout/metrics';
import {useAppearance} from '../appearance/AppAppearance';

/** Display modes change only presentation; all modes use the same message and status. */
export const ChatMessage = memo(function ChatMessage({message, width}: {message: Message; width: number}) {
  const {colors: c, chatDisplay} = useAppearance();
  const s = composerScale(width);
  const textScale = typographyScale(width);
  const mine = message.role === 'user';
  const bubble = chatDisplay === 'chat' || (chatDisplay === 'default' && mine);
  const right = bubble && mine;
  const content = message.content || '···';
  const paragraphs = useMemo(() => mine ? [content] : content.split(/\r?\n[\t ]*\r?\n/), [content, mine]);
  const state = {pending: '응답 준비 중', generating: '작성 중…', completed: '', cancelled: '생성 중단됨', failed: '생성 실패', interrupted: '이전 실행에서 중단됨'}[message.status];
  return <View testID={`chat-message-${message.id}`} style={{alignItems: right ? 'flex-end' : 'flex-start', marginBottom: r.messageGap * s, gap: 10 * s}}>
    <View testID={`message-surface-${message.id}`} style={bubble ? {
      maxWidth: `${r.bubbleWidth / (r.viewportWidth - 2 * r.inset) * 100}%`,
      paddingHorizontal: r.bubbleInset * s, paddingVertical: r.bubbleVerticalInset * s,
      borderRadius: r.bubbleRadius * s, backgroundColor: c.bubble,
    } : {width: '100%'}}>
      {paragraphs.map((paragraph, index) => <Text key={index} testID={`message-text-${message.id}-${index}`} selectable style={{color: c.text, fontSize: referenceTypography.titleFontSize * textScale, lineHeight: r.lineHeight * textScale, fontWeight: referenceTypography.titleWeight, includeFontPadding: false, marginTop: index ? r.paragraphGap * textScale : 0}}>{paragraph}</Text>)}
    </View>
    {mine && message.requestId === null && <Text style={{fontSize: 16 * s, lineHeight: 24 * s, color: c.placeholder, paddingHorizontal: bubble ? 5 * s : 0}}>기기에만 저장됨</Text>}
    {state ? <Text style={{fontSize: 16 * s, lineHeight: 24 * s, color: c.muted}}>{state}</Text> : null}
    {message.error && <Text style={{fontSize: 18 * s, lineHeight: 28 * s, color: c.error}}>{message.error}</Text>}
  </View>;
});
