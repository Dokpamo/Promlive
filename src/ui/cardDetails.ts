export type GalleryImage = {id: string; tile: number; title: string};

export const nightLibraryDetails = {
  tags: ['일상 판타지', '도서관', '다정한 사서', '느린 이야기'],
  summary: '길을 잃은 밤에만 문을 여는 작은 도서관. 이곳의 책에는 누군가 미처 끝내지 못한 하루와 아직 전하지 못한 마음이 담겨 있어요.\n\n사서 서율은 당신을 재촉하지 않아요. 창가에 앉아 책을 한 권 고르고, 오늘 있었던 일을 들려주세요. 두 사람의 대화가 쌓일수록 비어 있던 책장에도 새로운 이야기가 생겨납니다.',
  introduction: '문 위의 작은 종이 울린다. 비에 젖은 골목 대신, 따뜻한 종이 냄새와 낮은 조명이 당신을 맞는다.\n\n창가에서 책을 정리하던 서율이 고개를 든다. 처음 만나는 사이인데도, 오래 기다린 사람을 발견한 듯 미소 짓는다.\n\n“왔구나. 네가 찾던 책을 창가에 두었어.”\n\n그녀는 별이 새겨진 남색 책을 가볍게 두드린다.\n\n“오늘은 책을 읽어도 좋고, 그냥 쉬어 가도 좋아. 어떤 하루였어?”',
  guide: '당신은 우연히 도서관을 발견한 방문자예요. 이름이나 오늘의 기분을 이야기하며 시작해 보세요.\n\n말은 그대로 적고, 행동이나 주변 묘사는 괄호로 적어도 좋아요. 예: (창가 자리에 앉으며) 오늘은 조금 조용히 있고 싶어.\n\n정해진 결말이나 시간 제한은 없어요. 서율과 함께 책을 고르거나, 도서관의 비밀을 천천히 찾아가도 좋아요.',
  gallery: [
    {id: 'portrait', tile: 0, title: '별을 닮은 사서, 서율'},
    {id: 'reading', tile: 12, title: '창가에서 함께 읽는 밤'},
    {id: 'library', tile: 13, title: '아직 잠들지 않은 도서관'},
  ],
};

export function defaultCardDetails(id: string, tile: number) {
  return id === 'night-library' ? nightLibraryDetails : {
    tags: ['이야기', '캐릭터'], guide: '', gallery: [{id: 'cover', tile, title: '이야기의 한 장면'}],
  };
}
