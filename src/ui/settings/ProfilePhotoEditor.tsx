import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Image, PanResponder, StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import {cropProfileImage} from '../../adapters/profile/cropProfileImage';
import {constrainPhotoCrop, initialPhotoCrop, movePhotoCrop, photoCropRect, zoomPhotoCrop, type CropTouch, type PhotoCrop, type ProfilePhoto} from '../../features/profile/photoCrop';
import {NavigationButton} from '../Navigation';
import {usePalette} from '../Theme';
import {settingsDetailLayout} from '../tokens';
import {Note, SettingsHeader, type SettingsNavigation} from './controls';
import {PhotoZoomSlider} from './PhotoZoomSlider';
import {photoCropMask} from './photoCropMask';

/** Only the crop math and image adapter are shared with the previous UI. */
export function ProfilePhotoEditor({photo, nav, onSave}: {photo: ProfilePhoto; nav: SettingsNavigation; onSave: (image: string) => Promise<void>}) {
  const colors = usePalette();
  const [area, setArea] = useState({width: 0, height: 0});
  const [crop, setCrop] = useState<PhotoCrop>(initialPhotoCrop);
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), busy = useRef(false), closing = useRef(false);
  const current = useRef(crop), disabled = useRef(true);
  disabled.current = saving || closing.current || !!nav.closing || !ready || !area.width || !area.height;
  const diameter = Math.max(1, Math.min(area.width - 48, area.height - 48, 360));
  const previousDiameter = useRef(diameter);
  const gesture = useRef<{crop: PhotoCrop; touch: CropTouch} | null>(null);
  const update = (value: PhotoCrop) => {current.current = value; setCrop(value);};
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useLayoutEffect(() => {
    const ratio = diameter / previousDiameter.current;
    previousDiameter.current = diameter;
    const value = current.current;
    update(constrainPhotoCrop(photo, diameter, {...value, x: value.x * ratio, y: value.y * ratio}));
    gesture.current = null;
  }, [diameter, photo]);

  const pan = useMemo(() => {
    const frame = (event: GestureResponderEvent): CropTouch | null => {
      const [first, second] = event.nativeEvent.touches;
      if (!first) return null;
      return {
        count: event.nativeEvent.touches.length,
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
        const touch = frame(event), start = gesture.current;
        // Adding/removing a finger starts from the current crop without a jump.
        if (!touch || !start || touch.count !== start.touch.count) {rebase(event); return;}
        update(movePhotoCrop(photo, diameter, start.crop, start.touch, touch));
      },
      onPanResponderEnd: rebase,
      onPanResponderRelease: () => {gesture.current = null;},
      onPanResponderTerminate: () => {gesture.current = null;},
      onPanResponderTerminationRequest: () => false,
    });
  }, [area.width, area.height, diameter, photo]);
  const save = async () => {
    if (busy.current || disabled.current) return;
    busy.current = true; nav.blockBack?.(true); setSaving(true); setError('');
    try {
      const image = await cropProfileImage(photo, photoCropRect(photo, diameter, current.current));
      if (!mounted.current) return;
      await onSave(image);
      if (mounted.current) {closing.current = true; nav.blockBack?.(false); nav.back();}
    } catch {
      if (mounted.current) setError('사진을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      busy.current = false; nav.blockBack?.(false);
      if (mounted.current) setSaving(false);
    }
  };
  const scale = diameter / Math.min(photo.width, photo.height);
  const left = (area.width - diameter) / 2, top = (area.height - diameter) / 2;
  const shade = 'rgba(0,0,0,0.6)';
  return <View testID="ui-profile-photo-editor" style={{flex: 1, minHeight: 0, backgroundColor: colors.background, paddingBottom: nav.bottomInset}}>
    <SettingsHeader title="사진 편집" nav={nav} backDisabled={saving || !!nav.closing || closing.current}
      action={<NavigationButton testID="ui-profile-photo-apply" icon="check" label="사진 적용" scale={nav.scale}
        color={disabled.current ? colors.secondaryForeground : colors.foreground} onPress={disabled.current ? undefined : () => {void save();}}/>}/>
    <View testID="ui-profile-crop-stage" accessibilityLabel="프로필 사진 구도 조절" accessibilityHint="사진을 끌어 위치를 바꾸고 두 손가락으로 확대하거나 축소할 수 있어요."
      onLayout={event => {const {width, height} = event.nativeEvent.layout; setArea(old => old.width === width && old.height === height ? old : {width, height});}}
      style={{flex: 1, overflow: 'hidden', backgroundColor: colors.surface}} {...pan.panHandlers}>
      {area.width > 0 && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image testID="ui-profile-crop-image" source={{uri: photo.uri}} resizeMode="stretch" resizeMethod="scale" fadeDuration={0}
          onLoad={() => {setReady(true); setError('');}} onError={() => {setReady(false); setError('사진을 열지 못했어요. 다른 사진을 선택해 주세요.');}}
          style={{position: 'absolute', width: photo.width * scale, height: photo.height * scale, left: (area.width - photo.width * scale) / 2, top: (area.height - photo.height * scale) / 2,
            transform: [{translateX: crop.x}, {translateY: crop.y}, {scale: crop.zoom}]}}/>
        {/* iOS does not reliably draw an oversized rounded border as an inverse mask. */}
        <View style={{position: 'absolute', left: 0, right: 0, top: 0, height: top, backgroundColor: shade}}/>
        <View style={{position: 'absolute', left: 0, right: 0, top: top + diameter, bottom: 0, backgroundColor: shade}}/>
        <View style={{position: 'absolute', left: 0, top, width: left, height: diameter, backgroundColor: shade}}/>
        <View style={{position: 'absolute', right: 0, top, width: left, height: diameter, backgroundColor: shade}}/>
        <Image accessible={false} source={photoCropMask} fadeDuration={0} resizeMode="stretch"
          style={{position: 'absolute', left, top, width: diameter, height: diameter, opacity: .6}}/>
        <View testID="ui-profile-crop-circle" style={{position: 'absolute', left, top,
          width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 1.5, borderColor: '#FFFFFF'}}/>
      </View>}
      {saving && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center'}]}><ActivityIndicator color="#FFFFFF"/></View>}
    </View>
    {!!error && <Note error>{error}</Note>}
    <View style={{paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 16}}>
      <Text style={{fontSize: 14, color: colors.secondaryForeground}}>1×</Text>
      <PhotoZoomSlider value={crop.zoom} disabled={disabled.current} onChange={value => {
        if (!disabled.current) update(zoomPhotoCrop(photo, diameter, current.current, value));
      }}/>
      <Text style={{fontSize: 14, color: colors.secondaryForeground}}>4×</Text>
    </View>
  </View>;
}
