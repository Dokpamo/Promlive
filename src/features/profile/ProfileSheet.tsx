import {useRef, useState, type RefObject} from 'react';
import {Animated, Keyboard, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';
import {useAppearance} from '../appearance/AppAppearance';
import {panelReference as r, useSettingsScale} from '../settings/SettingsLayout';
import {ProfileEditor} from './ProfileEditor';
import {ProfilePhotoCrop} from './ProfilePhotoCrop';
import {useUserProfile} from './UserProfileContext';
import type {ProfilePhoto} from './photoCrop';

/** One compact editing surface; its native input stays above the keyboard. */
export function ProfileSheet({onClose}: {onClose: () => void}) {
  const [height, setHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const {store} = useUserProfile();
  const keyboardVisible = useRef(false);
  useDrawerModalLock();
  return <SwipeBackModal sheet sheetHeight={height} onClose={onClose} onDismissStart={() => setClosing(true)} onBackRequest={() => {
    if (!keyboardVisible.current) return false;
    Keyboard.dismiss(); return true;
  }}>{(close, motionStyle) => <KeyboardMotionProvider>
    <ProfileSurface close={close} closing={closing} obscured={photo !== null} onEditPhoto={setPhoto} keyboardVisible={keyboardVisible} motionStyle={motionStyle} onHeight={setHeight}/>
    {photo && <ProfilePhotoCrop photo={photo} onClose={() => setPhoto(null)} onSave={async image => {
      if (!store) throw new Error('Profile storage unavailable');
      await store.update({image});
    }}/>}
  </KeyboardMotionProvider>}</SwipeBackModal>;
}

function ProfileSurface({close, closing, obscured, onEditPhoto, keyboardVisible, motionStyle, onHeight}: {
  close: () => void; closing: boolean; keyboardVisible: RefObject<boolean>;
  obscured: boolean; onEditPhoto: (photo: ProfilePhoto) => void;
  motionStyle: Animated.WithAnimatedObject<ViewStyle>; onHeight: (height: number) => void;
}) {
  const {settings: p} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = useSettingsScale();
  const gap = r.sheetInset * s;
  const bottom = insets.bottom + gap;
  keyboardVisible.current = useKeyboardFrame().height > 0;
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  return <>
    <SwipeBackBoundary style={StyleSheet.absoluteFill}><Pressable accessibilityRole="button" accessibilityLabel="프로필 편집 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={false}>
      <Animated.View testID="profile-sheet" accessibilityViewIsModal accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'} onLayout={event => onHeight(event.nativeEvent.layout.height + bottom)}
        style={[{position: 'absolute', bottom, alignSelf: 'center', width: Math.min(r.contentMaxWidth, width - insets.left - insets.right - 2 * gap), borderRadius: r.radius * s, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
        <Pressable testID="profile-sheet-close" accessibilityRole="button" accessibilityLabel="프로필 편집 닫기" onPress={close} style={{height: 58 * s, alignItems: 'center', paddingTop: r.sheetHandle.top * s}}><View style={{width: r.sheetHandle.width * s, height: r.sheetHandle.height * s, borderRadius: r.sheetHandle.radius * s, backgroundColor: p.divider}}/></Pressable>
        <View style={{paddingHorizontal: r.sheetPadding * s, paddingBottom: r.groupPadding * s}}><ProfileEditor closing={closing} onEditPhoto={onEditPhoto}/></View>
      </Animated.View>
    </KeyboardDock>
  </>;
}
