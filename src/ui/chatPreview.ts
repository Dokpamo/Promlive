import {libraryPreviewCards} from './libraryPreview';
import {previewConversation} from './chatConversation';

/** Initial local conversations; ScreenMemory preserves later messages and drafts. */
const assistantReplies: Record<typeof libraryPreviewCards[number]['id'], string> = {
  'night-library': '왔구나. 네가 찾던 책을 창가에 두었어.\n오늘은 어디까지 읽어볼까?',
  'forest-post': '편지를 받으러 온 거야? 마침 너에게 전해 줄 이야기가 있었어.',
  'orbit-cafe': '창밖을 봐. 방금 지나간 유성은 이 궤도에서 일 년에 한 번만 볼 수 있어. 소원은 빌었어?',
  'blue-stage': '이 노래 기억나? 네가 처음 공연장에 왔던 날에도 불렀던 곡이야.',
  'rain-detective': '잠깐, 이 사진을 봐. 우리가 놓친 단서가 처음부터 여기에 있었어.',
  'glass-garden': '조심해, 이제 막 꽃이 피기 시작했거든. 네가 와서 그런 걸지도 모르겠다.',
  'sky-captain': '바람이 바뀌었어. 돛을 올리면 해가 지기 전에 저 섬에 도착할 수 있을 거야.',
  'crimson-knight': '약속했잖아. 무슨 일이 있어도 네 곁을 지키겠다고.',
  'moon-spirit': '왔어? 보고 싶었어.',
  'seaside-artist': '가만히 있어 봐. 지금 네 얼굴에 비치는 햇빛을 그림에 담고 싶어.',
  'star-observer': '오늘 밤은 망원경 없이도 잘 보일 거야. 저기 가장 밝은 별부터 찾아볼래?',
  'autumn-traveler': '여기서 잠깐 쉬어 가자. 다음 고개를 넘으면 내가 살던 마을이 나와.',
};

// Keep last chat activity separate from the latest AI reply shown in the preview.
const previewNow = Date.now();
const previewYear = new Date(previewNow).getFullYear();
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const lastChatTimes: Record<typeof libraryPreviewCards[number]['id'], number> = {
  'night-library': previewNow - 3 * minute,
  'forest-post': previewNow - 50 * minute,
  'orbit-cafe': previewNow - 3 * hour,
  'blue-stage': previewNow - 12 * hour,
  'rain-detective': previewNow - 23 * hour,
  'glass-garden': previewNow - 2 * day,
  'sky-captain': previewNow - 7 * day,
  'crimson-knight': previewNow - 14 * day,
  'moon-spirit': previewNow - 30 * day,
  'seaside-artist': previewNow - 60 * day,
  'star-observer': new Date(previewYear - 1, 2, 7, 12).getTime(),
  'autumn-traveler': new Date(previewYear - 2, 10, 18, 12).getTime(),
};

export const chatPreviewRows = libraryPreviewCards.map(card => ({
  id: card.id,
  title: card.title,
  character: card.character,
  tile: card.tile,
  lastChatAt: lastChatTimes[card.id],
  lastAssistantMessage: assistantReplies[card.id].replace(/\s+/g, ' ').trim(),
  ...previewConversation(card.id, assistantReplies[card.id], lastChatTimes[card.id]),
}));
