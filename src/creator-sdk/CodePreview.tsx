import {useEffect, useRef, useState} from 'react';
import {View, Text} from 'react-native';
import WebView from 'react-native-webview';
import {cardContext, newId, type Card} from '../features/cards/model';
import type {Runtime} from '../app/runtime';
import {CreatorHost} from './protocol';
import {sandboxDocument} from './document';
import {colors, styles} from '../layout/theme';
export function CodePreview({card, runtime, allowed}: {card: Card; runtime: Runtime; allowed: boolean}) {
  const view = useRef<WebView<object>>(null); const [error, setError] = useState('');
  const [instance] = useState(() => newId('sandbox'));
  const [host] = useState(() => new CreatorHost(instance, runtime.creation.coordinator, allowed, cardContext(card)));
  useEffect(() => () => host.dispose(), [host]);
  if (card.body.kind !== 'code') return null;
  return <View style={{height: 420, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden'}}>{error && <Text style={[styles.small, {padding: 12, color: colors.danger}]}>{error}</Text>}<WebView<object> ref={view} source={{html: sandboxDocument(card.body.source, instance), baseUrl: 'about:blank'}} originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'} javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false} allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} incognito onMessage={event => {
    if (event.nativeEvent.data.length > 16000) return;
    try {
      const data: unknown = JSON.parse(event.nativeEvent.data);
      if (typeof data === 'object' && data && 'type' in data && data.type === 'runtime-error' && 'text' in data) {setError(String(data.text).slice(0, 300)); return;}
      void host.handle(data).then(response => {if (response) view.current?.injectJavaScript(`window.__creatorReceive(${JSON.stringify(response).replace(/</g, '\\u003c')});true;`);}).catch(() => setError('실행 요청을 처리하지 못했어요.'));
    } catch { setError('잘못된 실행 요청입니다.'); }
  }} onContentProcessDidTerminate={() => {host.dispose(); setError('실행 프로세스가 종료되었습니다. 다시 실행해 주세요.');}}/></View>;
}
