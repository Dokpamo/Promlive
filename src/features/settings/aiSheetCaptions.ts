import type {AiCatalogKind} from '../../ports/aiCatalog';

export const reasoningLevelCaption = '답변을 만들 때 추론에 들일 노력을 선택해요.';
export const providerCaption = '연결할 AI 서비스를 선택해요.';

export const catalogCaptions: Record<AiCatalogKind, string> = {
  chat: '대화에 사용할 모델을 선택해요.',
  image: '이미지를 만들 때 사용할 모델을 선택해요.',
  video: '영상을 만들 때 사용할 모델을 선택해요.',
  audio: '음성을 처리할 모델을 선택해요.',
  voice: '텍스트를 읽어 줄 목소리를 선택해요.',
};

export const aiChoiceCaptions: Record<string, string> = {
  '연결 방식': '이 서비스에 연결할 방법을 선택해요.',
  'API 형식': '연결할 서버에서 지원하는 요청 형식을 선택해요.',
  '생각 모드': '답변하기 전에 추론을 사용할지 선택해요.',
  '추론 레벨': reasoningLevelCaption,
  '답변 상세도': '답변을 얼마나 자세하게 작성할지 선택해요.',
  '데이터 정책': '요청을 처리할 업체의 데이터 보관 조건을 선택해요.',
  '모델을 메모리에 유지': '대화가 끝난 뒤에도 모델을 메모리에 둘 시간을 선택해요.',
};
