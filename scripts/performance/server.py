"""Local benchmark configuration/telemetry only. No app or user content is accepted."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import sys

root = Path(sys.argv[1]).resolve()
root.mkdir(parents=True, exist_ok=True)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/config.json':
            self.send_error(404)
            return
        body = (root / 'config.json').read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        size = int(self.headers.get('Content-Length', '0'))
        if self.path != '/telemetry' or size > 256_000:
            self.send_error(400)
            return
        payload = json.loads(self.rfile.read(size))
        name = str(payload.get('run', 'unknown'))
        if not name or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in name):
            self.send_error(400)
            return
        with (root / f'{name}.jsonl').open('a') as output:
            output.write(json.dumps(payload) + '\n')
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass

ThreadingHTTPServer(('127.0.0.1', 8785), Handler).serve_forever()
