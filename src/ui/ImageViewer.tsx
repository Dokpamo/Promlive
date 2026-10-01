import {useEffect, useRef, useState} from 'react';
import {BackHandler, Platform, StatusBar, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {LibraryCard} from './cardWorkspace';
import {NavigationButton} from './Navigation';
import {ImageSurface} from './ImageSurface';
import type {ImageSurfaceHandle} from './ImageSurface.types';
import {SwipeBack} from './SwipeBack';
import type {BackTransition} from './backTransition';
import {colorPalettes, navigationActionMetrics} from './tokens';

export function ImageViewer({card, width, scale, onClose, transition}: {
  card: LibraryCard; width: number; scale: number; onClose: () => void; transition: BackTransition;
}) {
  const {height} = useWindowDimensions();
  const safe = useSafeAreaInsets(), actions = navigationActionMetrics(scale);
  const [zoomed, setZoomed] = useState(false);
  const surface = useRef<ImageSurfaceHandle>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {onClose(); return true;});
    return () => back.remove();
  }, [onClose]);
  return <SwipeBack identity={card.id} onBack={onClose} enabled={!zoomed} transition={transition} drawBehindStatusBar backgroundColor={colorPalettes.dark.background}>
    <View testID="ui-image-viewer" style={{flex: 1, backgroundColor: colorPalettes.dark.background}}>
      <StatusBar barStyle="light-content"/>
      <ImageSurface ref={surface} tile={card.tile} label={`${card.title} 대표 이미지`} width={width} height={height} onZoomChange={setZoomed}/>
      <NavigationButton testID="ui-image-viewer-back" icon="back" label="카드 상세로 돌아가기" scale={scale} onPress={onClose} color={colorPalettes.dark.foreground}
        style={{position: 'absolute', top: safe.top + actions.top, left: actions.backInset, borderRadius: actions.size / 2, backgroundColor: colorPalettes.dark.background}}/>
      <NavigationButton testID="ui-image-viewer-zoom" icon="search" label={zoomed ? '이미지 원래 크기로' : '이미지 확대'} expanded={zoomed}
        scale={scale} onPress={() => surface.current?.toggleZoom()} color={colorPalettes.dark.foreground}
        style={{position: 'absolute', top: safe.top + actions.top, right: actions.endInset, borderRadius: actions.size / 2, backgroundColor: colorPalettes.dark.background}}/>
    </View>
  </SwipeBack>;
}
