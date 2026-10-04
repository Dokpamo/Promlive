import json, sys, time
from pathlib import Path
from importlib.machinery import SourceFileLoader
analyze=SourceFileLoader('analyze_run',str(Path(__file__).with_name('analyze-run.py'))).load_module().analyze
p=Path(sys.argv[1]);deadline=time.monotonic()+60
while time.monotonic()<deadline:
    if p.exists():
        rows=p.read_text().splitlines()
        if rows and json.loads(rows[-1]).get('done'):
            report=analyze(p);p.with_name(p.stem+'-summary.json').write_text(json.dumps(report,indent=2))
            print(json.dumps({k:v for k,v in report.items() if k!='events'}));break
    time.sleep(.5)
else:raise SystemExit('Run timed out: inspect the UI and retain partial telemetry')
