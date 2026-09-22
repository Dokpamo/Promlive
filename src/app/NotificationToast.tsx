import {useEffect, useSyncExternalStore} from 'react';
import {Pressable, Text} from 'react-native';
import type {Notifications} from './Notifications';
import {useAppearance} from '../features/appearance/AppAppearance';
import {composerScale} from '../features/chat/chatAppearance';

export function NotificationToast({notifications, width}: {notifications: Notifications; width: number}) {
  const {colors: c} = useAppearance();
  const {error, notice, noticeId} = useSyncExternalStore(notifications.subscribe, notifications.snapshot);
  const s = composerScale(width);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notifications.dismissNotice(noticeId), 3500);
    return () => clearTimeout(timer);
  }, [notifications, notice, noticeId]);
  if (!notice && !error) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={notifications.clear} style={{position: 'absolute', top: 100 * s, alignSelf: 'center', maxWidth: '88%', paddingVertical: 12, paddingHorizontal: 18, backgroundColor: c.notice, borderRadius: 14, borderWidth: 1, borderColor: c.noticeBorder}}><Text style={{fontSize: 13, lineHeight: 20, color: error ? c.noticeError : c.text}}>{error ?? notice}</Text></Pressable>;
}
