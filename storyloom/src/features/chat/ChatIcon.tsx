import {View} from 'react-native';

export type ChatIconName = 'menu' | 'plus' | 'send' | 'voice' | 'expand' | 'close' | 'search' | 'chat' | 'stop' | 'settings' | 'user';
export function ChatIcon({name, size = 24, color = '#D0D0D0'}: {name: ChatIconName; size?: number; color?: string}) {
  const stroke = Math.max(1.5, size / 12);
  const line = {position: 'absolute' as const, height: stroke, borderRadius: stroke, backgroundColor: color};
  return <View pointerEvents="none" style={{width: size, height: size}}>
    {name === 'menu' && [0.2, 0.5, 0.8].map(y => <View key={y} style={[line, {width: size * 0.86, left: size * 0.07, top: size * y - stroke / 2}]}/>)}
    {name === 'plus' && <><View style={[line, {width: size, top: (size - stroke) / 2}]}/><View style={[line, {width: size, top: (size - stroke) / 2, transform: [{rotate: '90deg'}]}]}/></>}
    {name === 'send' && <>
      <View style={{position: 'absolute', width: stroke * 1.25, height: size * 0.77, left: (size - stroke * 1.25) / 2, top: size * 0.13, borderRadius: stroke, backgroundColor: color}}/>
      <View style={[line, {width: size * 0.58, height: stroke * 1.25, left: size * 0.04, top: size * 0.29, transform: [{rotate: '-48deg'}]}]}/>
      <View style={[line, {width: size * 0.58, height: stroke * 1.25, right: size * 0.04, top: size * 0.29, transform: [{rotate: '48deg'}]}]}/>
    </>}
    {name === 'voice' && <>
      <View style={{position: 'absolute', width: size * 0.13, height: size * 0.2, borderRadius: size, backgroundColor: color, left: size * 0.13, top: size * 0.4}}/>
      {[0.6, 1].map(f => <View key={f} style={{position: 'absolute', width: size * f, height: size * f, left: size * (0.12 - f * 0.22), top: size * (1 - f) / 2, borderRadius: size, borderWidth: stroke, borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color}}/>)}
    </>}
    {name === 'expand' && <><View style={{position: 'absolute', top: 0, right: 0, width: size * 0.56, height: size * 0.56, borderTopWidth: stroke, borderRightWidth: stroke, borderColor: color}}/><View style={{position: 'absolute', left: 0, bottom: 0, width: size * 0.56, height: size * 0.56, borderLeftWidth: stroke, borderBottomWidth: stroke, borderColor: color}}/></>}
    {name === 'close' && [-45, 45].map(angle => <View key={angle} style={[line, {width: size, top: (size - stroke) / 2, transform: [{rotate: `${angle}deg`}]}]}/>)}
    {name === 'search' && <><View style={{width: size * 0.68, height: size * 0.68, borderWidth: stroke, borderColor: color, borderRadius: size}}/><View style={[line, {width: size * 0.47, bottom: size * 0.14, right: 0, transform: [{rotate: '45deg'}]}]}/></>}
    {name === 'chat' && <View style={{width: size * 0.9, height: size * 0.75, borderWidth: stroke, borderColor: color, borderRadius: size * 0.2, borderBottomLeftRadius: 0, marginTop: size * 0.1}}/>}
    {name === 'stop' && <View style={{margin: size * 0.2, width: size * 0.6, height: size * 0.6, backgroundColor: color, borderRadius: 2}}/>}
    {name === 'settings' && <>
      {[0, 45, 90, 135].map(angle => <View key={angle} style={{position: 'absolute', width: size * 0.25, height: size, left: size * 0.375, borderRadius: size * 0.07, backgroundColor: color, transform: [{rotate: `${angle}deg`}]}}/>)}
      <View style={{position: 'absolute', inset: size * 0.14, borderRadius: size, backgroundColor: color}}/>
      <View style={{position: 'absolute', inset: size * 0.23, borderRadius: size, backgroundColor: '#181818'}}/>
      <View style={{position: 'absolute', inset: size * 0.36, borderRadius: size, borderWidth: stroke * 0.8, borderColor: color}}/>
    </>}
    {name === 'user' && <>
      <View style={{position: 'absolute', top: size * 0.08, left: size * 0.33, width: size * 0.34, height: size * 0.34, borderRadius: size, borderWidth: stroke, borderColor: color}}/>
      <View style={{position: 'absolute', left: size * 0.14, bottom: size * 0.05, width: size * 0.72, height: size * 0.4, borderTopLeftRadius: size, borderTopRightRadius: size, borderBottomLeftRadius: size * 0.12, borderBottomRightRadius: size * 0.12, borderWidth: stroke, borderColor: color}}/>
    </>}
  </View>;
}
