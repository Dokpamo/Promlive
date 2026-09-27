import {bundleMaxBytes} from '../../features/authoring/cardBundle';

function pick(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept;
    input.style.display = 'none'; document.body.append(input);
    const done = (file: File | null) => {input.remove(); resolve(file);};
    input.onchange = () => done(input.files?.[0] ?? null); input.oncancel = () => done(null); input.click();
  });
}
export async function pickCardFile() {
  const file = await pick('.promcard,application/json,application/octet-stream');
  if (!file) return null;
  if (file.size > bundleMaxBytes) throw new Error('카드 파일은 32MB까지 가져올 수 있어요.');
  return file.text();
}
export async function pickCardAsset() {
  const file = await pick('audio/*,text/plain,application/json,application/pdf,application/octet-stream');
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error('개별 에셋은 10MB까지 연결할 수 있어요.');
  const mime = /^(audio\/(mpeg|mp4|wav|x-wav|ogg)|text\/plain|application\/(json|pdf))$/.test(file.type) ? file.type : 'application/octet-stream';
  const uri = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, `data:${mime};`)); reader.onerror = () => reject(new Error('파일을 읽지 못했어요.')); reader.readAsDataURL(file);});
  return {uri, width: 0, height: 0, name: file.name.slice(0, 180)};
}
export async function saveCardFile(name: string, contents: string, share = false) {
  const file = new File([contents], name, {type: 'application/octet-stream'});
  if (share && navigator.canShare?.({files: [file]})) {
    try {await navigator.share({files: [file], title: name}); return true;}
    catch (error) {if (error instanceof DOMException && error.name === 'AbortError') return false; throw error;}
  }
  const url = URL.createObjectURL(file), anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); return true;
}
