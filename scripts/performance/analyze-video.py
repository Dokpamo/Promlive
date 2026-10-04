"""Inspect every decoded frame; excludes fixed chrome from blank-frame checks."""
import argparse, json, subprocess, sys
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser()
parser.add_argument('video',type=Path)
parser.add_argument('--roi',default='.06,.15,.94,.80',help='x1,y1,x2,y2 fractions, excluding fixed UI')
parser.add_argument('--start',type=float,default=0,help='Ignore launch/idle frames before this video time')
parser.add_argument('--end',type=float,default=float('inf'))
args=parser.parse_args(); p=args.video
x1,y1,x2,y2=map(float,args.roi.split(','))
width,height=480,520
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(p)]))
pts=[float(f['best_effort_timestamp_time']) for f in probe['frames']]
proc=subprocess.Popen(['ffmpeg','-v','fatal','-i',str(p),'-vf',f'scale={width}:{height}','-pix_fmt','gray','-fps_mode','passthrough','-f','rawvideo','-'],stdout=subprocess.PIPE)
rows=[]; before=None
for i,t in enumerate(pts):
 data=proc.stdout.read(width*height)
 if len(data)!=width*height:break
 frame=np.frombuffer(data,dtype=np.uint8).reshape(height,width)
 body=frame[int(height*y1):int(height*y2),int(width*x1):int(width*x2)].astype(np.float32)
 dark=float(np.mean(body<190)); difference=float(np.mean(np.abs(body-before))) if before is not None else 0
 rows.append({'frame':i,'seconds':t,'intervalMs':round((t-pts[i-1])*1000,3) if i else 0,'darkFraction':round(dark,5),'difference':round(difference,4)})
 before=body
proc.stdout.read()
proc.wait()
considered=[r for r in rows if args.start <= r['seconds'] <= args.end]
blank=[r for r in considered if r['darkFraction']<.01]
moving=[r for r in considered if r['difference']>.5]
summary={'video':str(p),'frames':len(rows),'analyzedFrames':len(considered),'analyzedFrom':args.start,'analyzedTo':min(args.end,pts[-1]),'durationSeconds':pts[-1]-pts[0],
 'blankBodyFrames':len(blank),'blankFrameNumbers':[r['frame'] for r in blank],
 'minBodyDarkFraction':min((r['darkFraction'] for r in considered),default=None),
 'movingFrameIntervalsMs':{k:float(np.percentile([r['intervalMs'] for r in moving],q)) if moving else None for k,q in [('p50',50),('p95',95),('p99',99),('max',100)]},
 'note':'A blank check is a pixel heuristic, not a proof of smoothness. Interval gaps can also include gesture pauses. Use OS frame deadlines and manual frame inspection together.'}
p.with_suffix('.frames.json').write_text(json.dumps({'summary':summary,'frames':rows}))
print(json.dumps(summary))
