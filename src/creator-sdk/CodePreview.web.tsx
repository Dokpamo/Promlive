import {useEffect, useRef, useState} from 'react';
import type {Card} from '../features/cards/model';
import {cardContext, newId} from '../features/cards/model';
import type {Runtime} from '../app/runtime';
import {CreatorHost} from './protocol';
import {sandboxDocument} from './document';
import {View, Text} from 'react-native';
import {colors, styles} from '../layout/theme';
export function CodePreview({card, runtime, allowed}: {card: Card; runtime: Runtime; allowed: boolean}) {
  const iframe = useRef<HTMLIFrameElement>(null); const [error, setError] = useState('');
  const [instance] = useState(() => newId('sandbox'));
  const [host] = useState(() => new CreatorHost(instance, runtime.creation.coordinator, allowed, cardContext(card)));
  useEffect(() => {
    const listener = (event: MessageEvent<unknown>) => {
      if (event.source !== iframe.current?.contentWindow) return;
      const data = event.data as {type?: string; instance?: string; text?: string};
      if (data?.type === 'runtime-error' && data.instance === instance) { setError(String(data.text).slice(0, 300)); return; }
      void host.handle(data).then(response => {if(response) iframe.current?.contentWindow?.postMessage(response, '*');}).catch(() => setError('실행 요청을 처리하지 못했어요.'));
    };
    window.addEventListener('message', listener);
    return () => { window.removeEventListener('message', listener); host.dispose(); };
  }, [host, instance]);
  if (card.body.kind !== 'code') return null;
  return <View style={{height: 420, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden'}}>{error && <Text style={[styles.small, {padding: 12, color: colors.danger}]}>{error}</Text>}<iframe ref={iframe} title="코드 카드 실행 화면" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={sandboxDocument(card.body.source, instance)} style={{flex: 1, border: 0, width: '100%', background: '#FFF'}}/></View>;
}
