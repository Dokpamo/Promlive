import {useState} from 'react';
import {View, Text, ScrollView, Pressable, TextInput} from 'react-native';
import type {Workspace} from '../../app/workspace';
import type {Card} from './model';
import {Button, Cover, Empty, Icon, Pill, cardStyles} from '../../layout/components';
import {colors, styles} from '../../layout/theme';

export function LibraryScreen({workspace: w, width, onCreate}: {workspace: Workspace; width: number; onCreate: () => void}) {
  const [kind, setKind] = useState('전체');
  const compact = width < 660;
  const cards = w.cards.filter(c => w.filter === 'archived' ? c.archived : !c.archived && (w.filter !== 'favorites' || c.favorite)).filter(c => `${c.title} ${c.description} ${c.genre}`.toLocaleLowerCase().includes(w.search.toLocaleLowerCase())).filter(c => kind === '전체' || (kind === '템플릿' ? c.body.kind === 'template' : c.body.kind === 'code'));
  const run = (work: Promise<unknown>) => void work.catch(error => w.report(error));
  return <ScrollView style={{flex: 1}} contentContainerStyle={{padding: compact ? 22 : 38, paddingBottom: 48}} keyboardShouldPersistTaps="handled">
    <View style={{maxWidth: 1180, width: '100%', alignSelf: 'center', gap: 31}}>
      {w.filter === 'all' && !w.search && <View style={{backgroundColor: '#EEEAF0', borderRadius: 14, padding: compact ? 24 : 33, minHeight: compact ? 234 : 230, overflow: 'hidden'}}>
        <View style={{maxWidth: compact ? '100%' : '70%', gap: 14, zIndex: 1}}>
          <Text style={[styles.eyebrow, {color: '#8D7A97'}]}>A SPACE FOR YOUR STORIES</Text>
          <Text style={{fontSize: compact ? 27 : 33, fontWeight: '500', letterSpacing: -1.3, lineHeight: compact ? 40 : 46, color: '#453A4B'}}>작은 상상이,{compact ? '\n' : ' '}하나의 세계로.</Text>
          <Text style={[styles.body, {color: '#8A7D90', maxWidth: 410, fontSize: 13}]}>세계를 그리고, 인물을 만나고, 이야기를 이어가세요.{compact ? '\n' : ' '}당신만의 이야기가 시작되는 곳, Promlive.</Text>
          <View style={{alignSelf: 'flex-start', marginTop: 6}}><Button onPress={onCreate} icon="plus">새 이야기 만들기</Button></View>
        </View>
        {!compact && <View accessible={false} style={{position: 'absolute', right: 37, bottom: -33, width: 220, height: 265}}>
          <View style={{position: 'absolute', width: 177, height: 205, right: 9, top: 1, borderTopLeftRadius: 100, borderTopRightRadius: 100, backgroundColor: '#D1C6DA'}}/>
          <View style={{position: 'absolute', width: 145, height: 189, right: 25, top: 17, borderTopLeftRadius: 86, borderTopRightRadius: 86, borderWidth: 1, borderColor: '#F4EFF6'}}/>
          <Text style={{position: 'absolute', top: 30, right: 60, fontSize: 45, color: '#F9F5E9'}}>☽</Text>
          <Text style={{position: 'absolute', top: 20, left: 10, fontSize: 27, color: '#B5A4C3'}}>✧</Text>
          <View style={{position: 'absolute', bottom: 53, left: 0, width: 155, height: 16, backgroundColor: '#A493B5', borderRadius: 3, transform: [{rotate: '-8deg'}]}}/>
          <View style={{position: 'absolute', bottom: 37, left: 19, width: 160, height: 22, backgroundColor: '#B8A8C6', borderRadius: 3, transform: [{rotate: '3deg'}]}}/>
          <View style={{position: 'absolute', bottom: 34, right: 15, width: 45, height: 52, backgroundColor: '#EEE4CF', borderBottomLeftRadius: 12, borderBottomRightRadius: 12}}/>
          <View style={{position: 'absolute', bottom: 65, right: 7, width: 13, height: 70, backgroundColor: '#8D9A85', borderRadius: 20, transform: [{rotate: '32deg'}]}}/>
        </View>}
      </View>}
      <View style={{gap: 20}}>
        <View style={[styles.row, {justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}]}>
          <View style={[styles.row, {gap: 10}]}><Text style={[styles.heading, {fontSize: 22}]}>{w.filter === 'favorites' ? '아끼는 이야기' : w.filter === 'archived' ? '보관한 이야기' : '내 이야기'}</Text><Text style={{fontSize: 12, color: colors.muted, backgroundColor: '#EDEAE3', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3}}>{cards.length}</Text></View>
          <View style={[styles.row, {gap: 10, flexWrap: 'wrap'}]}>
            <View style={[styles.row, {backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, gap: 7}]}><Icon name="search" size={20}/><TextInput accessibilityLabel="이야기 검색" placeholder="이야기 검색" placeholderTextColor={colors.faint} value={w.search} onChangeText={value => w.setSearch(value)} style={{fontSize: 12, width: compact ? 132 : 145, color: colors.ink, paddingVertical: 9}}/></View>
            {!compact && <Text style={styles.small}>최근 수정순 ↓</Text>}
          </View>
        </View>
        <View style={[styles.row, {gap: 7}]}>{['전체', '템플릿', '코드'].map(item => <Pill key={item} active={kind === item} onPress={() => setKind(item)}>{item}</Pill>)}</View>
        {cards.length === 0 ? <Empty title={w.search ? '검색 결과가 없어요' : '새로운 이야기를 기다리고 있어요'} action={<Button onPress={onCreate} icon="plus">이야기 만들기</Button>}>{w.search ? '다른 제목이나 키워드로 찾아보세요.' : '아직 쓰지 않은 첫 문장을 여기에 남겨 보세요.'}</Empty> : <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 19}}>
          {cards.map(card => <StoryCard key={card.id} card={card} width={compact ? '100%' : width < 990 ? '48%' : '31.8%'} onOpen={() => run(w.open(card.id))} onFavorite={() => run(w.favorite(card))}/>) }
        </View>}
      </View>
      {w.filter === 'all' && !w.search && <View style={{gap: 16}}>
        <View style={[styles.row, {gap: 9}]}><Icon name="spark" size={18}/><Text style={[styles.subheading, {fontSize: 15}]}>나만의 방식으로 시작하기</Text></View>
        <View style={{flexDirection: compact ? 'column' : 'row', gap: 16}}>
          <StartOption icon="world" title="차근차근, 템플릿으로" detail="세계관과 등장인물을 하나씩 채워 보세요." onPress={() => run(w.create('template'))}/>
          <StartOption icon="code" title="자유롭게, 코드로" detail="직접 만든 화면에 이야기를 담아 보세요." onPress={() => run(w.create('code'))}/>
        </View>
      </View>}
      <View style={[styles.row, {gap: 8, justifyContent: 'center'}]}><View style={{width: 5, height: 5, borderRadius: 3, backgroundColor: '#98A58E'}}/><Text style={[styles.small, {fontSize: 11}]}>이야기는 이 기기에 저장돼요. 영감은 어디서든 이어지고요.</Text></View>
    </View>
  </ScrollView>;
}
function StoryCard({card, width, onOpen, onFavorite}: {card: Card; width: `${number}%`; onOpen: () => void; onFavorite: () => void}) {
  const [hover, setHover] = useState(false);
  const character = card.body.kind === 'template' ? card.body.data.characterName : '코드 스튜디오';
  return <View style={[cardStyles.panel, {width, borderColor: hover ? '#C9BED1' : colors.line}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${card.title} 열기`} onPress={onOpen} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}>
      <Cover kind={card.cover}/>
      <View style={{padding: 19, paddingBottom: 13, gap: 10}}>
        <View style={[styles.row, {gap: 6}]}><Text style={{fontSize: 10, color: colors.accent, backgroundColor: '#F0EAF4', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 4}}>{card.genre || '오리지널'}</Text>{card.example && <Text style={{fontSize: 10, color: colors.faint}}>샘플 이야기</Text>}</View>
        <Text numberOfLines={1} style={{fontSize: 17, fontWeight: '600', color: colors.ink, letterSpacing: -0.5}}>{card.title}</Text>
        <Text numberOfLines={2} style={{fontSize: 12, lineHeight: 20, color: colors.muted, minHeight: 40}}>{card.description || '아직 비어 있는 첫 페이지. 당신만의 이야기를 적어 보세요.'}</Text>
      </View>
    </Pressable>
    <View style={[styles.row, {marginHorizontal: 19, paddingVertical: 10, borderTopWidth: 1, borderColor: '#F0EEE9', justifyContent: 'space-between'}]}>
      <View style={[styles.row, {gap: 7}]}><View style={{backgroundColor: '#F0EEE8', borderRadius: 12, width: 23, height: 23, alignItems: 'center', justifyContent: 'center'}}><Text style={{fontSize: 9, color: '#8C8477'}}>{character.slice(0, 1) || '·'}</Text></View><Text style={{fontSize: 11, color: colors.muted}}>{character || '등장인물 미정'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${card.title} ${card.favorite ? '즐겨찾기 해제' : '즐겨찾기'}`} onPress={onFavorite} style={{padding: 7, margin: -7}}><Icon name={card.favorite ? 'starFill' : 'star'} size={18} color={card.favorite ? colors.accent : colors.faint}/></Pressable>
    </View>
  </View>;
}
function StartOption({icon, title, detail, onPress}: {icon: string; title: string; detail: string; onPress: () => void}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.row, cardStyles.panel, {flex: 1, padding: 20, gap: 15, opacity: pressed ? 0.6 : 1}]}>
    <View style={{backgroundColor: '#F4F1EC', padding: 11, borderRadius: 11}}><Icon name={icon} color="#8A7F72" size={24}/></View><View style={{flex: 1, gap: 5}}><Text style={{fontSize: 13, color: colors.ink, fontWeight: '600'}}>{title}</Text><Text style={{fontSize: 11, color: colors.muted, lineHeight: 18}}>{detail}</Text></View><Icon name="arrow" size={18}/>
  </Pressable>;
}
