import {Image, Text, View} from 'react-native';
import {useCardImage} from './CardAssets';
import {Cover} from '../../layout/components';
import type {Card} from './model';

/** Portrait artwork for the library; avatars elsewhere keep their circular crop. */
export function CardCover({card, width, height, radius}: {card: Card; width: number; height: number; radius: number}) {
  const uri = useCardImage(card.coverAssetId);
  const artworkSize = 152, scale = Math.max(width, height) / artworkSize;
  return <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
    style={{width, height, borderRadius: radius, overflow: 'hidden'}}>
    {uri ? <Image source={{uri}} resizeMode="cover" style={{width, height}}/> : card.cover === 'code' ?
      <View style={{width, height, backgroundColor: '#DDE1E7', alignItems: 'center', justifyContent: 'center'}}>
        <Text allowFontScaling={false} numberOfLines={1} style={{fontSize: width * 0.38, fontWeight: '200', color: '#8B91A5'}}>{'</>'}</Text>
      </View> :
      <View style={{position: 'absolute', width: artworkSize, height: artworkSize, left: (width - artworkSize) / 2, top: (height - artworkSize) / 2, transform: [{scale}]}}>
        <Cover kind={card.cover} showLabel={false}/>
      </View>}
  </View>;
}
