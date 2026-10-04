import {Pressable, Text} from 'react-native';
import type {ScreenMemoryController} from './ScreenController';
import type {ScreenStorageIssue} from './screenState';
import {usePalette} from './Theme';

const messages: Record<ScreenStorageIssue, string> = {
  corrupt: '저장한 데이터를 읽을 수 없어 원본을 보존하고 있어요.',
  unsupported: '다른 버전에서 저장한 데이터예요. 원본을 보존하고 있어요.',
  conflict: '다른 창의 변경과 충돌해 저장하지 못했어요. 이 창의 수정 내용은 아직 저장되지 않았어요.',
  read: '저장한 데이터를 불러오지 못했어요. 눌러서 다시 시도',
  write: '변경 내용을 저장하지 못했어요. 눌러서 다시 시도',
};
export function StorageIssueBanner({memory, issue}: {memory: ScreenMemoryController; issue: ScreenStorageIssue | null}) {
  const colors = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel="화면 저장 다시 시도" onPress={() => {void memory.refresh().then(memory.flush);}}
    style={{padding: 12, backgroundColor: colors.surface}}>
    <Text accessibilityRole="alert" style={{color: colors.error}}>{messages[issue ?? 'write']}</Text>
  </Pressable>;
}
