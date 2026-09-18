import type {CardBody} from '../features/cards/model';
type CodeSource = Extract<CardBody, {kind: 'code'}>['source'];
// Keep HTML/CSS out of the trusted bootstrap's parser context.
const serialize = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export function sandboxDocument(source: CodeSource, instance: string) {
  const workerBootstrap = `
    const instance = ${serialize(instance)};
    const pending = new Map(); const handlers = new Map(); let serial = 0;
    const send = self.postMessage.bind(self);
    setInterval(() => send({type:'heartbeat'}), 200);
    self.creator = Object.freeze({
      version: 1,
      text(selector, value) { send({type:'text',selector,text:String(value).slice(0,30000)}); },
      on(event, selector, callback) { const id=String(++serial); handlers.set(id,callback); send({type:'listen',event,selector,id}); },
      generate(prompt) { const id=String(++serial); const p=new Promise((resolve,reject)=>pending.set(id,{resolve,reject})); p.requestId=id; send({sdk:1,instance,id,type:'generate',prompt}); return p; },
      cancel(id) { send({sdk:1,instance,id,type:'cancel'}); }
    });
    self.onmessage = async ({data}) => {
      if(data.type==='event') { try { await handlers.get(data.id)?.({value:data.value}); } catch(e) { send({type:'runtime-error',text:String(e.message)}); } }
      else { const p=pending.get(data.id); if(p) {pending.delete(data.id); data.type==='result'?p.resolve(data.text):p.reject(new Error(data.text));} }
    };
    try {\n${source.javascript}\n} catch(e) { send({type:'runtime-error',text:String(e.message)}); }
  `;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>body{font-family:system-ui;margin:0;padding:24px}button,input,textarea{font:inherit}*{box-sizing:border-box}</style></head><body><div id="creator-root"></div><script>
  (()=>{
    const instance=${serialize(instance)};
    const source=${serialize(source)};
    const root=document.getElementById('creator-root');
    const template=document.createElement('template'); template.innerHTML=source.html;
    const allowed=new Set('MAIN SECTION ARTICLE HEADER FOOTER DIV P H1 H2 H3 H4 SPAN BUTTON LABEL INPUT TEXTAREA UL OL LI STRONG EM SMALL PRE CODE BR HR'.split(' '));
    for(const el of [...template.content.querySelectorAll('*')]) {
      if(!allowed.has(el.tagName)){el.remove();continue;}
      for(const attr of [...el.attributes]) if(!['id','class','placeholder','type','value','aria-label','disabled'].includes(attr.name)) el.removeAttribute(attr.name);
      if(el.tagName==='INPUT' && !['text','number','checkbox','range'].includes(el.type)) el.type='text';
    }
    root.append(template.content); const style=document.createElement('style'); style.textContent=source.css; document.head.append(style);
    const tell=(msg)=>{const text=JSON.stringify(msg);if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);else parent.postMessage(msg,'*');};
    const blob=new Blob([${serialize(workerBootstrap)}],{type:'text/javascript'}); const url=URL.createObjectURL(blob);
    const worker=new Worker(url); URL.revokeObjectURL(url);
    let lastBeat=Date.now(), count=0, period=Date.now(), stopped=false;
    const stop=(message)=>{if(stopped)return;stopped=true;worker.terminate();clearInterval(watchdog);tell({type:'runtime-error',instance,text:message});};
    const watchdog=setInterval(()=>{if(Date.now()-lastBeat>2000)stop('코드가 응답하지 않아 실행을 중단했어요.');},500);
    const lifetime=setTimeout(()=>stop('실행 시간 5분이 지나 종료했어요. 다시 실행할 수 있어요.'),300000);
    window.addEventListener('pagehide',()=>{worker.terminate();clearInterval(watchdog);clearTimeout(lifetime);});
    const safeElement=(selector)=>{if(typeof selector!=='string'||selector.length>150)return null;try{return root.querySelector(selector);}catch{return null;}};
    worker.onmessage=({data})=>{
      if(stopped)return;
      if(Date.now()-period>1000){period=Date.now();count=0;} if(++count>120){stop('너무 많은 화면 변경 요청으로 실행을 중단했어요.');return;}
      if(typeof data!=='object'||!data)return;
      if(data.type==='heartbeat'){lastBeat=Date.now();return;}
      if(data.type==='text'){const el=safeElement(data.selector);if(el)el.textContent=String(data.text).slice(0,30000);}
      if(data.type==='listen'&&['click','input','change'].includes(data.event)) {
        const el=safeElement(data.selector);if(el)el.addEventListener(data.event,()=>worker.postMessage({type:'event',id:data.id,value:String(el.value??'').slice(0,8000)}));
      }
      if(data.type==='generate'||data.type==='cancel'){if(JSON.stringify(data).length<16000)tell(data);}
      if(data.type==='runtime-error')tell({type:'runtime-error',instance,text:String(data.text).slice(0,300)});
    };
    worker.onerror=()=>stop('코드를 실행하지 못했어요. JavaScript 문법을 확인해 주세요.');
    const receive=(data)=>{if(data?.instance===instance&&['result','error'].includes(data.type))worker.postMessage(data);};
    window.addEventListener('message',e=>{if(e.source===parent)receive(e.data);});
    window.__creatorReceive=receive;
  })();
  </script></body></html>`;
}
