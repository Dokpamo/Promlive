import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../../App';
import {WorkspaceMemory} from '../../../src/ui/workspace/WorkspaceMemory';
import {IndexedWorkspace} from '../../../src/ui/workspace/IndexedWorkspace';
import {cardIndexes, chatIndex, metadata} from '../../../src/ui/workspace/types';
import {workspaceTuning} from '../../../src/ui/workspace/tuning';
import {initialScreenView} from '../../../src/ui/screenState';
import {fixtureCard, fixtureChat, fixtureMessage, fixtureSize} from '../fixture';
import '../../../web/styles.css';

const databaseName='promlive-isolated-performance';
const request=<T,>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function fixture(report:(text:string)=>void) {
  const store=new IndexedWorkspace(databaseName);
  await store.initialize(async()=>({data:{cards:[],chats:[]},view:initialScreenView(),positions:{}}));
  const db=await request(indexedDB.open(databaseName,1));
  if(await request(db.transaction('meta').objectStore('meta').get('fixture-complete'))) {db.close(); return store;}
  async function write(names:string[], work:(tx:IDBTransaction)=>void){const tx=db.transaction(names,'readwrite');const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});work(tx);await done;}
  await write(['cards','chats','index','heads','messages'],tx=>{for(const name of ['cards','chats','index','heads','messages'])tx.objectStore(name).clear();});
  for(let start=0;start<fixtureSize.cards;start+=100){
    await write(['cards','index','chats'],tx=>{for(let i=start;i<Math.min(start+100,fixtureSize.cards);i++){
      const card=fixtureCard(i), chat=fixtureChat(i);
      tx.objectStore('cards').put({id:card.id,revision:1,value:card});
      for(const entry of cardIndexes(card))tx.objectStore('index').put(entry);
      tx.objectStore('chats').put({id:chat.id,revision:1,value:{...metadata(chat),lastSequence:i===0?20_000:2}});
      tx.objectStore('index').put(chatIndex(chat));
    }});report(`카드·채팅방 ${Math.min(start+100,10000)} / 10,000`);
  }
  const total=39998;
  for(let start=0;start<total;start+=80){
    await write(['messages','heads'],tx=>{for(let index=start;index<Math.min(start+80,total);index++){
      const chatIndex=index<20000?0:Math.floor((index-20000)/2)+1;
      const sequence=index<20000?index+1:(index-20000)%2+1;
      const row=fixtureMessage(sequence,chatIndex),chatId=fixtureChat(chatIndex).id;
      tx.objectStore('messages').put({...row,chatId});
      tx.objectStore('heads').put({chatId,sequence,characters:row.text.length});
    }});report(`1만 자 메시지 ${Math.min(start+80,total)} / ${total.toLocaleString()}`);
  }
  await write(['meta'],tx=>tx.objectStore('meta').put(true,'fixture-complete'));
  db.close();return store;
}
const cache={read:()=>sessionStorage.getItem(databaseName+':cache'),write:async(value:string)=>{sessionStorage.setItem(databaseName+':cache',value);}};
const legacy={read:async()=>null,readSync:()=>null,readBackupSync:()=>null,readViewSync:()=>null,write:async()=>{},writeView:async()=>{}};
function Harness(){
  const [memory,setMemory]=useState<WorkspaceMemory|null>(null),[status,setStatus]=useState('별도 DB · 카드 1만 · 채팅방 1만 · 최대 1만 턴 · 각 메시지 1만 자');
  const [busy,setBusy]=useState(false),[screen,setScreen]=useState('library');
  const [reads]=useState<any[]>([]),[result,setResult]=useState('');
  async function start(){setBusy(true);try{
    const store=await fixture(setStatus);
    for(const method of ['list','messages','card','chat'] as const){const original=store[method].bind(store) as(...args:any[])=>Promise<any>;
      (store as any)[method]=async(...args:any[])=>{const before=performance.now(),result=await original(...args);reads.push({method,ms:performance.now()-before,count:result?.messages?.length??result?.rows?.length,characters:result?.messages?.reduce((n:number,x:any)=>n+x.text.length,0)});return result;};}
    const next=new WorkspaceMemory(legacy,store,cache);await next.initialize();next.updateView(view=>({...view,tab:'library',chatId:null,detailCardId:null,openedCardId:null}));
    setResult(JSON.stringify({restored:next.getScroll('library:all'),cacheCharacters:cache.read()?.length}));setMemory(next);setStatus('더미 데이터 준비 완료');
  }catch(error){setStatus(String(error));}finally{setBusy(false);}}
  async function route(next:string){if(!memory)return;setScreen(next);if(next==='chat'){memory.resetScroll('chat:perf-00000');await memory.prepareChat('perf-00000');}
    memory.updateView(v=>({...v,tab:next==='chat'?'chats':next as any,chatId:next==='chat'?'perf-00000':null,openedCardId:null,detailCardId:null}));}
  async function scrollTest(){if(!memory)return;setBusy(true);reads.splice(0);const id=screen==='chat'?'ui-chat-messages':screen==='library'?'ui-library-grid':screen==='chats'?'ui-chats-list':'ui-create-list';
    let el=document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    if(!el){setResult('스크롤 영역을 찾지 못했습니다: '+id);setBusy(false);return;}
    const times:number[]=[];let last=performance.now(),start=last;const speed=screen==='chat'?-4:2.5;
    await new Promise<void>(resolve=>{function frame(now:number){times.push(now-last);el.scrollTop+=Math.min(now-last,50)*speed;last=now;if(now-start<12000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    const frames=times.slice(2).sort((a,b)=>a-b),room=memory.room('perf-00000')?.snapshot();
    setResult(JSON.stringify({screen,frames:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],max:Math.max(...frames),over34ms:frames.filter(x=>x>34).length,reads:reads.slice(),retainedCharacters:room?.messages.reduce((n,x)=>n+x.text.length,0),tuning:workspaceTuning}));setBusy(false);
  }
  return <><div style={{height:48,display:'flex',alignItems:'center',gap:8,padding:'0 12px',font:'13px system-ui',background:'#ededed'}}>
    {!memory?<button disabled={busy} onClick={start}>더미 데이터 준비</button>:<><button onClick={()=>route('library')}>카드</button><button onClick={()=>route('chats')}>채팅 목록</button><button onClick={()=>route('chat')}>1만 턴 채팅</button><button disabled={busy} onClick={scrollTest}>12초 빠른 스크롤</button></>}
    <span role="status">{status}</span><details style={{maxWidth:350}}><summary>측정 결과</summary><textarea readOnly aria-label="측정 결과" value={result} style={{position:'absolute',zIndex:999,width:600,height:300,fontSize:12}}/></details>
  </div><div style={{position:'absolute',top:48,bottom:0,left:0,right:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>{memory&&<App memory={memory}/>}</div></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
