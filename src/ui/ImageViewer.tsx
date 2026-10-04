import type {LibraryCard} from '../features/workspace/model';
import {useEffect, useRef, useState} from 'react';
import {BackHandler, Platform, Pressable, ScrollView, StatusBar, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationButton} from './Navigation';
import {ImageSurface} from './ImageSurface';
import type {ImageSurfaceHandle} from './ImageSurface.types';
import {SwipeBack} from './SwipeBack';
import type {BackTransition} from './backTransition';
import {colorPalettes, navigationActionMetrics} from './tokens';
import {PreviewArtwork} from './PreviewArtwork';
import {useDesktopPane} from './desktop/DesktopPane';

export function ImageViewer({card, width, scale, onClose, transition, galleryIndex = null, onSelectImage}: {
  card: LibraryCard; width: number; scale: number; onClose: () => void; transition: BackTransition;
  galleryIndex?: number | null; onSelectImage?: (index: number) => void;
}) {
  const window = useWindowDimensions(), pane = useDesktopPane();
  const height = pane?.height ?? window.height;
  const insets = useSafeAreaInsets(), actions = navigationActionMetrics(scale);
  const safe = pane ? {top: 0, bottom: 0, left: 0, right: 0} : insets;
  const [zoomed, setZoomed] = useState(false);
  const surface = useRef<ImageSurfaceHandle>(null);
  const pages = useRef<ScrollView>(null), strip = useRef<ScrollView>(null);
  const index = galleryIndex === null ? null : Math.max(0, Math.min(card.gallery.length - 1, galleryIndex));
  const top = safe.top + actions.size + actions.top * 2;
  const footerHeight = safe.bottom + 102;
  const photoHeight = Math.max(1, height - top - footerHeight);
  useEffect(() => {
    if (index === null) return;
    setZoomed(false); pages.current?.scrollTo({x: index * width, animated: false});
    strip.current?.scrollTo({x: Math.max(0, index * 48 - width / 2 + 24), animated: true});
  }, [index, width]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {onClose(); return true;});
    return () => back.remove();
  }, [onClose]);
  return <SwipeBack identity={card.id} onBack={onClose} enabled={!zoomed && index === null} transition={transition} drawBehindStatusBar backgroundColor={colorPalettes.dark.background}>
    <View testID="ui-image-viewer" style={{flex: 1, backgroundColor: colorPalettes.dark.background}}>
      <StatusBar barStyle="light-content"/>
      {index === null ? <ImageSurface ref={surface} tile={card.tile} label={`${card.title} 대표 이미지`} width={width} height={height} onZoomChange={setZoomed}/>
        : <>
          <Text testID="ui-gallery-counter" accessibilityLiveRegion="polite" style={{position: 'absolute', top: safe.top + actions.top + 13, left: 72, right: 72,
            textAlign: 'center', color: colorPalettes.dark.foreground, fontSize: 16, fontWeight: '600'}}>{index + 1} / {card.gallery.length}</Text>
          <View style={{position: 'absolute', top, left: 0, width, height: photoHeight}}>
            <ScrollView ref={pages} testID="ui-gallery-pages" horizontal pagingEnabled scrollEnabled={!zoomed} showsHorizontalScrollIndicator={false}
              contentOffset={{x: index * width, y: 0}} bounces={false}
              onMomentumScrollEnd={event => {
                const next = Math.max(0, Math.min(card.gallery.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
                if (next !== index) onSelectImage?.(next);
              }}>
              {card.gallery.map((picture, page) => <View key={picture.id} style={{width, height: photoHeight}}>
                <ImageSurface ref={page === index ? surface : undefined} tile={picture.tile} label={picture.title} width={width} height={photoHeight}
                  resetKey={`${index}`} onZoomChange={value => {if (page === index) setZoomed(value);}}/>
              </View>)}
            </ScrollView>
          </View>
          <View testID="ui-gallery-filmstrip" style={{position: 'absolute', bottom: safe.bottom + 12, left: 0, right: 0, alignItems: 'center'}}>
            <Text numberOfLines={1} style={{color: colorPalettes.dark.foreground, fontSize: 14, marginBottom: 12, paddingHorizontal: 24}}>{card.gallery[index]?.title}</Text>
            <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 20, alignItems: 'center', gap: 4, height: 60}}>
              {card.gallery.map((picture, page) => <Pressable key={picture.id} testID={`ui-gallery-thumb-${page}`} accessibilityRole="button" accessibilityLabel={`${picture.title}, ${page + 1}/${card.gallery.length}`}
                accessibilityState={{selected: index === page}} onPress={() => onSelectImage?.(page)}
                style={{width: index === page ? 46 : 36, height: index === page ? 58 : 48, overflow: 'hidden', borderRadius: 5, opacity: index === page ? 1 : 0.65,
                  borderWidth: index === page ? 2 : 0, borderColor: colorPalettes.dark.foreground}}>
                <PreviewArtwork tile={picture.tile} width={index === page ? 42 : 36} height={index === page ? 54 : 48}/>
              </Pressable>)}
            </ScrollView>
          </View>
        </>}
      <NavigationButton testID="ui-image-viewer-back" icon="back" label="카드 상세로 돌아가기" scale={scale} onPress={onClose} color={colorPalettes.dark.foreground}
        style={{position: 'absolute', top: safe.top + actions.top, left: actions.backInset, borderRadius: actions.size / 2, backgroundColor: colorPalettes.dark.background}}/>
      <NavigationButton testID="ui-image-viewer-zoom" icon="search" label={zoomed ? '이미지 원래 크기로' : '이미지 확대'} expanded={zoomed}
        scale={scale} onPress={() => surface.current?.toggleZoom()} color={colorPalettes.dark.foreground}
        style={{position: 'absolute', top: safe.top + actions.top, right: actions.endInset, borderRadius: actions.size / 2, backgroundColor: colorPalettes.dark.background}}/>
    </View>
  </SwipeBack>;
}
