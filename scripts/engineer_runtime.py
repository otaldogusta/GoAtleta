"""Local execution copies, scoped Docker lifecycle and persisted API reconciliation."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from urllib.parse import urlsplit
import engineer_budget
import engineer_coordination


def read(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def snapshot(folder, e):
    if folder.is_symlink() or (hasattr(folder, 'is_junction') and folder.is_junction()):
        raise ValueError('Raiz de execução não pode ser link.')
    result = {}
    if not folder.is_dir():
        raise ValueError('Cópia de execução ausente; execute stage.')
    for directory, dirs, files in os.walk(folder, followlinks=False):
        for name in list(dirs) + files:
            path = Path(directory) / name
            relative = path.relative_to(folder).as_posix()
            if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
                result[relative] = {'unsafe_link': True}
                if name in dirs:
                    dirs.remove(name)
            elif path.is_file():
                # Bound untrusted output before loading it into controller memory.
                if path.stat().st_size > 8_000_000:
                    result[relative] = {'oversized': True}
                    continue
                raw = path.read_bytes()
                try:
                    raw.decode('utf-8')
                    binary = b'\0' in raw
                except UnicodeDecodeError:
                    binary = True
                result[relative] = {'sha256': e.digest(raw), 'binary': binary}
    return result


def stage(run, e):
    e.verify(run)
    target = run / 'runtime'
    if target.exists():
        raise ValueError('Cópia já existe; não sobrescrever evidência de execução.')
    shutil.copytree(run / 'bundle', target)
    e.trace(run, 'runtime_staged')
    return {'state': 'staged', 'path': str(target)}


def attest(run, e):
    manifest = e.verify(run)
    actual = snapshot(run / 'runtime', e)
    baseline = manifest['files']
    changed = sorted(p for p in set(actual) | set(baseline)
                     if actual.get(p, {}).get('sha256') != baseline.get(p)
                     or actual.get(p, {}).get('unsafe_link') or actual.get(p, {}).get('oversized'))
    allowed = {'workspace/' + p for p in manifest.get('allowed_writes', [])}
    deleted = sorted(set(baseline) - set(actual))
    unsafe = sorted(p for p, value in actual.items() if value.get('unsafe_link') or value.get('oversized'))
    binary = [p for p in changed if actual.get(p, {}).get('binary')]
    unexpected = sorted(set(changed) - allowed)
    missing_expected = sorted(allowed - set(changed))
    result = {'status': 'FAIL' if unexpected or deleted or binary or unsafe or missing_expected else 'PASS',
              'scope': 'final_filesystem_snapshot_only', 'attested_at': datetime.now(timezone.utc).isoformat(),
              'changed': changed, 'unexpected_writes': unexpected, 'deleted': deleted,
              'binary_changes': binary, 'unsafe_entries': unsafe, 'missing_expected_writes': missing_expected,
              'files': {p: {'before': baseline.get(p), 'after': actual.get(p)} for p in changed}}
    e.save(run / 'attestation.json', result)
    e.trace(run, 'attested', status=result['status'], changed=len(changed))
    return result


def docker(args, executor_key=None):
    # Do not inherit controller credentials or arbitrary Docker endpoint overrides.
    env = {k: v for k, v in os.environ.items() if k.upper() in
           {'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'LOCALAPPDATA', 'APPDATA'}}
    if executor_key:
        env['CODEX_API_KEY'] = executor_key
    try:
        result = subprocess.run(['docker', *args], env=env, capture_output=True, text=True,
                                encoding='utf-8', timeout=45)
    except (subprocess.TimeoutExpired, OSError):
        raise ValueError('Docker indisponível ou resultado ambíguo; reconciliar antes de repetir.') from None
    if result.returncode:
        raise ValueError('Docker recusou a operação; saída omitida para proteger credenciais.')
    return result.stdout.strip()


def container_name(run):
    if not re.fullmatch(r'[a-f0-9]{32}', run.name):
        raise ValueError('Identificador local de execução inválido.')
    return 'goatleta-engineer-' + run.name


def owned_container(run):
    name = container_name(run)
    # Only request safe fields; full inspect includes the executor credential.
    result = json.loads(docker(['inspect', '--format',
                               '{{json .Config.Labels}}', name]))
    if result.get('goatleta.engineer.run') != run.name:
        raise ValueError('Container não pertence a esta execução.')
    return name


def preflight(run, e, image):
    manifest = e.verify(run)
    if manifest.get('version') != 3 or not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('Preflight exige pacote v3 e imagem local imutável.')
    if manifest.get('vnext') and manifest.get('visual_policy', {}).get('ui'):
        import engineer_ui_runtime
        result = engineer_ui_runtime.readiness(run, e.ROOT, image)
        result['checked_at'] = datetime.now(timezone.utc).isoformat()
        e.save(run / 'preflight.json', result)
        return result
    if not (run / 'runtime').exists():
        stage(run, e)
    if {p: v.get('sha256') for p, v in snapshot(run / 'runtime', e).items()} != manifest['files']:
        raise ValueError('Cópia alterada; prepare novo pacote antes do preflight.')
    result = {'state': 'BLOCKED_RUNTIME', 'missing': [], 'image': image,
              'manifest_sha256': e.digest((run / 'manifest.json').read_bytes()),
              'checked_at': datetime.now(timezone.utc).isoformat()}
    try:
        context = json.loads(docker(['context', 'inspect']))[0]['Endpoints']['docker']['Host']
        if not context.startswith(('npipe://', 'unix://')):
            raise ValueError('Contexto Docker não local.')
        args = ['run', '--rm', '--pull=never', '--network=none', '--read-only', '--user', '1000:1000',
                '--cap-drop=ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '128',
                '--memory', '2g', '--cpus', '2', '--workdir', '/workspace',
                '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777']
        for folder in ['workspace', 'capabilities', 'profiles']:
            path = (run / 'runtime' / folder).resolve()
            if ',' in str(path) or not path.is_relative_to(run.resolve()):
                raise ValueError('Montagem inválida.')
            args += ['--mount', f'type=bind,source={path},target=/{folder},readonly']
        args += task_environment(manifest)
        bootstrap = ('if ! command -v python >/dev/null 2>&1; then '
                     'echo \'{"state":"BLOCKED_RUNTIME","missing":["command:python"]}\'; '
                     'else exec python -B /workspace/runtime/preflight.py; fi')
        args += ['--entrypoint', '/bin/sh', image, '-c', bootstrap]
        result.update(json.loads(docker(args)))
    except ValueError:
        result['missing'] = ['Docker, imagem ou runtime indisponível; nenhuma chamada à API foi enviada.']
    e.save(run / 'preflight.json', result)
    e.save(run / ('preflight-attempt-' + uuid.uuid4().hex + '.json'), result)
    e.trace(run, 'preflight', state=result['state'], image=image)
    return result


def task_environment(manifest):
    args = ['--env', 'PYTHONDONTWRITEBYTECODE=1']
    if manifest.get('requirements', {}).get('profile') == 'router':
        args += ['--env', 'GOATLETA_SKILL_REGISTRY=/workspace/runtime/skill-registry.json']
    return args


def provision(run, e, image, live=False, retry_after_teardown=False):
    manifest = e.verify(run)
    if manifest.get('version') != 3:
        raise ValueError('Prepare novo pacote com política explícita.')
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('Informe o ID sha256 completo de uma imagem local revisada com Codex CLI.')
    if not live:
        return {'state': 'dry_run', 'network': False, 'filesystem_policy': manifest['filesystem_policy'],
                'image': image, 'executor_started': False}
    if manifest.get('vnext'):
        raise ValueError('VNEXT_PREPARED_ONLY: executor remoto não autorizado neste pacote.')
    checked = e.require_preflight(run, manifest)
    if checked['image'] != image:
        raise ValueError('BLOCKED_RUNTIME: imagem diferente do preflight.')
    key = os.getenv('OPENAI_EXECUTOR_API_KEY')
    if not key:
        raise ValueError('OPENAI_EXECUTOR_API_KEY ausente; nenhum executor iniciado.')
    session = read(run / 'session.json', {})
    environment = session.get('environment') or {}
    remote = environment.get('remote_url', '')
    url = urlsplit(remote)
    # remote_url is the HTTPS registration endpoint; the executor negotiates WSS.
    if ((url.scheme, url.hostname) not in {('https', 'api.openai.com'),
                                         ('wss', 'codex-cloud-environments.chatgpt.com')}
            or url.username or url.password or url.port not in (None, 443)):
        raise ValueError('Destino do executor fora dos endpoints OpenAI permitidos; conferir contrato.')
    environment_id = environment.get('id', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', environment_id):
        raise ValueError('Sessão sem environment.id válido.')
    # Prevent accidentally sending the execution bundle/key to a remote Docker context.
    context = json.loads(docker(['context', 'inspect']))[0]['Endpoints']['docker']['Host']
    if not context.startswith(('npipe://', 'unix://')):
        raise ValueError('Use um contexto Docker local para este provisionador.')
    docker(['image', 'inspect', '--format', '{{.Id}}', image])
    if not (run / 'runtime').exists():
        stage(run, e)
    if {p: v.get('sha256') for p, v in snapshot(run / 'runtime', e).items()} != manifest['files']:
        raise ValueError('Cópia de execução já alterada; não reiniciar sobre evidência anterior.')
    name = container_name(run)
    args = ['run', '--detach', '--pull=never', '--name', name, '--label', 'goatleta.engineer.run=' + run.name,
            '--read-only', '--user', '1000:1000', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
            '--pids-limit', '128', '--memory', '2g', '--cpus', '2', '--workdir', '/workspace',
            '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777',
            '--tmpfs', '/home/node:rw,nosuid,nodev,size=128m,uid=1000,gid=1000,mode=700',
            '--env', 'HOME=/home/node', '--env', 'CODEX_HOME=/home/node', '--env', 'CODEX_API_KEY']
    for folder in ['workspace', 'capabilities', 'profiles']:
        path = (run / 'runtime' / folder).resolve()
        if ',' in str(path) or not path.is_relative_to(run.resolve()):
            raise ValueError('Caminho de montagem inválido.')
        mount = f'type=bind,source={path},target=/{folder},readonly'
        args += ['--mount', mount]
    # Individual file mounts permit in-place writes only. Directory creation/rename stay denied.
    for relative in manifest.get('allowed_writes', []):
        path = e.source(run / 'runtime/workspace', relative)
        if ',' in str(path):
            raise ValueError('Montagem inválida.')
        args += ['--mount', f'type=bind,source={path},target=/workspace/{relative}']
    args += task_environment(manifest)
    policy = manifest.get('budget_policy', engineer_budget.DEFAULT)
    engineer_budget.validate(policy, manifest['subagents_limit'])
    args += ['--entrypoint', 'timeout', image, '--signal=TERM', '--kill-after=10',
             str(policy['max_runtime_seconds']), 'codex', 'exec-server', '--remote', remote, '--environment-id', environment_id]
    # Exclusive marker: crash/timeout must be reconciled through deterministic name and label.
    marker = run / 'provision-attempt.json'
    if retry_after_teardown:
        if read(run / 'container.json', {}).get('state') != 'removed':
            raise ValueError('Nova tentativa exige teardown confirmado; nenhuma evidência será sobrescrita.')
        marker.rename(run / ('provision-attempt-archived-' + uuid.uuid4().hex + '.json'))
    with marker.open('x', encoding='utf-8') as stream:
        json.dump({'name': name, 'image': image}, stream)
    cid = docker(args, executor_key=key)
    if not re.fullmatch(r'[a-f0-9]{64}', cid):
        raise ValueError('Resultado Docker ambíguo; confira o container pelo nome registrado.')
    e.save(run / 'container.json', {'id': cid, 'name': name, 'image': image, 'state': 'started_not_connected',
                                  'started_at': datetime.now(timezone.utc).isoformat()})
    e.trace(run, 'executor_started', container_id=cid)
    return {'state': 'started_not_connected', 'container_id': cid}


def teardown(run, e, live=False):
    if not live:
        return {'state': 'dry_run', 'container': container_name(run)}
    if read(run / 'container.json', {}).get('state') == 'removed':
        return {'state': 'already_removed'}
    name = owned_container(run)
    docker(['rm', '--force', name])
    e.save(run / 'container.json', {'name': name, 'state': 'removed'})
    e.trace(run, 'environment_removed')
    return {'state': 'removed', 'session_deleted': False, 'local_evidence_preserved': True}


def pages(e, suffix, limit=100):
    rows, after = [], ''
    for _ in range(100):
        result = e.api('GET', suffix + '?order=asc&limit=' + str(limit) + after)
        rows.extend(result.get('data', []))
        if not result.get('has_more'):
            return rows
        cursor = result.get('last_id', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]+', cursor) or after == '&after=' + cursor:
            raise ValueError('Cursor inválido ou repetido; reconciliação incompleta.')
        after = '&after=' + cursor
    raise ValueError('Histórico excedeu limite local; reconciliação incompleta.')


def reconcile(run, e, session_id=None):
    e.verify(run)
    if session_id:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', session_id):
            raise ValueError('Identificador de sessão inválido.')
        existing = read(run / 'session.json', {}).get('id')
        if existing and existing != session_id:
            raise ValueError('Não substituir a sessão já vinculada à execução.')
        recovered = e.api('GET', '/' + session_id)
        if recovered.get('id') != session_id:
            raise ValueError('A API retornou uma sessão diferente.')
        e.save(run / 'session.json', recovered)
        e.trace(run, 'session_recovered', session_id=session_id)
    state = e.remote(run, 'status')
    session_id = state['session_id']
    turns = pages(e, '/' + session_id + '/turns')
    items = pages(e, '/' + session_id + '/items')
    subagents = []
    if any(i.get('type') == 'create_subagent_call' for i in items):
        subagents = pages(e, '/' + session_id + '/subagents')
        for subagent in subagents:
            child_id = subagent.get('id', '')
            if not re.fullmatch(r'subagent_[A-Za-z0-9_-]+', child_id):
                raise ValueError('Subagent ID inválido; histórico incompleto.')
            prefix = '/' + session_id + '/subagents/' + child_id
            turns.extend(pages(e, prefix + '/turns'))
            items.extend(pages(e, prefix + '/items'))
        # API surfaces can overlap; never double-count identical persisted items.
        turns = list({t['id']: t for t in turns}.values())
        items = list({i['id']: i for i in items}.values())
    e.save(run / 'history.json', {'session_id': session_id, 'turns': turns, 'items': items,
                               'subagents': subagents,
                               'retrieved_at': datetime.now(timezone.utc).isoformat()})
    e.trace(run, 'reconciled', turns=len(turns), items=len(items))
    manifest = e.verify(run)
    budget = engineer_budget.evaluate(manifest.get('budget_policy', engineer_budget.DEFAULT),
                                      {'turns': turns, 'items': items},
                                      read(run / 'container.json', {}).get('started_at'),
                                      session_usage=read(run / 'session.json', {}).get('usage'))
    # A previous breach remains blocking even when usage later disappears from a response.
    previous = read(run / 'budget-result.json', {})
    if previous.get('state') == 'BUDGET_GATE':
        budget['state'] = 'BUDGET_GATE'
        budget['violations'] = sorted(set(budget['violations'] + previous.get('violations', [])))
    e.save(run / 'budget-result.json', budget)
    if budget['state'] == 'BUDGET_GATE':
        try:
            e.remote(run, 'cancel')
        finally:
            teardown(run, e, live=True)
    report(run, e)
    return {**state, 'turns': len(turns), 'items': len(items), 'budget': budget['state'],
            'automatic_action': 'cancel_and_teardown' if budget['state'] == 'BUDGET_GATE' else False}


def traces(run, e):
    e.verify(run)
    session = read(run / 'session.json', {})
    session_id = session.get('id', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', session_id):
        raise ValueError('Sessão inválida.')
    try:
        data = pages(e, '/' + session_id + '/traces', limit=20)
    except ValueError:
        result = {'state': 'UNAVAILABLE', 'session_id': session_id,
                  'reason': 'Verificar habilitação de exportação na organização, acesso e disponibilidade; nenhuma permissão alterada.'}
        e.save(run / 'trace-export-status.json', result)
        return result
    e.save(run / 'remote-traces.json', {'session_id': session_id, 'data': data})
    e.save(run / 'traces.otlp.json', {'resourceSpans': [s for t in data for s in t.get('otlp', {}).get('resourceSpans', [])]})
    result = {'state': 'EXPORTED' if data else 'NOT_READY', 'session_id': session_id, 'traces': len(data)}
    e.save(run / 'trace-export-status.json', result)
    return result


def report(run, e):
    manifest = e.verify(run)
    session = read(run / 'session.json', {})
    history = read(run / 'history.json', {})
    turns = history.get('turns', [])
    roots = [t for t in turns if t.get('subagent_id') is None]
    commands = [i for i in history.get('items', []) if i.get('type') == 'command_execution']
    skill_evidence = {}
    for name in manifest['skills']:
        body = (run / 'bundle/capabilities' / name / 'SKILL.md').read_text(encoding='utf-8-sig').strip()
        for command in commands:
            output = (command.get('output') or '').replace('\r\n', '\n')
            if (command.get('exit_code') == 0 and '/capabilities/' + name + '/SKILL.md' in (command.get('command') or '')
                    and body in output):
                skill_evidence[name] = command['id']
                break
    test_runs = []
    for command in commands:
        output = command.get('output') or ''
        count = re.search(r'(?:^|\n)Ran (\d+) tests? in [^\n]+\n\s*\nOK\b', output)
        if count and command.get('exit_code') == 0 and 'python' in (command.get('command') or ''):
            test_runs.append({'item_id': command['id'], 'tests': int(count.group(1)),
                              'source': 'successful_command_unittest_output'})
    final_messages = [i for i in history.get('items', []) if i.get('role') == 'assistant'
                      and i.get('phase') == 'final_answer']
    attestation = read(run / 'attestation.json', {})
    request = read(run / 'request.json')
    result = {'run_id': run.name, 'session_id': session.get('id'),
              'agent_registry': manifest.get('agent_registry'),
              'session_agent_id': session.get('agent_id') or (session.get('agent') or {}).get('id'),
              'financial_policy': manifest.get('financial_policy', {}),
              'coordination': engineer_coordination.evaluate(run, manifest, history, e),
              'cost': {'currency': 'USD', 'actual': None, 'source': 'platform_usage', 'complete': False,
                       'reason': 'Session token usage does not provide a verified billed dollar amount.'},
              'base_commit': manifest['head'],
              'model': request['agent']['model'], 'filesystem_policy': manifest.get('filesystem_policy'),
              'skills_selected': manifest['skills'], 'skills_opened': list(skill_evidence) or None,
              'skill_read_evidence': skill_evidence,
              'subagents_limit': manifest.get('subagents_limit'),
              'subagents_observed': sorted({t['subagent_id'] for t in turns if t.get('subagent_id')}) if history else None,
              'turns': [{'id': t.get('id'), 'status': t.get('status'), 'usage': t.get('usage'),
                         'created_at': t.get('created_at'), 'completed_at': t.get('completed_at'),
                         'duration_seconds': (t['completed_at'] - t['started_at'])
                         if isinstance(t.get('completed_at'), (int, float)) and isinstance(t.get('started_at'), (int, float))
                         else None} for t in turns],
              'session_status': session.get('status'), 'usage': session.get('usage'),
              'estimated_cost_usd': None, 'commands_count': len(commands) if history else None,
              'failed_commands_count': sum(c.get('status') == 'failed' for c in commands) if history else None,
              'tests_count': sum(t['tests'] for t in test_runs) if test_runs else None,
              'test_runs': test_runs, 'test_count_semantics': 'executions_not_unique_tests',
              'preflight_state': read(run / 'preflight.json', {}).get('state'),
              'runtime_image': read(run / 'preflight.json', {}).get('image'),
              'prepared_at': manifest.get('created_at'), 'history_retrieved_at': history.get('retrieved_at'),
              'files_selected': len(manifest['files']), 'unexpected_writes': attestation.get('unexpected_writes'),
              'changed_files': attestation.get('changed'),
              'budget': read(run / 'budget-result.json'),
              'remote_trace_export': read(run / 'trace-export-status.json'),
              'attestation_status': attestation.get('status'),
              'root_turn_completed': bool(roots) and roots[-1].get('status') == 'completed',
              'container_state': read(run / 'container.json', {}).get('state'),
              'quality_gate': read(run / 'human-decision.json', {}).get('state', 'pending_human_review')}
    if manifest.get('vnext'):
        import engineer_vnext
        result['visual_gates'] = engineer_vnext.visual_gate(run, manifest)
        e.save(run / 'context-report.json', engineer_vnext.context_report(run, manifest, history))
    e.save(run / 'run-report.json', result)
    (run / 'run-summary.md').write_text(engineer_coordination.summary(result), encoding='utf-8')
    if final_messages:
        (run / 'agent-response.md').write_text('\n\n'.join(c['text'] for m in final_messages
            for c in m.get('content', []) if c.get('type') == 'output_text'), encoding='utf-8')
    (run / 'run-report.md').write_text('# Go Atleta Engineer — relatório de execução\n\n'
        'Valores null são desconhecidos. PASS do filesystem não comprova execução remota nem qualidade.\n'
        'A atestação compara estados finais: não detecta uma escrita transitória revertida.\n\n```json\n'
        + json.dumps(result, ensure_ascii=False, indent=2) + '\n```\n', encoding='utf-8')
    return result
