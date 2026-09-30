/** Local display fixtures only. No records are written to the user's library. */
export const libraryPreviewCards = [
  // First row: short captions, a two-line title, then title and creator overflow.
  {id: 'night-library', title: '별이 머무는 도서관', character: '서율', creator: '별담', tile: 0, activity: 'recent'},
  {id: 'forest-post', title: '숲의 마지막 우체국에서', character: '이든', creator: '초록우편의 작은 이야기 작업실', tile: 1, activity: 'recent'},
  {id: 'orbit-cafe', title: '오후 다섯 시의 궤도에서 시작하는 아주 길고도 특별한 우주 정거장 이야기', character: '노아 Noah', creator: '오후의 우주 정거장에서 이야기를 만드는 아주 긴 이름의 창작 스튜디오', tile: 2, activity: 'recent'},
  // Second row also covers title-only and creator-only overflow.
  {id: 'blue-stage', title: '푸른 밤의 멜로디와 당신에게 전하지 못했던 오래된 노래에 관한 이야기', character: '세나', creator: '파랑', tile: 3, activity: 'recent'},
  {id: 'rain-detective', title: '비가 그치기 전에', character: '도윤', creator: '비 오는 도시의 골목에서 오래된 사건을 기록하는 누아르 창작 연구소', tile: 4, activity: 'idle'},
  {id: 'glass-garden', title: '유리 온실의 비밀', character: '하린', creator: '꽃비', tile: 5, activity: 'recent'},
  {id: 'sky-captain', title: '구름 위의 항해', character: '리온', creator: '하늘결', tile: 6, activity: 'idle'},
  {id: 'crimson-knight', title: '붉은 맹세', character: '아린', creator: '밤의잉크', tile: 7, activity: 'idle'},
  {id: 'moon-spirit', title: '달빛 정원의 작은 손님', character: '모모', creator: '달솜', tile: 8, activity: 'recent'},
  {id: 'seaside-artist', title: '여름을 그리는 사람', character: '유진', creator: '여름끝', tile: 9, activity: 'idle'},
  {id: 'star-observer', title: '별을 세는 밤', character: '루나', creator: '은하', tile: 10, activity: 'idle'},
  {id: 'autumn-traveler', title: '가을을 걷는 검객', character: '진', creator: '붉은잎', tile: 11, activity: 'idle'},
] as const;
