"""Isolated release-app scroll/video benchmark; coordinates come from the UI tree."""
import argparse, json, re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('root',type=Path); p.add_argument('run'); p.add_argument('--screen',default='chat',choices=['chat','chats','library','create'])
p.add_argument('--characters',type=int,default=16000); p.add_argument('--prefetch',type=float,default=2)
p.add_argument('--list-page',type=int,default=24)
p.add_argument('--retained',type=int,default=64000)
p.add_argument('--window',type=int,default=3); p.add_argument('--batch',type=int,default=4)
p.add_argument('--case',type=int,default=1); p.add_argument('--message-page',type=int,default=16)
p.add_argument('--delay',type=int,default=0); p.add_argument('--reverse',action='store_true')
p.add_argument('--trace',action='store_true')
p.add_argument('--no-video',action='store_true',help='Paired run to measure recorder overhead')
p.add_argument('--fast',action='store_true'); p.add_argument('--count',type=int,default=16)
p.add_argument('--anchor',type=int,default=0); a=p.parse_args()
serial='emulator-5554'; package='com.storyloom.benchmark'; a.root.mkdir(parents=True,exist_ok=True)
def adb(*args,**kw): return subprocess.run(['adb','-s',serial,*args],check=True,**kw)
def text(*args): return adb(*args,capture_output=True,text=True).stdout
config={'run':a.run,'screen':a.screen,'chatId':f'perf-{a.case:05}','anchorSequence':a.anchor,'autoScroll':False,'readDelayMs':a.delay,'tuning':{'listPage':a.list_page,'messagePage':a.message_page,'messageCharacters':a.characters,'prefetchScreens':a.prefetch,'renderWindow':a.window,'renderBatch':a.batch,'retainedCharacters':a.retained}}
(a.root/'config.json').write_text(json.dumps(config))
telemetry=a.root/f'{a.run}.jsonl'
if telemetry.exists(): raise SystemExit('Run name already exists; choose a fresh name')
adb('shell','am','force-stop',package,stdout=subprocess.DEVNULL)
adb('reverse','tcp:8785','tcp:8785',stdout=subprocess.DEVNULL)
started=time.monotonic(); adb('shell','am','start','-W','-n',package+'/com.promlive.MainActivity',stdout=subprocess.DEVNULL)
for _ in range(200):
 if telemetry.exists(): break
 time.sleep(.1)
else: raise SystemExit('Benchmark app did not report ready')
ready_ms=(time.monotonic()-started)*1000
adb('shell','uiautomator','dump','/sdcard/promlive-benchmark.xml',stdout=subprocess.DEVNULL)
xml=text('shell','cat','/sdcard/promlive-benchmark.xml'); (a.root/f'{a.run}-ui.xml').write_text(xml)
root=ET.fromstring(xml); test_id={'chat':'ui-chat-messages','chats':'ui-chats-list','library':'ui-library-grid','create':'ui-create-list'}[a.screen]
node=next(n for n in root.iter('node') if n.attrib.get('resource-id')==test_id)
x1,y1,x2,y2=map(int,re.findall(r'\d+',node.attrib['bounds']))
if x2-x1<300 or y2-y1<500: raise SystemExit('Target is hidden or too small')
x=int(x1+(x2-x1)*.62); top=int(y1+(y2-y1)*.22); bottom=int(y1+(y2-y1)*.69)
# Stay above the composer and beneath the fixed header.
start_y,end_y=(top,bottom) if a.screen=='chat' else (bottom,top)
time.sleep(.5)
adb('shell','dumpsys','gfxinfo',package,'reset',stdout=subprocess.DEVNULL)
trace_remote=f'/data/misc/perfetto-traces/{a.run}.pftrace'
if a.trace:
 trace_config='''duration_ms: 45000
buffers { size_kb: 32768 fill_policy: RING_BUFFER }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
data_sources { config { name: "linux.ftrace" ftrace_config {
 ftrace_events: "sched/sched_switch" ftrace_events: "sched/sched_waking"
 atrace_categories: "gfx" atrace_categories: "view" atrace_categories: "wm"
 atrace_apps: "com.storyloom.benchmark"
} } }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
'''
 (a.root/f'{a.run}.pbtxt').write_text(trace_config)
 adb('push',str(a.root/f'{a.run}.pbtxt'),'/data/misc/perfetto-configs/promlive-benchmark.pbtxt',stdout=subprocess.DEVNULL)
 trace_pid=text('shell','perfetto','--background-wait','--txt','-c','/data/misc/perfetto-configs/promlive-benchmark.pbtxt','-o',trace_remote).strip().splitlines()[-1]
remote=f'/sdcard/{a.run}.mp4'
record=None if a.no_video else subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--bit-rate','6000000','--time-limit','45',remote],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
time.sleep(.5)
begin=int(text('shell','date','+%s%3N').strip())
for index in range(a.count):
 reverse=a.reverse and a.count//3 <= index < a.count*2//3
 sy,ey=(end_y,start_y) if reverse else (start_y,end_y)
 adb('shell','input','swipe',str(x),str(sy),str(x),str(ey),'110' if a.fast else '550',stdout=subprocess.DEVNULL)
 time.sleep(.08 if a.fast else .22)
end=int(text('shell','date','+%s%3N').strip()); time.sleep(1)
(a.root/f'{a.run}-gfx.txt').write_text(text('shell','dumpsys','gfxinfo',package,'framestats'))
(a.root/f'{a.run}-memory.txt').write_text(text('shell','dumpsys','meminfo',package))
with (a.root/f'{a.run}-end.png').open('wb') as output: adb('exec-out','screencap','-p',stdout=output)
# Signal only this recorder (no other app's recording is touched).
if record:
 pids=text('shell','pidof','screenrecord').split()
 if len(pids)==1: adb('shell','kill','-2',pids[0],stdout=subprocess.DEVNULL)
 record.wait(timeout=10)
 adb('pull',remote,str(a.root/f'{a.run}.mp4'),stdout=subprocess.DEVNULL); adb('shell','rm',remote,stdout=subprocess.DEVNULL)
summary={'config':config,'readyMsIncludingTelemetryInterval':ready_ms,'gestureStart':begin,'gestureEnd':end,'count':a.count,'fast':a.fast,'bounds':node.attrib['bounds']}
(a.root/f'{a.run}-run.json').write_text(json.dumps(summary,indent=2))
if a.trace:
 adb('shell','kill','-TERM',trace_pid,stdout=subprocess.DEVNULL)
 time.sleep(1)
 adb('pull',trace_remote,str(a.root/f'{a.run}.pftrace'),stdout=subprocess.DEVNULL)
adb('shell','am','force-stop',package,stdout=subprocess.DEVNULL)
print(json.dumps(summary))
