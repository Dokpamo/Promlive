"""Summarize only the controlled scrolling interval, preserving spikes and failures."""
import json, sys
from pathlib import Path

def percentile(values, p):
    values = sorted(values)
    return round(values[min(len(values)-1, int((len(values)-1)*p))], 3) if values else None

def analyze(path):
    rows = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    events = [v for r in rows for v in r.get('events', [])]
    start = next((v['time'] for v in events if v['name'] == 'scroll-start'), None)
    end = next((v['time'] for v in events if v['name'] == 'scroll-end'), None)
    native_run = Path(path).with_name(Path(path).stem + '-run.json')
    if start is None and native_run.exists() and rows:
        native = json.loads(native_run.read_text())
        wall_offset = rows[0]['at'] - rows[0]['clock']
        start, end = native['gestureStart'] - wall_offset, native['gestureEnd'] - wall_offset
    if start is None or end is None:
        return {'run': rows[0]['run'] if rows else Path(path).stem, 'error': 'incomplete controlled flow', 'events': events}
    samples = [v for r in rows for v in r.get('samples', []) if start <= v['time'] <= end]
    frames = [v['dt'] for r in rows for v in r.get('frames', []) if isinstance(v, dict) and start <= v['at'] <= end]
    calls = [v for r in rows for v in r.get('calls', []) if start <= v.get('start', -1) <= end]
    reads = [v for v in calls if v['method'] == 'messages']
    # Cell rectangles include bubble spacing. Ignore a 3 px tolerance at fractional edges.
    gaps = [v for v in samples if v.get('missingPixels', 0) > 3 and not v.get('restoring')]
    boundaries = [v for v in samples if (v['offset'] <= 1 and v.get('hasOlder')) or (v['content']-v['height']-v['offset'] <= 1 and v.get('hasNewer'))]
    visible = [seq for v in samples for seq in v.get('visible', [])]
    retained = [r for r in rows if start <= r.get('clock', -1) <= end]
    return {'run': rows[0]['run'], 'seconds': round((end-start)/1000, 3),
        'firstBodyLayoutMs': next((v['sinceLaunch'] for v in events if v['name'] == 'first-body-layout'), None),
        'jsTicks': len(frames), 'jsTickP95': percentile(frames, .95), 'jsTickP99': percentile(frames, .99), 'jsTickMax': max(frames, default=0),
        'jsTicksOver34': sum(v>34 for v in frames), 'jsTicksOver50': sum(v>50 for v in frames),
        'reads': len(reads), 'readP95': percentile([v['ms'] for v in reads], .95), 'readMax': max([v['ms'] for v in reads], default=0),
        'readMessages': sum(v.get('count', 0) for v in reads), 'readCharacters': sum(v.get('characters', 0) for v in reads),
        'listReads': sum(v['method'] == 'list' for v in calls), 'listRows': sum(v.get('count', 0) for v in calls if v['method'] == 'list'),
        'retainedMessagesMax': max([r.get('retainedMessages') or 0 for r in retained], default=0),
        'retainedCharactersMax': max([r.get('retainedCharacters') or 0 for r in retained], default=0),
        'mountedMax': max([v.get('mounted', 0) for v in samples], default=0),
        'mountedCharactersMax': max([v.get('mountedCharacters', 0) for v in samples], default=0),
        'samples': len(samples), 'uncoveredSamples': len(gaps), 'uncoveredMaxPx': max([v['missingPixels'] for v in gaps], default=0),
        'boundarySamples': len(boundaries), 'boundaryLoadingSamples': sum(v['loading'] for v in boundaries),
        'visibleMin': min(visible, default=None), 'visibleMax': max(visible, default=None),
        'errors': [r['saveError'] for r in rows if r.get('saveError')],
        'events': events}

if __name__ == '__main__':
    results = [analyze(path) for path in sys.argv[1:]]
    print(json.dumps(results, indent=2))
