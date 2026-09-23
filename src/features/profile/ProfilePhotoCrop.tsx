import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Image, PanResponder, StatusBar, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {cropProfileImage} from '../../adapters/profile/cropProfileImage';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {PhotoZoomSlider} from './PhotoZoomSlider';
import {constrainPhotoCrop, initialPhotoCrop, movePhotoCrop, photoCropRect, zoomPhotoCrop, type CropTouch, type PhotoCrop, type ProfilePhoto} from './photoCrop';

export function ProfilePhotoCrop({photo, onSave, onClose}: {photo: ProfilePhoto; onSave: (image: string) => Promise<void>; onClose: () => void}) {
  const [saving, setSaving] = useState(false);
  return <SwipeBackModal onClose={onClose} onBackRequest={() => saving}>
    {close => <CropEditor photo={photo} saving={saving} setSaving={setSaving} onSave={onSave} close={close}/>}
  </SwipeBackModal>;
}

function CropEditor({photo, saving, setSaving, onSave, close}: {
  photo: ProfilePhoto; saving: boolean; setSaving: (value: boolean) => void;
  onSave: (image: string) => Promise<void>; close: () => void;
}) {
  const {width} = useWindowDimensions();
  const {colors: c, isDark} = useAppearance();
  const s = headerScale(width);
  const [area, setArea] = useState({width: 0, height: 0});
  const [crop, setCrop] = useState<PhotoCrop>(initialPhotoCrop);
  const current = useRef(crop);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const busy = useRef(false);
  const disabled = useRef(false);
  disabled.current = saving || closing || !ready;
  const diameter = Math.max(1, Math.min(area.width - 64 * s, area.height - 64 * s, 520 * s));
  const previousDiameter = useRef(diameter);
  const gesture = useRef<{crop: PhotoCrop; touch: CropTouch} | null>(null);
  const update = (value: PhotoCrop) => {current.current = value; setCrop(value);};

  useEffect(() => {
    syncSystemBars(true);
    return () => syncSystemBars(isDark);
  }, [isDark]);

  useLayoutEffect(() => {
    const ratio = diameter / previousDiameter.current;
    previousDiameter.current = diameter;
    const value = current.current;
    const next = constrainPhotoCrop(photo, diameter, {...value, x: value.x * ratio, y: value.y * ratio});
    current.current = next; setCrop(next); gesture.current = null;
  }, [diameter, photo]);

  const pan = useMemo(() => {
    const frame = (event: GestureResponderEvent): CropTouch | null => {
      const touches = event.nativeEvent.touches;
      if (!touches.length) return null;
      const first = touches[0]!;
      const second = touches[1];
      return {
        count: touches.length,
        x: (second ? (first.locationX + second.locationX) / 2 : first.locationX) - area.width / 2,
        y: (second ? (first.locationY + second.locationY) / 2 : first.locationY) - area.height / 2,
        distance: second ? Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY) : 0,
      };
    };
    const rebase = (event: GestureResponderEvent) => {
      const touch = frame(event);
      gesture.current = touch ? {crop: current.current, touch} : null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled.current,
      onMoveShouldSetPanResponder: () => !disabled.current,
      onPanResponderGrant: rebase,
      onPanResponderStart: rebase,
      onPanResponderMove: event => {
        if (disabled.current) return;
        const touch = frame(event);
        const start = gesture.current;
        // Rebase when a second finger arrives or leaves so the photo never jumps.
        if (!touch || !start || touch.count !== start.touch.count) {rebase(event); return;}
        update(movePhotoCrop(photo, diameter, start.crop, start.touch, touch));
      },
      onPanResponderEnd: rebase,
      onPanResponderRelease: () => {gesture.current = null;},
      onPanResponderTerminate: () => {gesture.current = null;},
      onPanResponderTerminationRequest: () => false,
    });
  }, [area.width, area.height, diameter, photo]);

  const zoom = (value: number) => {
    if (disabled.current) return;
    update(zoomPhotoCrop(photo, diameter, current.current, value));
  };
  const cancel = () => {if (!busy.current && !closing) {setClosing(true); close();}};
  const save = async () => {
    if (busy.current || disabled.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const image = await cropProfileImage(photo, photoCropRect(photo, diameter, current.current));
      await onSave(image);
      setClosing(true); close();
    } catch {
      setError('사진을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {busy.current = false; setSaving(false);}
  };
  const scale = diameter / Math.min(photo.width, photo.height);
  const mask = Math.max(area.width, area.height) * 2;
  return <SwipeBackBoundary style={{flex: 1}}>
    <View testID="profile-photo-crop" style={{flex: 1, backgroundColor: '#141414'}}>
      <StatusBar barStyle="light-content"/>
      <View testID="profile-crop-stage" accessibilityLabel="프로필 사진 구도 조절" accessibilityHint="사진을 끌어 위치를 바꾸고 두 손가락으로 확대하거나 축소할 수 있어요."
        onLayout={event => {const {width: w, height: h} = event.nativeEvent.layout; setArea(value => value.width === w && value.height === h ? value : {width: w, height: h});}}
        style={{flex: 1, overflow: 'hidden'}} {...pan.panHandlers}>
        {area.width > 0 && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image testID="profile-crop-image" source={{uri: photo.uri}} resizeMode="stretch" resizeMethod="scale" fadeDuration={0}
            onLoad={() => {setReady(true); setError('');}} onError={() => {setReady(false); setError('사진을 열지 못했어요. 다른 사진을 선택해 주세요.');}}
            style={{position: 'absolute', width: photo.width * scale, height: photo.height * scale, left: (area.width - photo.width * scale) / 2, top: (area.height - photo.height * scale) / 2, transform: [{translateX: crop.x}, {translateY: crop.y}, {scale: crop.zoom}]}}/>
          <View pointerEvents="none" style={{position: 'absolute', left: (area.width - diameter) / 2 - mask, top: (area.height - diameter) / 2 - mask, width: diameter + mask * 2, height: diameter + mask * 2, borderRadius: diameter / 2 + mask, borderWidth: mask, borderColor: 'rgba(0,0,0,0.6)'}}/>
          <View testID="profile-crop-circle" pointerEvents="none" style={{position: 'absolute', left: (area.width - diameter) / 2, top: (area.height - diameter) / 2, width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 2 * s, borderColor: 'rgba(255,255,255,0.85)'}}/>
        </View>}
        {saving && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center'}]}><ActivityIndicator color="#FFFFFF"/></View>}
      </View>
      <SafeAreaView pointerEvents="box-none" style={[StyleSheet.absoluteFill, {justifyContent: 'space-between'}]}>
        <ScreenHeader width={width} edgeTint={false}>
          <HeaderButton width={width} icon="close" label="사진 편집 취소" disabled={saving || closing} onPress={cancel}/>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center'}}>
            <Text accessibilityRole="header" style={{color: '#FFFFFF', textAlign: 'center', fontSize: 28 * s, includeFontPadding: false}}>프로필 사진</Text>
          </View>
          <HeaderButton width={width} icon="check" label="사진 편집 완료" disabled={saving || closing || !ready} onPress={() => {void save();}}/>
        </ScreenHeader>
        <View pointerEvents="box-none" style={{paddingHorizontal: 28 * s, paddingBottom: 28 * s, alignItems: 'center', gap: 20 * s}}>
          {!!error && <Text accessibilityLiveRegion="polite" style={{color: c.error, fontSize: 22 * s, lineHeight: 32 * s, textAlign: 'center'}}>{error}</Text>}
          <View pointerEvents="box-none" style={{width: Math.min(width - 56 * s, 460 * s), flexDirection: 'row', alignItems: 'center'}}>
            <PhotoZoomSlider value={crop.zoom} onChange={zoom} disabled={saving || closing || !ready}/>
          </View>
        </View>
      </SafeAreaView>
    </View>
  </SwipeBackBoundary>;
}
