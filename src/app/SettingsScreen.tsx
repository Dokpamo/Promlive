import {View, Text, ScrollView, Platform} from 'react-native';
import type {Workspace} from './workspace';
import {Button, Icon, cardStyles} from '../layout/components';
import {colors, styles} from '../layout/theme';
export function SettingsScreen({workspace: w}: {workspace: Workspace}) {
  return <ScrollView contentContainerStyle={{padding: 30, paddingBottom: 60}}><View style={{maxWidth: 740, width: '100%', alignSelf: 'center', gap: 29}}>
    <View style={{gap: 9}}><Text style={styles.eyebrow}>YOUR OWN SPACE</Text><Text style={styles.heading}>작업실 설정</Text><Text style={styles.small}>이야기에 집중할 수 있도록, 나에게 맞는 환경을 준비해요.</Text></View>
    <View style={[cardStyles.panel, {padding: 25, gap: 20}]}><View style={[styles.row, {gap: 10}]}><Icon name="spark" color={colors.accent}/><Text style={styles.subheading}>AI 연결</Text><View style={[styles.badge, {marginLeft: 'auto'}]}><Text style={{fontSize: 11, color: colors.accent}}>나중에 연결</Text></View></View>
      <Text style={styles.body}>지금은 직접 만드는 시간</Text><Text style={styles.small}>카드 작성과 편집, 로컬 저장, 코드 화면 제작을 바로 사용할 수 있어요. 실제 AI 생성과 자료 조사는 제공자를 연결한 뒤 사용할 수 있습니다.</Text>
      <View style={{backgroundColor: '#F5F2F7', padding: 18, borderRadius: 9, gap: 8}}><Text style={{fontSize: 13, fontWeight: '600', color: colors.accent}}>예정된 테스트 연결 · Grok</Text><Text style={styles.small}>OAuth 연결은 테스트 단계에서 지원 방식과 권한을 확인한 뒤 추가합니다. 현재 로그인이나 외부 AI 요청은 실행하지 않습니다.</Text></View>
      <View style={styles.divider}/><Text style={[styles.body, {fontSize: 13}]}>어떤 내용이 외부로 전달되나요?</Text><Text style={styles.small}>작성·조사: 저장된 카드 설정과 요청 내용{ '\n'}채팅: 카드 설정, 입력 한도 내 최근 대화, 새 메시지{ '\n'}코드 카드: 실행 시 허용한 AI 요청과 해당 카드의 제목·소개</Text>
    </View>
    <View style={[cardStyles.panel, {padding: 25, gap: 17}]}><View style={[styles.row, {gap: 10}]}><Icon name="archive" color={colors.sageInk}/><Text style={styles.subheading}>내 이야기와 저장</Text></View><Text style={styles.small}>카드 {w.cards.length}개 · 대화 {w.history.items.length}개{ '\n'}카드와 대화는 이 기기의 SQLite에 저장됩니다. 계정 가입 없이 편집할 수 있어요. 보관한 카드는 서재에서 다시 가져올 수 있습니다.</Text>{Platform.OS === 'web' && <Text style={styles.small}>브라우저 미리보기의 데이터는 이 브라우저에만 저장됩니다. 브라우저 저장소를 지우면 사라지며, 네이티브 앱과 자동으로 공유되지 않습니다.</Text>}<Button variant="secondary" onPress={() => w.setFilter('archived')} style={{alignSelf: 'flex-start'}}>보관함 열기</Button></View>
    <View style={[cardStyles.panel, {padding: 25, gap: 12}]}><Text style={styles.subheading}>코드 카드 실행</Text><Text style={styles.small}>화면은 격리된 영역에 표시하고 JavaScript는 별도 작업자에서 실행합니다. 외부 통신, 앱 데이터와 인증 정보 직접 접근을 허용하지 않습니다. AI 요청은 실행마다 허용하며 동시 1개, 분당 6개로 제한합니다.</Text><Text style={styles.small}>응답하지 않는 코드는 중단하고, 실행은 최대 5분 후 종료합니다. 소스는 저장한 카드에 그대로 남아요.</Text></View>
    <View style={{gap: 6, alignItems: 'center', paddingVertical: 15}}><Text style={{fontSize: 21, color: colors.accent, fontWeight: '500', letterSpacing: 4}}>Promlive</Text><Text style={styles.small}>당신의 이야기가 머무는 곳 · 0.1.0</Text></View>
  </View></ScrollView>;
}
