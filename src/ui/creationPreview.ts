import {libraryPreviewCards} from './libraryPreview';

export type CreationFilter = 'all' | 'draft' | 'ready' | 'mine' | 'external';
export type PreviewCard = typeof libraryPreviewCards[number];
export type CreationItem = {
  card: PreviewCard;
  modifiedAt: number;
  summary: string;
  introduction: string;
};

const hour = 60 * 60_000;
const now = Date.now();
const scenes = [
  ['별빛이 스며드는 도서관의 기록지기와 나누는 이야기.', '늦은 밤, 불이 켜진 도서관에서 서율이 당신을 기다립니다. 책장 사이로 작은 별빛이 흘러내립니다.'],
  ['숲속 우체국에 도착한 이름 없는 편지를 따라가는 여행.', '이든은 낡은 우편함에서 편지 한 통을 꺼내 당신에게 건넵니다. 봉투에는 아직 가 본 적 없는 마을의 이름이 적혀 있습니다.'],
  ['우주 정거장의 카페에서 시작되는 평범하고 특별한 하루.', '창밖으로 행성이 천천히 지나갑니다. 노아는 따뜻한 잔을 내려놓고 오늘 어디로 떠날지 묻습니다.'],
  ['작은 공연장에서 다시 만난 가수와 잊힌 노래의 기억.', '연습이 끝난 공연장에 마지막 조명 하나가 남아 있습니다. 세나가 당신을 발견하고 기타를 다시 집어 듭니다.'],
  ['비 오는 도시의 미해결 사건을 함께 추적하는 이야기.', '문 아래로 오래된 사진 한 장이 밀려 들어옵니다. 도윤은 사진 속 골목을 가리키며 외투를 챙깁니다.'],
  ['계절을 잃어버린 온실에서 조금씩 피어나는 비밀.', '새벽의 온실에는 처음 보는 꽃이 피어 있습니다. 하린은 당신이 가까이 다가가자 조용히 손짓합니다.'],
  ['구름 위를 항해하는 배에서 만나는 새로운 풍경.', '리온은 돛줄을 당기고 지평선 너머를 바라봅니다. 구름 사이로 아직 지도에 없는 섬이 모습을 드러냅니다.'],
  ['오래된 약속을 지키기 위해 길을 나서는 기사.', '성문이 닫히기 직전, 아린이 당신의 이름을 부릅니다. 붉은 망토 아래로 오래된 서약의 문장이 보입니다.'],
  ['달빛 아래 정원에 찾아오는 작은 손님과의 일상.', '달이 뜨자 정원의 작은 문이 열립니다. 모모가 두 손에 꽃잎을 가득 담은 채 당신에게 달려옵니다.'],
  ['바닷가 작업실에서 함께 완성하는 여름의 그림.', '유진은 아직 비어 있는 캔버스를 창가로 옮깁니다. 파도 소리가 들리는 오후, 오늘 그릴 풍경을 함께 고릅니다.'],
  ['별을 관찰하는 밤마다 조금씩 이어지는 이야기.', '관측소의 지붕이 열리고 밤하늘이 펼쳐집니다. 루나는 오늘 처음 발견한 별의 좌표를 보여 줍니다.'],
  ['가을 산길을 함께 걷는 검객과의 느린 여행.', '낙엽이 내려앉은 길 끝에서 진이 걸음을 멈춥니다. 다음 마을로 가기 전 잠시 쉬어 가자며 자리를 내어 줍니다.'],
] as const;

/** Local UI examples shared by the creation list and its card preview. */
export const creationPreviewItems: CreationItem[] = libraryPreviewCards.map((card, index) => {
  const scene = scenes[index];
  if (!scene) throw new Error(`Missing card preview story: ${card.id}`);
  return {card, modifiedAt: now - (index === 0 ? 10 * 60_000 : index < 4 ? index * 3 * hour : index * 24 * hour),
    summary: scene[0], introduction: scene[1]};
});

export const creationFilters = [
  {id: 'all', label: '전체'},
  {id: 'draft', label: '작업 중'},
  {id: 'ready', label: '완성'},
  {id: 'mine', label: '내 카드'},
  {id: 'external', label: '외부 카드'},
] as const;
