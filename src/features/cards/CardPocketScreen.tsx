import {useEffect, useState, type ReactNode} from 'react';
import {ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScreenHeader, HeaderButton} from '../../layout/ScreenHeader';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {useAppearance} from '../appearance/AppAppearance';
import {defaultPocket, pocketValues, type CardPocket} from './pocket';
import type {Card} from './model';
import type {SceneState} from './experience';
import type {SceneStore} from './SceneControls';

export function PocketSurface({card, scene, pocket, close, edit, children, notice}: {
  card: Card | null; scene?: SceneState | null; pocket?: CardPocket; close: () => void;
  edit?: () => void; children?: ReactNode; notice?: string;
}) {
  const {width} = useWindowDimensions(), insets = useSafeAreaInsets(), s = headerScale(width);
  const {colors: c, settings: p} = useAppearance();
  const layout = pocket ?? (card ? card.pocket ?? defaultPocket(card) : null);
  const fields = card && layout ? pocketValues(card, layout, scene) : [];
  // ChatDrawer paints the shared canvas; a page background would cover the
  // neighboring composer's shadow while dragging across the page boundary.
  return <View testID="card-pocket" style={{flex: 1}}>
    <ScrollView testID="pocket-scroll" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{paddingHorizontal: 28 * s, paddingTop: insets.top + (referenceHeader.barHeight + 42) * s, paddingBottom: insets.bottom + 40 * s, gap: 24 * s, maxWidth: 800, width: '100%', alignSelf: 'center'}}>
      {children}
      {!!notice && <Text accessibilityLiveRegion="polite" style={{color: c.muted, fontSize: 23 * s, lineHeight: 34 * s}}>{notice}</Text>}
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 16 * s}}>
        {fields.map(field => <View key={field.id} testID={`pocket-field-${field.id}`} style={{width: layout?.template === 'tiles' ? '47%' : '100%', flexGrow: layout?.template === 'tiles' ? 1 : 0, borderRadius: 32 * s, paddingHorizontal: 26 * s, paddingVertical: 28 * s, backgroundColor: p.surface, gap: 12 * s}}>
          <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>{field.label}</Text>
          <Text style={{color: p.text, fontSize: 30 * s, lineHeight: 42 * s}}>{field.value}</Text>
        </View>)}
      </View>
    </ScrollView>
    <View pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: 0, right: 0}}>
      <ScreenHeader width={width} topInset={insets.top}>
        <HeaderButton icon="back" label="포켓에서 돌아가기" width={width} onPress={close}/>
        <View style={{flex: 1, height: referenceHeader.height * s, alignItems: 'center', justifyContent: 'center'}}><Text accessibilityRole="header" numberOfLines={1} style={{color: c.text, fontSize: 28 * s}}>{layout?.title ?? '포켓'}</Text></View>
        {edit ? <HeaderButton icon="settings" label="상태창 편집" width={width} onPress={edit}/> : <View style={{width: referenceHeader.height * s}}/>}
      </ScreenHeader>
    </View>
  </View>;
}

/** Read the room's pinned card version, rather than the latest library draft. */
export function ConversationPocket({store, roomId, close}: {store: SceneStore; roomId: string; close: () => void}) {
  const [data, setData] = useState<{card: Card | null; scene: SceneState | null} | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setData(null); setError('');
    void Promise.all([store.getConversationCard?.(roomId), store.getSceneState?.(roomId)]).then(([card, scene]) => {
      if (active) setData({card: card ?? null, scene: scene ?? null});
    }).catch(() => {if (active) setError('상태창을 불러오지 못했어요.');});
    return () => {active = false;};
  }, [store, roomId]);
  const available = !!(data?.card?.experience || data?.card?.pocket);
  return <PocketSurface card={available ? data!.card : null} scene={data?.scene ?? null} close={close} notice={error || (data && !available ? '이 카드의 포켓은 비어 있어요.' : '')}/>;
}
