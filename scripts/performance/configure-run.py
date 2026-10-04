"""Set up one reproducible local run; launching remains platform-specific."""
import argparse, json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('root',type=Path);p.add_argument('run');p.add_argument('--case',type=int,default=1)
p.add_argument('--screen',default='chat');p.add_argument('--manual',action='store_true')
p.add_argument('--tuning',default='{}');p.add_argument('--delay',type=int,default=0)
a=p.parse_args()
if (a.root/(a.run+'.jsonl')).exists():raise SystemExit('Refusing to overwrite an existing run')
c={'run':a.run,'screen':a.screen,'chatId':f'perf-{a.case:05}','anchorSequence':10000,
   'autoScroll':not a.manual,'startDelayMs':4500,'readDelayMs':a.delay,'tuning':json.loads(a.tuning),
   'phases':[{'ms':6000,'speed':-2500},{'ms':4000,'speed':2500},{'ms':6000,'speed':-2500}]}
(a.root/'config.json').write_text(json.dumps(c))
print(json.dumps(c))
