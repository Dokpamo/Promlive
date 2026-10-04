"""Run the native release app against an isolated bundle/container, never production data."""
import argparse, json, os, subprocess, time
from pathlib import Path
from importlib.machinery import SourceFileLoader
analyze = SourceFileLoader('analyze_run', str(Path(__file__).with_name('analyze-run.py'))).load_module().analyze
p = argparse.ArgumentParser()
p.add_argument('name'); p.add_argument('--root', default='/tmp/promlive-performance-20261003')
p.add_argument('--app', default='/tmp/PromliveBenchmark.app')
p.add_argument('--case', type=int, default=1); p.add_argument('--tuning', default='{}')
p.add_argument('--screen', default='chat', choices=['chat', 'library', 'chats', 'create'])
p.add_argument('--speed', type=float, default=2500); p.add_argument('--delay', type=int, default=0)
p.add_argument('--profile', action='store_true'); p.add_argument('--record', action='store_true')
a = p.parse_args(); root = Path(a.root); root.mkdir(parents=True, exist_ok=True)
app = Path(a.app).resolve()
info = subprocess.check_output(['/usr/libexec/PlistBuddy','-c','Print :CFBundleIdentifier',str(app/'Contents/Info.plist')],text=True).strip()
if info != 'com.promlive.benchmark': raise SystemExit('Refusing non-benchmark bundle')
path = root / (a.name+'.jsonl')
if path.exists(): raise SystemExit('Run already exists')
config = {'run': a.name,'screen':a.screen,'chatId':f'perf-{a.case:05}','anchorSequence':10000,'autoScroll':True,
    'startDelayMs':4500,'readDelayMs':a.delay,'tuning':json.loads(a.tuning),
    'phases':[{'ms':6000,'speed':(-a.speed if a.screen == 'chat' else a.speed)},{'ms':4000,'speed':(a.speed if a.screen == 'chat' else -a.speed)},{'ms':6000,'speed':(-a.speed if a.screen == 'chat' else a.speed)}]}
(root/'config.json').write_text(json.dumps(config))
subprocess.run(['pkill','-f',str(app/'Contents/MacOS/Promlive')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
log = (root/(a.name+'-console.log')).open('w')
proc = subprocess.Popen(['open','-n','-W',str(app)],stdout=log,stderr=log)
pid = None
for _ in range(30):
    found = subprocess.run(['pgrep','-f',str(app/'Contents/MacOS/Promlive')],capture_output=True,text=True).stdout.split()
    if len(found)==1: pid=int(found[0]); break
    time.sleep(.1)
if not pid: raise SystemExit('Could not identify one benchmark process')
trace = None; recording = None
if a.profile:
    trace = subprocess.Popen(['sample',str(pid),'22','-file',str(root/(a.name+'-sample.txt'))],stdout=log,stderr=log)
if a.record:
    time.sleep(2)
    windows = json.loads(subprocess.check_output(['/tmp/promlive-window-info',str(pid)],text=True))
    windows = [w for w in windows if w.get('kCGWindowIsOnscreen') and w.get('kCGWindowName')=='Promlive' and w['kCGWindowBounds']['Height']>300]
    if len(windows)!=1: raise SystemExit('Expected exactly one benchmark window')
    (root/(a.name+'-window.json')).write_text(json.dumps(windows))
    recording = subprocess.Popen(['/tmp/promlive-record-window',str(pid),str(root/(a.name+'.mp4')),'22'],stdout=log,stderr=log)
snapshots = []
try:
    deadline = time.monotonic()+60
    while time.monotonic()<deadline:
        time.sleep(1)
        if proc.poll() is not None: raise RuntimeError('App exited, inspect console log')
        stat = subprocess.run(['ps','-p',str(pid),'-o','pid=,%cpu=,rss=,time='],capture_output=True,text=True).stdout.strip()
        snapshots.append({'at':time.time(),'stat':stat})
        if path.exists():
            rows = path.read_text().splitlines()
            if rows and json.loads(rows[-1]).get('done'): break
    else: raise RuntimeError('No completion after 60 seconds')
    report = analyze(path)
    report['processSnapshots'] = snapshots
    (root/(a.name+'-summary.json')).write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k not in ('events','processSnapshots')}))
finally:
    if recording: recording.wait(timeout=12)
    subprocess.run(['kill','-TERM',str(pid)],stdout=log,stderr=log)
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    if trace: trace.wait(timeout=10)
    log.close()
