import {Text, View} from 'react-native';

export type SettingsIconName = 'connection' | 'model' | 'response' | 'text' | 'haptic' | 'bell' | 'theme' | 'info' | 'chevron' | 'edit' | 'check' | 'select' | 'pin' | 'delete' | 'copy' | 'folder';

export function SettingsIcon({name, color, size = 22}: {name: SettingsIconName; color: string; size?: number}) {
  const s = size / 24;
  const line = {position: 'absolute' as const, backgroundColor: color, height: 1.7 * s, borderRadius: 2 * s};
  const outline = {position: 'absolute' as const, borderWidth: 1.7 * s, borderColor: color};
  return <View pointerEvents="none" accessible={false} style={{width: size, height: size}}>
    {name === 'folder' && <>
      <View style={[outline, {left: 2 * s, top: 3 * s, width: 9 * s, height: 5 * s, borderBottomWidth: 0, borderTopLeftRadius: 2 * s, borderTopRightRadius: 2 * s}]}/>
      <View style={[outline, {left: 2 * s, top: 7 * s, width: 20 * s, height: 14 * s, borderRadius: 2 * s}]}/>
    </>}
    {name === 'copy' && <>
      <View style={[outline, {left: 2 * s, top: 2 * s, width: 14 * s, height: 14 * s, borderRadius: 3 * s}]}/>
      <View style={[outline, {left: 8 * s, top: 8 * s, width: 14 * s, height: 14 * s, borderRadius: 3 * s}]}/>
    </>}
    {name === 'pin' && <>
      <View style={[outline, {left: 7 * s, top: 2 * s, width: 10 * s, height: 11 * s, borderBottomWidth: 0, borderRadius: 2 * s}]}/>
      <View style={[outline, {left: 4 * s, top: 12 * s, width: 16 * s, height: 5 * s, borderRadius: 2 * s}]}/>
      <View style={[line, {left: 11 * s, top: 17 * s, width: 1.7 * s, height: 6 * s}]}/>
    </>}
    {name === 'delete' && <>
      <View style={[outline, {left: 6 * s, top: 7 * s, width: 12 * s, height: 15 * s, borderBottomLeftRadius: 3 * s, borderBottomRightRadius: 3 * s}]}/>
      <View style={[line, {left: 3 * s, top: 5 * s, width: 18 * s}]}/>
      <View style={[line, {left: 9 * s, top: 2 * s, width: 6 * s}]}/>
      {[10, 14].map(x => <View key={x} style={[line, {left: x * s, top: 10 * s, width: 1.7 * s, height: 8 * s}]}/>)}
    </>}
    {name === 'select' && <>
      {[5, 12, 19].map(y => <View key={y}>
        <View style={[line, {left: 10 * s, top: y * s, width: 12 * s}]}/>
        <View style={[line, {left: s, top: y * s, width: 3 * s, transform: [{rotate: '45deg'}]}]}/>
        <View style={[line, {left: 3 * s, top: (y - 1) * s, width: 5 * s, transform: [{rotate: '-45deg'}]}]}/>
      </View>)}
    </>}
    {name === 'connection' && <>
      {[0, 1].map(i => <View key={i} style={[outline, {width: 13 * s, height: 9 * s, borderRadius: 5 * s, left: (1 + i * 9) * s, top: (12 - i * 9) * s, transform: [{rotate: '-45deg'}]}]}/>)}
      <View style={[line, {width: 10 * s, left: 7 * s, top: 11 * s, transform: [{rotate: '-45deg'}]}]}/>
    </>}
    {name === 'model' && <>
      <View style={[outline, {left: 5 * s, top: 5 * s, width: 14 * s, height: 14 * s, borderRadius: 4 * s}]}/>
      {[8, 14].map(x => <View key={x}>
        <View style={[line, {left: x * s, top: s, width: 1.7 * s, height: 4 * s}]}/>
        <View style={[line, {left: x * s, top: 19 * s, width: 1.7 * s, height: 4 * s}]}/>
        <View style={[line, {left: s, top: x * s, width: 4 * s}]}/>
        <View style={[line, {left: 19 * s, top: x * s, width: 4 * s}]}/>
      </View>)}
      <View style={{position: 'absolute', left: 10 * s, top: 10 * s, width: 4 * s, height: 4 * s, backgroundColor: color, borderRadius: s}}/>
    </>}
    {name === 'response' && <>
      <View style={[outline, {left: 2 * s, top: 3 * s, width: 20 * s, height: 17 * s, borderRadius: 5 * s, borderBottomLeftRadius: s}]}/>
      {[8, 13].map((y, i) => <View key={y} style={[line, {left: 7 * s, top: y * s, width: (10 - i * 3) * s}]}/>)}
    </>}
    {name === 'text' && <Text style={{color, fontSize: 20 * s, lineHeight: 24 * s, letterSpacing: -1, fontWeight: '500', includeFontPadding: false}}>Aa</Text>}
    {name === 'haptic' && <>
      <View style={[outline, {left: 6 * s, top: 2 * s, width: 12 * s, height: 20 * s, borderRadius: 3 * s}]}/>
      <View style={[line, {left: s, top: 8 * s, width: 1.7 * s, height: 8 * s}]}/>
      <View style={[line, {right: s, top: 8 * s, width: 1.7 * s, height: 8 * s}]}/>
      <View style={[line, {left: 10 * s, top: 17 * s, width: 4 * s}]}/>
    </>}
    {name === 'bell' && <>
      <View style={[outline, {left: 5 * s, top: 4 * s, width: 14 * s, height: 14 * s, borderTopLeftRadius: 9 * s, borderTopRightRadius: 9 * s, borderBottomWidth: 0}]}/>
      <View style={[line, {left: 3 * s, top: 17 * s, width: 18 * s}]}/>
      <View style={[line, {left: 10 * s, top: 21 * s, width: 4 * s}]}/>
      <View style={[line, {left: 11 * s, top: 2 * s, width: 2 * s, height: 3 * s}]}/>
    </>}
    {name === 'theme' && <View style={[outline, {inset: 2 * s, borderRadius: size, overflow: 'hidden'}]}><View style={{width: '50%', height: '100%', backgroundColor: color}}/></View>}
    {name === 'info' && <View style={[outline, {inset: 2 * s, borderRadius: size, alignItems: 'center', justifyContent: 'center'}]}><Text style={{color, fontSize: 14 * s, lineHeight: 17 * s, fontWeight: '600', includeFontPadding: false}}>i</Text></View>}
    {name === 'chevron' && <View style={[outline, {left: 7 * s, top: 7 * s, width: 8 * s, height: 8 * s, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{rotate: '45deg'}]}]}/>}
    {name === 'edit' && <>
      <View style={[outline, {left: 10 * s, top: s, width: 5 * s, height: 18 * s, borderRadius: s, transform: [{rotate: '42deg'}]}]}/>
      <View style={[line, {left: 4 * s, top: 22 * s, width: 17 * s}]}/>
    </>}
    {name === 'check' && <>
      <View style={[line, {left: 2 * s, top: 14 * s, width: 9 * s, transform: [{rotate: '45deg'}]}]}/>
      <View style={[line, {left: 7 * s, top: 10 * s, width: 16 * s, transform: [{rotate: '-45deg'}]}]}/>
    </>}
  </View>;
}
