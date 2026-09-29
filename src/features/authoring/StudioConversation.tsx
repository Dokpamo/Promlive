import {Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsTextField} from '../settings/SettingsTextField';
import {StudioAction} from './StudioControls';
import {ChatMessage} from '../chat/ChatMessage';
import {useWindowDimensions} from 'react-native';
import {getExperience} from '../cards/experience';
import {fieldLabel, fieldLimit, fieldValue, structuredField, type AuthoringMessage, type AuthoringProject} from './model';
import type {AuthoringSession} from './AuthoringSession';

export function StudioConversation({session, project, scale: s, report, openSettings, openPocket, saving}: {session: AuthoringSession; project: AuthoringProject; scale: number; report: (error: unknown) => void; openSettings: () => void; openPocket?: (() => void) | undefined; saving: boolean}) {
  const {settings: p} = useAppearance();
  return <View style={{gap: 22 * s}}>
    {!session.assistant.connected && <View style={{gap: 14 * s, padding: 24 * s, borderRadius: 16 * s, backgroundColor: p.surface}}>
      <Text style={{color: p.text, fontSize: 25 * s, lineHeight: 36 * s}}>AI를 연결하면 대화로 만들 수 있어요. 직접 편집은 연결 없이도 가능해요.</Text>
      <View style={{alignSelf: 'flex-start'}}><StudioAction label="AI 연결 설정" scale={s} onPress={openSettings}/></View>
    </View>}
    {!project.messages.length && <View style={{gap: 24 * s, paddingVertical: 28 * s}}>
      <Text accessibilityRole="header" style={{color: p.text, fontSize: 38 * s, lineHeight: 50 * s, fontWeight: '700'}}>어떤 이야기를 만들까요?</Text>
      <Text style={{color: p.secondary, fontSize: 25 * s, lineHeight: 38 * s}}>한 사람과의 대화부터 여러 장소와 인물이 있는 세계까지, 원하는 모습을 이야기해 주세요.</Text>
      <StudioAction label="밤의 도서관을 지키는 사서를 만들어 줘" scale={s} onPress={() => session.setPrompt('밤의 도서관을 지키는 조용한 사서를 만들어 줘. 처음 방문한 사용자와 천천히 가까워지는 이야기로.')}/>
      <View style={{alignSelf: 'flex-start'}}><StudioAction label="직접 만들기" scale={s} onPress={() => session.setView('edit')}/></View>
    </View>}
    {project.messages.map(message => <StudioMessage key={message.id} message={message} project={project} session={session} scale={s} report={report} openPocket={openPocket} saving={saving}/>)}
  </View>;
}

function StudioMessage({message: m, project, session, scale: s, report, openPocket, saving}: {message: AuthoringMessage; project: AuthoringProject; session: AuthoringSession; scale: number; report: (error: unknown) => void; openPocket?: (() => void) | undefined; saving: boolean}) {
  const {settings: p} = useAppearance();
  const receipt = project.changes.find(c => c.id === m.changeId);
  const {width} = useWindowDimensions();
  const status = m.status === 'generating' ? '초안을 만드는 중…' : receipt?.undone ? '변경을 되돌렸어요.' : m.status === 'applied' && saving ? '변경 내용 저장 중…' : m.text;
  return <View testID={`studio-message-${m.id}`} style={{gap: 16 * s}}>
    <ChatMessage width={width} displayMode="default" message={{id: m.id, conversationId: project.cardId, sequence: 0, role: m.role, content: status, status: 'completed', requestId: 'studio', error: null, createdAt: m.createdAt}}/>
    {receipt && !receipt.undone && <>
      <Text style={{color: p.secondary, fontSize: 20 * s}}>현재 초안 · 눌러서 바로 수정할 수 있어요.</Text>
      {receipt.after.some(change => structuredField(change.field) && change.field !== 'pocket') && <View style={{gap: 12 * s}}>
        <Text style={{color: p.text, fontSize: 25 * s, lineHeight: 36 * s}}>{getExperience(project.draft).resources.map(r => r.name).join(' · ')}</Text>
        <StudioAction label="구성 편집" scale={s} onPress={() => session.setView('edit')}/>
      </View>}
      {receipt.after.some(change => change.field === 'pocket') && openPocket && <StudioAction label="포켓 상태창" scale={s} onPress={openPocket}/>}
      {receipt.after.filter(change => !structuredField(change.field)).map(change => <SettingsTextField key={change.field} label={fieldLabel(change.field)} value={fieldValue(project.draft, change.field)} placeholder="아직 비어 있어요" maxLength={fieldLimit(change.field)}
        editor={['title', 'genre', 'tags', 'characterName'].includes(change.field) ? 'mini' : 'full'} multiline={!['title', 'genre', 'tags', 'characterName'].includes(change.field)}
        onChange={value => session.setField(change.field, value)} onEditingChange={editing => session.setFocusedField(editing ? change.field : null)}/>)}
      <View style={{flexDirection: 'row', gap: 12 * s, flexWrap: 'wrap'}}>
        <StudioAction label="되돌리기" scale={s} onPress={() => void session.undo(receipt.id).catch(report)}/>
        <StudioAction label="대화 시험" scale={s} onPress={() => session.setView('preview')}/>
      </View>
    </>}
    {['failed', 'conflict', 'interrupted', 'cancelled'].includes(m.status) && <View style={{alignSelf: 'flex-start'}}><StudioAction label="현재 초안으로 다시 요청" scale={s} onPress={() => {
      const index = project.messages.findIndex(item => item.id === m.id);
      const request = project.messages.slice(0, index).reverse().find(item => item.role === 'user');
      if (request) void session.generate(request.text);
    }}/></View>}
  </View>;
}
