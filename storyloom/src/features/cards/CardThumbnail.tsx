import {View} from 'react-native';
import {Cover} from '../../layout/components';
import type {Card} from './model';

const artworkSize = 152;

/** Reuse the card's cover artwork in both the list and its history header. */
export function CardThumbnail({cover, size, testID}: {cover: Card['cover']; size: number; testID?: string}) {
  return <View testID={testID} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size, flexShrink: 0, borderRadius: size / 2, overflow: 'hidden'}}>
    <View style={{position: 'absolute', width: artworkSize, height: artworkSize, left: (size - artworkSize) / 2, top: (size - artworkSize) / 2, transform: [{scale: size / artworkSize}]}}>
      <Cover kind={cover} showLabel={false}/>
    </View>
  </View>;
}
