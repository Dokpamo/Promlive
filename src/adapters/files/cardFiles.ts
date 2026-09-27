import {NativeModules} from 'react-native';
import type {CardAsset} from '../../features/authoring/assets';

interface FileBridge {
  pickCard(): Promise<string | null>;
  pickAsset(): Promise<Omit<CardAsset, 'id'> | null>;
  exportCard(name: string, contents: string, share: boolean): Promise<boolean>;
}
function bridge(): FileBridge {
  const module = NativeModules.PromliveCardFiles as FileBridge | undefined;
  if (!module) throw new Error('이 기기에서는 아직 카드 파일 선택을 사용할 수 없어요.');
  return module;
}
export const pickCardFile = () => bridge().pickCard();
export const pickCardAsset = () => bridge().pickAsset();
export const saveCardFile = (name: string, contents: string, share = false) => bridge().exportCard(name, contents, share);
