"""Local After Effects agent CLI. Python standard library only."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent
OPS = {'ping','inspect','properties','effects','renderTemplates','createComp','duplicateComp',
       'import','addLayer','text','solid','shape','set','animate','expression','layerSettings',
       'compSettings','addEffect','shapeOperator','save','preview','render'}

def state_dir():
    return Path(os.environ.get('LOCALAPPDATA', str(ROOT))) / 'AfterEffectTunnel'

def validate(req):
    if not isinstance(req, dict) or req.get('version') != 1:
        raise ValueError('Request must have version: 1')
    actions = req.get('actions')
    if not isinstance(actions, list) or not 1 <= len(actions) <= 2000:
        raise ValueError('actions must contain 1..2000 commands')
    names = set()
    for a in actions:
        if not isinstance(a, dict) or a.get('op') not in OPS:
            raise ValueError('Unknown command: ' + str(a.get('op') if isinstance(a, dict) else a))
        if 'as' in a:
            if not isinstance(a['as'], str) or not a['as'] or a['as'] in names:
                raise ValueError('Aliases must be unique nonempty strings')
            names.add(a['as'])
    # Reject NaN, Infinity and data that cannot be JSON.
    json.dumps(req, allow_nan=False)
    return req

def build_script(req):
    validate(req)
    # Embed JSON as a literal: no shell interpolation and no file-write permission needed.
    payload = json.dumps(req, ensure_ascii=True, allow_nan=False)
    runtime = (ROOT / 'host' / 'tunnel.jsx').read_text(encoding='utf-8')
    return runtime + '\nAETunnel.show(AETunnel.run(' + payload + '));\n'

def afterfx_path(explicit=None):
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            raise ValueError('AfterFX executable not found: ' + str(p))
        return p
    base = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Adobe'
    candidates = sorted(base.glob('Adobe After Effects */Support Files/AfterFX.exe'), reverse=True)
    if not candidates:
        raise ValueError('AfterFX.exe not found; supply --afterfx')
    return candidates[0]

def heartbeat():
    try:
        p = state_dir() / 'heartbeat.json'
        data = json.loads(p.read_text(encoding='utf-8'))
        return data if time.time() - data['time'] / 1000 < 8 else None
    except (OSError, ValueError, KeyError):
        return None

def submit(req, mode, timeout, executable=None):
    validate(req)
    job_id = uuid.uuid4().hex
    if mode == 'auto':
        mode = 'panel' if heartbeat() else 'script'
    if mode == 'script':
        folder = state_dir() / 'scripts'
        folder.mkdir(parents=True, exist_ok=True)
        script = folder / (job_id + '.jsx')
        script.write_text(build_script(req), encoding='utf-8')
        child = subprocess.Popen([str(afterfx_path(executable)), '-r', str(script)],
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        return {'status':'dispatched', 'jobId':job_id, 'pid':child.pid, 'script':str(script),
                'note':'Not execution proof. Read/close the After Effect Tunnel result dialog in AE. Do not blindly retry.'}
    if not heartbeat():
        raise ValueError('Tunnel panel is not active. Open Window > Extensions > After Effect Tunnel, or use --mode script.')
    folder = state_dir()
    for name in ('inbox','outbox','processing'):
        (folder / name).mkdir(parents=True, exist_ok=True)
    envelope = {'id':job_id, 'created':time.time(), 'request':req}
    target = folder / 'inbox' / (job_id + '.json')
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(envelope, ensure_ascii=True, allow_nan=False), encoding='utf-8')
    temp.replace(target)
    until = time.monotonic() + timeout
    result = folder / 'outbox' / (job_id + '.json')
    while time.monotonic() < until:
        if result.exists():
            return json.loads(result.read_text(encoding='utf-8-sig'))
        time.sleep(.2)
    return {'status':'unknown', 'jobId':job_id,
            'note':'Timeout does not cancel AE execution. Inspect status/result before retrying.'}

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='command', required=True)
    sub.add_parser('status', help='Show panel heartbeat and pending/completed job IDs')
    sub.add_parser('doctor', help='Check installation without changing preferences')
    p = sub.add_parser('run', help='Submit a JSON request')
    p.add_argument('request', type=Path)
    p.add_argument('--mode', choices=['auto','panel','script'], default='auto')
    p.add_argument('--timeout', type=float, default=60)
    p.add_argument('--afterfx')
    p = sub.add_parser('build', help='Create a standalone JSX to run via File > Scripts')
    p.add_argument('request', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p = sub.add_parser('result', help='Read a completed panel result; never resubmits')
    p.add_argument('job_id')
    p = sub.add_parser('render', help='Render a saved project in a separate Adobe aerender process')
    p.add_argument('--project', type=Path, required=True)
    p.add_argument('--comp', required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--template', required=True)
    p.add_argument('--afterfx')
    args = ap.parse_args(argv)
    try:
        if args.command == 'doctor':
            data = {'python':sys.version.split()[0], 'afterfx':str(afterfx_path()),
                    'runtime':(ROOT/'host'/'tunnel.jsx').is_file(), 'panel':heartbeat(),
                    'stateDirectory':str(state_dir()), 'preferencesChanged':False}
        elif args.command == 'status':
            data = {'panel':heartbeat(), **{n:[p.stem for p in (state_dir()/n).glob('*.json')]
                                            for n in ('inbox','processing','outbox')}}
        elif args.command == 'render':
            if not args.project.is_file():
                raise ValueError('Saved project does not exist')
            if args.output.exists():
                raise ValueError('Output exists: choose a fresh path')
            if not args.output.parent.is_dir():
                raise ValueError('Output directory does not exist')
            renderer = afterfx_path(args.afterfx).with_name('aerender.exe')
            if not renderer.is_file():
                raise ValueError('aerender.exe not found')
            completed = subprocess.run([str(renderer), '-project', str(args.project.resolve()),
                '-comp', args.comp, '-OMtemplate', args.template, '-output', str(args.output.resolve())],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace',
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            ok = completed.returncode == 0 and args.output.is_file() and args.output.stat().st_size > 0
            data = {'ok':ok, 'exitCode':completed.returncode, 'output':str(args.output.resolve()),
                    'log':completed.stdout[-12000:]}
        elif args.command == 'result':
            if not args.job_id.isalnum():
                raise ValueError('Invalid job ID')
            data = json.loads((state_dir()/'outbox'/(args.job_id+'.json')).read_text(encoding='utf-8-sig'))
        else:
            req = validate(json.loads(args.request.read_text(encoding='utf-8-sig')))
            if args.command == 'build':
                if args.output.exists():
                    raise ValueError('Output already exists: choose a new path')
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(build_script(req), encoding='utf-8')
                data = {'script':str(args.output.resolve()), 'status':'built'}
            else:
                data = submit(req, args.mode, args.timeout, args.afterfx)
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 1 if data.get('ok') is False else 0
    except (OSError, ValueError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
