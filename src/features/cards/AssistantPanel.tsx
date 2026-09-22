import {useEffect, useState, useSyncExternalStore} from 'react';
import {View, Text, ScrollView, TextInput, Linking} from 'react-native';
import type {CardEditor, Editor} from './CardEditor';
import type {CreationService} from '../chat/service';
import type {Draft, World} from './model';
import {Button, Icon, Pill} from '../../layout/components';
import {colors, styles} from '../../layout/theme';
const fields: {key: keyof World; title: string}[] = [{key: 'world', title: '세계관'}, {key: 'personality', title: '성격·말투'}, {key: 'greeting', title: '시작 장면'}, {key: 'tone', title: '대화 지침'}];
interface AssistantPanelProps {
  session: CardEditor; creation: CreationService; connected: boolean;
  openSettings: () => Promise<void>; report: (error: unknown) => void;
}
export function AssistantPanel(props: AssistantPanelProps) {
  useSyncExternalStore(props.session.subscribe, props.session.snapshot);
  const editor = props.session.state;
  return editor ? <AssistantContent {...props} editor={editor}/> : null;
}
function AssistantContent({session, creation, connected, openSettings, report, editor}: AssistantPanelProps & {editor: Editor}) {
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const form = session.assistantForm(editor.card.id);
  const {mode, prompt, content, target} = form;
  const setMode = (value: Draft['kind']) => session.editAssistant(editor.card.id, {mode: value});
  const setPrompt = (value: string) => session.editAssistant(editor.card.id, {prompt: value});
  const setContent = (value: string) => session.editAssistant(editor.card.id, {content: value});
  const setTarget = (value: keyof World) => session.editAssistant(editor.card.id, {target: value});
  const [history, setHistory] = useState<{cardId: string; drafts: Draft[]}>({cardId: '', drafts: []});
  const live = creation.draft(editor.card.id);
  const draft = live && live.status !== 'applied' ? live : (history.cardId === editor.card.id ? history.drafts.find(d => d.status !== 'applied') : undefined);
  useEffect(() => { let active = true; void session.drafts(editor.card.id).then(d => {if (active) setHistory({cardId: editor.card.id, drafts: d});}).catch(e => {if (active) report(e);}); return () => {active = false;}; }, [session, editor.card.id, editor.card.revision, report]);
  useEffect(() => {
    if (draft && (form.draftId !== draft.id || form.sourceContent !== draft.content)) session.editAssistant(editor.card.id, {draftId: draft.id, sourceContent: draft.content, content: draft.content});
  }, [draft, form.draftId, form.sourceContent, editor.card.id, session]);
  const run = (promise: Promise<unknown>) => void promise.catch(e => report(e));
  return <ScrollView keyboardShouldPersistTaps="handled" style={{flex: 1, backgroundColor: '#F6F4F8'}} contentContainerStyle={{padding: 23, gap: 21}}>
    <View style={[styles.row, {gap: 9}]}><Icon name="spark" color={colors.accent} size={23}/><Text style={[styles.subheading, {fontSize: 16}]}>함께 쓰는 이야기</Text></View>
    <Text style={[styles.small, {lineHeight: 21}]}>떠오른 생각을 나눠 주세요.{ '\n'}AI와 다듬고, 마지막 선택은 직접 해요.</Text>
    <View style={[styles.row, {gap: 6}]}><Pill active={mode === 'writing'} onPress={() => setMode('writing')}>✧ AI 작성</Pill><Pill active={mode === 'research'} onPress={() => setMode('research')}>⌕ 자료 조사</Pill></View>
    <TextInput accessibilityLabel="AI에게 요청할 내용" multiline placeholder={mode === 'writing' ? '이 세계에 작은 비밀을 하나 더해 줘…' : '어떤 작품이나 설정을 조사할까요?'} placeholderTextColor={colors.faint} value={prompt} onChangeText={setPrompt} style={[styles.field, {minHeight: 130, fontSize: 13}]}/>
    <View style={{gap: 8}}><Text style={[styles.eyebrow, {letterSpacing: 1}]}>이렇게 시작해 보세요</Text>{['세계관에 흥미로운 갈등을 더해 줘', '인물의 말투를 더 구체적으로 만들어 줘', '첫 만남의 장면을 써 줘'].map(item => <Button key={item} variant="secondary" small onPress={() => setPrompt(item)} style={{justifyContent: 'flex-start', backgroundColor: '#FFFFFF88'}}>{item}</Button>)}</View>
    <Text style={[styles.small, {fontSize: 11}]}>{mode === 'research' ? '조사는 실제 출처가 있는 결과만 표시해요.' : 'AI 작성은 창작 초안이며, 실제 자료 검색과 구분돼요.'}{'\n'}전송 범위: 현재 저장된 카드 설정 + 요청 내용</Text>
    {draft?.status === 'generating' ? <Button variant="secondary" icon="stop" onPress={() => creation.cancel(draft.id)}>생성 중단</Button> : <Button icon="spark" disabled={!connected || !prompt.trim()} onPress={() => {
      if (editor.dirty) { report(new Error('먼저 카드를 저장해 주세요. 생성 중에도 자유롭게 편집할 수 있어요.')); return; }
      run(creation.generateDraft(editor.card, prompt, mode));
    }}>{mode === 'writing' ? '초안 만들기' : '자료 조사하기'}</Button>}
    {!connected && <View style={{backgroundColor: '#EBE6EF', borderRadius: 9, padding: 14, gap: 8}}><Text style={{fontSize: 12, color: colors.accent, fontWeight: '600'}}>AI 연결을 기다리고 있어요</Text><Text style={[styles.small, {fontSize: 11}]}>지금은 직접 작성하고 저장할 수 있어요.{ '\n'}Grok 연결은 테스트 단계에서 진행할 예정이에요.</Text><Button variant="ghost" small onPress={() => run(openSettings())} style={{alignSelf: 'flex-start', paddingHorizontal: 0}}>연결 설정 보기 ↗</Button></View>}
    {draft && <View style={{gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingTop: 18}}>
      <View style={[styles.row, {justifyContent: 'space-between'}]}><Text style={styles.subheading}>{draft.kind === 'research' ? '조사 결과' : '생성된 초안'}</Text><Text style={styles.small}>기준 r{draft.baseRevision}</Text></View>
      {draft.error && <Text style={{fontSize: 12, color: colors.danger, lineHeight: 20}}>{draft.error}</Text>}
      {draft.baseRevision !== editor.baseRevision && <Text style={{fontSize: 12, color: colors.danger, lineHeight: 20}}>이후 카드가 수정되었어요. 오래된 초안은 바로 적용할 수 없어요.</Text>}
      <TextInput accessibilityLabel="생성된 초안 편집" value={content} onChangeText={setContent} editable={draft.status !== 'generating'} multiline style={[styles.field, {minHeight: 180}]}/>
      {draft.sources.map(source => <Button key={source.url} variant="ghost" small onPress={() => void Linking.openURL(source.url).catch(e => report(e))}>{source.title} ↗</Button>)}
      {editor.card.body.kind === 'template' && <><Text style={styles.small}>적용할 항목</Text><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>{fields.map(field => <Pill key={field.key} active={target === field.key} onPress={() => setTarget(field.key)}>{field.title}</Pill>)}</View><Button disabled={draft.status !== 'completed' || editor.dirty || draft.baseRevision !== editor.baseRevision} onPress={() => run(session.apply(draft, content, target))}>검토한 초안 적용</Button></>}
    </View>}
  </ScrollView>;
}
