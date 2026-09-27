import {useRef} from 'react';
import {SettingsChoice, SettingsSheet} from '../settings/SettingsLayout';
import {pickCardFile} from '../../adapters/files/cardFiles';

export function CardCreateChoice({onClose, create, importCard, report}: {onClose: () => void; create: () => Promise<void>; importCard: (contents: string) => Promise<void>; report: (error: unknown) => void}) {
  const next = useRef<(() => Promise<void>) | null>(null);
  return <SettingsSheet title="카드 추가" onClose={() => {onClose(); const action = next.current; next.current = null; if (action) void action().catch(report);}}>{close => <>
    <SettingsChoice label="새로 만들기" detail="채팅으로 만들거나 직접 구성해요." selected={false} onPress={() => {next.current = create; close();}}/>
    <SettingsChoice label="파일 가져오기" detail="다른 사람이 공유한 .promcard 파일을 열어요." selected={false} onPress={() => {next.current = async () => {const text = await pickCardFile(); if (text) await importCard(text);}; close();}}/>
  </>}</SettingsSheet>;
}
