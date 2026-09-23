import {useState} from 'react';
import {Image, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';

/** Identical crop and fallback artwork at every user-profile entry point. */
export function UserAvatar({image, size, testID}: {image: string | null; size: number; testID?: string}) {
  const {settings: p} = useAppearance();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const s = size / 96;
  return <View testID={testID} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size, flexShrink: 0, borderRadius: size / 2, overflow: 'hidden', backgroundColor: p.avatarBackground, alignItems: 'center'}}>
    {image && image !== failedImage ? <Image source={{uri: image}} resizeMode="cover" fadeDuration={0} onError={() => setFailedImage(image)} style={{width: size, height: size}}/> : <>
      <View style={{position: 'absolute', top: 20 * s, width: 26 * s, height: 26 * s, borderRadius: 13 * s, backgroundColor: p.avatarForeground}}/>
      <View style={{position: 'absolute', top: 49 * s, width: 51 * s, height: 26 * s, borderTopLeftRadius: 30 * s, borderTopRightRadius: 30 * s, borderBottomLeftRadius: 14 * s, borderBottomRightRadius: 14 * s, backgroundColor: p.avatarForeground}}/>
    </>}
  </View>;
}
