import {useState} from 'react';
import {View, Text, ScrollView, Pressable, TextInput, Switch} from 'react-native';
import type {Workspace} from '../../app/workspace';
import {AssistantPanel} from './AssistantPanel';
import {Button, Field, Icon, Pill} from '../../layout/components';
import {colors, mono, styles} from '../../layout/theme';
import {CodePreview} from '../../creator-sdk/CodePreview';
export function EditorScreen({workspace: w, width}: {workspace: Workspace; width: number}) {
  const editor = w.editor!; const card = editor.card;
  const [tab, setTab] = useState('세계관'); const [showAi, setShowAi] = useState(false);
  const [codeTab, setCodeTab] = useState<'html' | 'css' | 'javascript'>('html');
  const [preview, setPreview] = useState(0); const [allowed, setAllowed] = useState(false);
  const [runningCard, setRunningCard] = useState(card);
  const wide = width >= 1050; const compact = width < 660;
  const run = (promise: Promise<unknown>) => void promise.catch(e => w.report(e));
  return <View style={{flex: 1, flexDirection: 'row'}}>
    <View style={{flex: 1}}>
      <View style={[styles.row, {paddingVertical: 13, paddingHorizontal: compact ? 20 : 32, gap: 8, borderBottomWidth: 1, borderColor: colors.line, flexWrap: 'wrap', justifyContent: 'space-between', backgroundColor: '#FFF'}]}>
        <View style={[styles.row, {gap: 7}]}><Text style={{fontSize: 11, color: editor.status === 'error' ? colors.danger : colors.sageInk}}>{editor.status === 'saving' ? '◌ 편집 내용 보관 중' : editor.dirty ? '✓ 편집 초안 자동 보관됨' : '✓ 기기에 저장됨'}</Text><Text style={{fontSize: 10, color: colors.faint}}>r{editor.baseRevision}</Text></View>
        <View style={[styles.row, {gap: 6}]}>{!wide && <Button small variant="ghost" onPress={() => setShowAi(!showAi)} icon="spark">{showAi ? '편집하기' : 'AI 도우미'}</Button>}<Button small variant="secondary" onPress={() => run(w.save())}>저장</Button><Button small icon="chat" onPress={() => run(w.startChat(card))}>대화 시작</Button></View>
      </View>
      {!wide && showAi ? <AssistantPanel workspace={w}/> : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{padding: compact ? 22 : 34, paddingBottom: 50}}>
        <View style={{maxWidth: 770, width: '100%', alignSelf: 'center', gap: 27}}>
          <View style={{gap: 10}}><Text style={[styles.eyebrow, {color: colors.accent}]}>{card.body.kind === 'template' ? 'STORY STUDIO' : 'CODE STUDIO'}</Text><TextInput accessibilityLabel="이야기 제목" value={card.title} onChangeText={title => w.edit({title})} placeholder="이야기에 이름을 붙여 주세요" maxLength={120} style={{fontSize: compact ? 25 : 29, fontWeight: '600', letterSpacing: -1, paddingVertical: 8, color: colors.ink}}/><TextInput accessibilityLabel="이야기 소개" value={card.description} onChangeText={description => w.edit({description})} placeholder="이 이야기를 한두 문장으로 소개해 주세요." multiline maxLength={500} style={{fontSize: 13, color: colors.muted, lineHeight: 22, paddingVertical: 4, minHeight: 48}}/></View>
          <View style={[styles.row, {gap: 8, flexWrap: 'wrap'}]}><Text style={[styles.small, {marginRight: 6}]}>표지 색</Text>{(['moon', 'forest', 'sunset', 'code'] as const).map(cover => <Pressable key={cover} accessibilityRole="button" accessibilityLabel={`표지 ${cover}`} accessibilityState={{selected: card.cover === cover}} onPress={() => w.edit({cover})} style={{width: 26, height: 26, borderRadius: 13, borderWidth: card.cover === cover ? 2 : 0, borderColor: colors.accent, backgroundColor: {moon: '#DAD3E5', forest: '#C7D5BD', sunset: '#E5C6B2', code: '#C4CCD9'}[cover]}}/>)}<Text style={[styles.small, {marginLeft: 'auto'}]}>{card.body.kind === 'template' ? '세계관 + 등장인물' : 'HTML · CSS · JavaScript'}</Text></View>
          {card.body.kind === 'template' ? <>
            <View style={[styles.row, {gap: 24, borderBottomWidth: 1, borderColor: colors.line}]}>{['세계관', '등장인물', '대화 스타일'].map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{selected: tab === item}} onPress={() => setTab(item)} style={{paddingBottom: 14, borderBottomWidth: tab === item ? 2 : 0, borderColor: colors.accent}}><Text style={{fontSize: 13, color: tab === item ? colors.accent : colors.muted, fontWeight: tab === item ? '600' : '400'}}>{item}</Text></Pressable>)}</View>
            {tab === '세계관' && <View style={{gap: 24}}><Section number="01" title="어떤 세계인가요?" detail="이야기가 펼쳐질 공간과 그곳만의 규칙을 정해 보세요."/><Field label="세계관" value={card.body.data.world} onChangeText={v => w.editWorld('world', v)} multiline placeholder="이 세계는 어떤 모습인가요? 사람들은 무엇을 믿고, 어떻게 살아가나요?" style={{minHeight: 170}} maxLength={30000}/><Field label="시대와 장소" value={card.body.data.era} onChangeText={v => w.editWorld('era', v)} placeholder="예: 계절을 잊은 현대의 도시, 자정의 도서관" multiline style={{minHeight: 76}} maxLength={30000}/><Field label="세계의 규칙" value={card.body.data.rules} onChangeText={v => w.editWorld('rules', v)} multiline placeholder="가능한 것과 불가능한 것, 꼭 지켜야 하는 약속을 적어 주세요." hint="AI가 대화 중 일관되게 지켜야 할 설정이에요." maxLength={30000}/></View>}
            {tab === '등장인물' && <View style={{gap: 24}}><Section number="02" title="누구를 만나게 되나요?" detail="작은 습관부터 말투까지, 인물에게 생기를 불어넣어 주세요."/><Field label="등장인물 이름" value={card.body.data.characterName} onChangeText={v => w.editWorld('characterName', v)} maxLength={100} placeholder="어떻게 불러 주면 좋을까요?"/><Field label="역할과 배경" value={card.body.data.role} onChangeText={v => w.editWorld('role', v)} multiline maxLength={30000}/><Field label="성격과 말투" value={card.body.data.personality} onChangeText={v => w.editWorld('personality', v)} multiline maxLength={30000}/><Field label="사용자와의 관계" value={card.body.data.relationship} onChangeText={v => w.editWorld('relationship', v)} multiline maxLength={30000}/><Field label="첫 만남의 장면" value={card.body.data.greeting} onChangeText={v => w.editWorld('greeting', v)} multiline style={{minHeight: 150}} maxLength={30000}/></View>}
            {tab === '대화 스타일' && <View style={{gap: 24}}><Section number="03" title="이야기의 온도를 정해요" detail="어떤 분위기로, 어떤 속도로 이야기를 이어갈까요?"/><Field label="장르" value={card.genre} onChangeText={genre => w.edit({genre})} maxLength={40}/><Field label="대화 지침" value={card.body.data.tone} onChangeText={v => w.editWorld('tone', v)} multiline style={{minHeight: 180}} placeholder="문체, 응답 길이, 묘사 방식 등을 자유롭게 적어 주세요." maxLength={30000}/></View>}
          </> : <View style={{gap: 20}}>
            <Section number="01" title="직접 만드는 이야기 화면" detail="HTML과 CSS로 화면을 만들고, 격리된 JavaScript에서 creator SDK를 사용하세요."/>
            <View style={[styles.row, {gap: 8}]}>{(['html', 'css', 'javascript'] as const).map(item => <Pill key={item} active={codeTab === item} onPress={() => setCodeTab(item)}>{item.toUpperCase()}</Pill>)}</View>
            <TextInput accessibilityLabel={`${codeTab} 소스`} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false} value={card.body.source[codeTab]} onChangeText={value => {if (card.body.kind === 'code') w.edit({body: {...card.body, source: {...card.body.source, [codeTab]: value}}});}} style={[styles.field, {fontFamily: mono, fontSize: 12, minHeight: 300, backgroundColor: '#F1EFEA'}]} maxLength={30000}/>
            <Text style={styles.small}>화면 변경: creator.text(selector, text){'\n'}이벤트: creator.on('click', selector, handler){'\n'}AI 요청: creator.generate(prompt) · 중단: creator.cancel(requestId){'\n'}DOM 직접 접근과 외부 네트워크는 제공하지 않아요.</Text>
            <View style={[styles.row, {gap: 12}]}><Switch accessibilityLabel="코드 AI 호출 권한" value={allowed} onValueChange={setAllowed} disabled={!w.runtime.provider.connected}/><Text style={styles.small}>이번 실행에 AI 호출 허용</Text></View>
            <View style={[styles.row, {gap: 8}]}><Button icon="code" onPress={() => {setRunningCard(card); setPreview(v => v + 1);}}>코드 실행</Button>{preview > 0 && <Button variant="secondary" icon="stop" onPress={() => setPreview(0)}>실행 종료</Button>}</View>
            {preview > 0 && <CodePreview key={preview} card={runningCard} runtime={w.runtime} allowed={allowed}/>}
          </View>}
          <View style={{height: 1, backgroundColor: colors.line}}/>
          <View style={[styles.row, {justifyContent: 'space-between', flexWrap: 'wrap', gap: 8}]}><Button small variant="ghost" icon="copy" onPress={() => run(w.duplicate(card))}>카드 복제</Button><Button small variant="ghost" icon="archive" onPress={() => run(w.archive(card))}>{card.archived ? '서재로 가져오기' : '보관함으로 이동'}</Button></View>
        </View>
      </ScrollView>}
    </View>
    {wide && <View style={{width: 320, borderLeftWidth: 1, borderColor: colors.line}}><AssistantPanel workspace={w}/></View>}
  </View>;
}
function Section({number, title, detail}: {number: string; title: string; detail: string}) { return <View style={{gap: 7}}><View style={[styles.row, {gap: 10}]}><Text style={{fontSize: 12, color: '#A79BAC', fontFamily: mono}}>{number}</Text><Text style={styles.subheading}>{title}</Text></View><View style={[styles.row, {gap: 8}]}><Icon name="" size={0}/><Text style={styles.small}>{detail}</Text></View></View>; }
