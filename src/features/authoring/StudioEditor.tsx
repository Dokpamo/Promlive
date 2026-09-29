import {useState} from 'react';
import {Image, Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsTextField} from '../settings/SettingsTextField';
import {PressSurface} from '../../layout/PressSurface';
import {CardThumbnail} from '../cards/CardThumbnail';
import {useCardImage} from '../cards/CardAssets';
import {importCardImage} from '../../adapters/profile/importCardImage';
import {fieldLabels, fieldLimit, fieldValue, type AuthoringProject} from './model';
import {StudioStructure} from './StudioStructure';
export {StudioAction} from './StudioControls';
import type {AuthoringSession} from './AuthoringSession';

export function StudioEditor({session, project, scale: s, report, disabled}: {session: AuthoringSession; project: AuthoringProject; scale: number; report: (error: unknown) => void; disabled: boolean}) {
  const {settings: p} = useAppearance();
  const image = useCardImage(project.draft.coverAssetId);
  const [importing, setImporting] = useState(false);
  const chooseImage = async () => {
    if (importing || disabled) return;
    setImporting(true);
    try {
      const image = await importCardImage();
      if (image) {const asset = await session.store.putAsset(image); session.setImage(asset.id); await session.flush();}
    } catch (error) {report(error);}
    finally {setImporting(false);}
  };
  return <View pointerEvents={disabled ? 'none' : 'auto'}>
    <PressSurface accessibilityRole="button" accessibilityLabel={image ? '카드 이미지 변경' : '카드 이미지 추가'} onPress={() => void chooseImage()} disabled={importing || disabled}
      radius={0} highlightColor={p.selected} contentStyle={{flex: 0, paddingVertical: 24 * s, flexDirection: 'row', alignItems: 'center', gap: 24 * s, marginBottom: 16 * s, borderBottomWidth: .5, borderBottomColor: p.divider}}>
      <View style={{flex: 1, gap: 8 * s}}><Text style={{color: p.text, fontSize: 28 * s, fontWeight: '600'}}>{importing ? '이미지 가져오는 중…' : image ? '이미지 변경' : '이미지 추가'}</Text><Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>카드 목록에 표시할 이미지를 골라요.</Text></View>
      {image ? <Image testID="studio-image" source={{uri: image}} resizeMode="cover" style={{width: 112 * s, height: 112 * s, borderRadius: 56 * s}}/> : <CardThumbnail cover={project.draft.cover} size={112 * s}/>}
    </PressSurface>
    {(['title', 'description', 'tags'] as const).map(field => <View key={field} style={{marginTop: 18 * s}}>
      <SettingsTextField label={fieldLabels[field]} testID={`studio-field-${field}`} value={fieldValue(project.draft, field)} placeholder={field === 'title' ? '카드 이름' : field === 'tags' ? '예: 판타지, 시뮬레이션, 다인물' : '어떤 카드인지 짧게 소개해 주세요'}
        editor={field === 'description' ? 'full' : 'mini'} multiline={field === 'description'} maxLength={fieldLimit(field)}
        onChange={value => session.setField(field, value)} onEditingChange={editing => session.setFocusedField(editing ? field : null)}/>
    </View>)}
    <StudioStructure session={session} project={project} scale={s} report={report}/>

  </View>;
}
