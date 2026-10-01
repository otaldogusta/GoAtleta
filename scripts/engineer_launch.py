"""Persistent definitions, honest readiness and explicit platform-budget consent."""
from datetime import datetime, timezone, timedelta
import json
import math
import os
from pathlib import Path
import re
import sys

AGENTS_API = 'https://api.openai.com/v1/agents'
NAMES = {'coordinator': 'Coordinator', 'implementation': 'Implementation',
         'security-review': 'Security Review', 'test-review': 'Test Review'}


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r'_[A-Za-z0-9_-]+', value) is not None


def registry(e):
    path = e.ROOT / 'docs/operations/engineer/agents.json'
    data = json.loads(e.checked_bytes(path))
    if (not isinstance(data, dict) or set(data) != {'version', 'project_id', 'project_name', 'agents'} or data['version'] != 1
            or data['project_name'] != 'Go Atleta Engineer' or not isinstance(data['agents'], dict)
            or set(data['agents']) != set(NAMES)):
        raise ValueError('Registro de agentes inválido.')
    if data['project_id'] is not None and not identifier(data['project_id'], 'proj'):
        raise ValueError('Project ID inválido.')
    ids = []
    for value in data['agents'].values():
        if not isinstance(value, dict) or set(value) != {'id', 'profile_sha256'}:
            raise ValueError('Registro contém campos inesperados; nunca grave segredos aqui.')
        if value['id'] is not None:
            if not identifier(value['id'], 'agent') or not re.fullmatch(r'[a-f0-9]{64}', value['profile_sha256'] or ''):
                raise ValueError('Agent ID ou hash inválido.')
            ids.append(value['id'])
        elif value['profile_sha256'] is not None:
            raise ValueError('Hash sem agente.')
    if len(set(ids)) != len(ids):
        raise ValueError('Agentes duplicados entre papéis.')
    return data


def definition(e, role, model):
    if role not in NAMES or not model.strip():
        raise ValueError('Papel ou modelo inválido.')
    body = e.checked_bytes(e.ROOT / 'docs/operations/engineer' / (role + '.md'))
    return {'name': 'Go Atleta Engineer — ' + NAMES[role], 'model': model,
            'instructions': body.decode('utf-8-sig'), 'service_tier': 'default',
            'multi_agent': {'enabled': False},
            'metadata': {'goatleta_role': role, 'profile_sha256': e.digest(body)}}, e.digest(body)


def agent_request(e, method, project, suffix='', payload=None):
    if not identifier(project, 'proj'):
        raise ValueError('Projeto dedicado ainda não configurado.')
    return e.api(method, suffix, payload, base=AGENTS_API, project_id=project)


def manage(e, role, model, agent_id=None, live=False):
    data = registry(e)
    payload, sha = definition(e, role, model)
    if data['agents'][role]['id'] is not None:
        raise ValueError('Papel já registrado; não criar ou substituir silenciosamente.')
    if agent_id is not None and not identifier(agent_id, 'agent'):
        raise ValueError('Agent ID inválido.')
    if not live:
        return {'state': 'DRY_RUN', 'role': role, 'project_id': data['project_id'],
                'operation': 'register_existing' if agent_id else 'create_definition', 'definition': payload}
    if not identifier(data['project_id'], 'proj'):
        raise ValueError('Configure o projeto dedicado antes de registrar agentes.')
    if agent_id:
        remote = agent_request(e, 'GET', data['project_id'], '/' + agent_id)
        if remote.get('id') != agent_id:
            raise ValueError('A API retornou outro agente.')
        if remote.get('instructions') != payload['instructions'] or remote.get('model') != model:
            raise ValueError('Definição remota diverge do perfil/modelo local; não sobrescrita.')
    else:
        attempts = e.ROOT / '.tmp/engineer-agent-registration'
        attempts.mkdir(parents=True, exist_ok=True)
        marker = attempts / (data['project_id'] + '-' + role + '.json')
        with marker.open('x', encoding='utf-8') as stream:
            json.dump({'state': 'OUTCOME_PENDING', 'role': role, 'profile_sha256': sha}, stream)
        remote = agent_request(e, 'POST', data['project_id'], payload=payload)
        e.save(marker, {'state': 'CREATED', 'role': role, 'id': remote.get('id'), 'profile_sha256': sha})
        # Never retry an ambiguous POST automatically. Register the existing ID after inspection.
    if not identifier(remote.get('id'), 'agent'):
        raise ValueError('Resposta sem Agent ID válido; reconciliar antes de repetir.')
    if remote['id'] in [v['id'] for v in data['agents'].values()]:
        raise ValueError('Agent ID já utilizado por outro papel.')
    data['agents'][role] = {'id': remote['id'], 'profile_sha256': sha}
    e.save(e.ROOT / 'docs/operations/engineer/agents.json', data)
    return {'state': 'REGISTERED', 'role': role, 'agent_id': remote['id'], 'project_id': data['project_id']}


def binding(e):
    data = registry(e)
    for role, value in data['agents'].items():
        _, sha = definition(e, role, 'check')
        if value['id'] and value['profile_sha256'] != sha:
            raise ValueError('Perfil mudou desde o registro: ' + role)
    return data


def confirm_budget(e, limit):
    data = binding(e)
    if not identifier(data['project_id'], 'proj') or not valid_amount(limit):
        raise ValueError('Projeto ou valor inválido.')
    if not sys.stdin.isatty():
        raise ValueError('Confirmação exige humano no terminal interativo; sem --yes.')
    phrase = f"CONFIRMO {data['project_id']} USD {limit:g} ACEITO ATRASO E POSSIVEL EXCEDENTE"
    print('Confirme no painel: projeto dedicado, hard limit mensal ativo e auto-reload OFF.')
    print('Isto substitui o teto matemático estrito somente para runs preparadas no modo platform-hard-limit.')
    print(phrase)
    if input('Digite a frase após conferir o painel: ').strip() != phrase:
        raise ValueError('Nenhuma autorização registrada.')
    record = {'project_id': data['project_id'], 'hard_limit_usd': limit,
              'hard_limit_confirmed': True, 'overshoot_accepted': True, 'auto_reload_off_confirmed': True,
              'source': 'human_manual_check_not_api_verified',
              'confirmed_at': datetime.now(timezone.utc).isoformat()}
    path = e.ROOT / '.tmp/engineer-platform-budget.json'
    path.parent.mkdir(exist_ok=True)
    e.save(path, record)
    return {'state': 'CONFIRMED_MANUALLY', 'path': str(path), **record}


def valid_amount(value):
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def budget_gate(e, manifest, mode=None):
    policy = manifest.get('financial_policy', {})
    prepared_mode = policy.get('budget_mode', 'strict')
    if mode is not None and mode != prepared_mode:
        raise ValueError('BUDGET_GATE: modo diferente do pacote; prepare nova run, não altere a anterior.')
    if prepared_mode == 'strict':
        if policy.get('max_cost_usd') is not None:
            raise ValueError('BUDGET_GATE: teto estrito não garantido; nenhuma chamada enviada.')
        return None  # Legacy uncapped fixtures/runs; new CLI preparations default to strict USD 5.
    if prepared_mode != 'platform-hard-limit':
        raise ValueError('BUDGET_GATE: modo inválido.')
    data = binding(e)
    path = e.ROOT / '.tmp/engineer-platform-budget.json'
    if not path.is_file() or path.is_symlink():
        raise ValueError('BUDGET_GATE: confirmação humana do hard limit ausente.')
    record = json.loads(e.checked_bytes(path))
    try:
        timestamp = datetime.fromisoformat(record['confirmed_at'])
        age = datetime.now(timezone.utc) - timestamp
    except (KeyError, TypeError, ValueError):
        raise ValueError('BUDGET_GATE: confirmação inválida.') from None
    if (age < timedelta(0) or age > timedelta(hours=24)
            or record.get('source') != 'human_manual_check_not_api_verified'
            or any(record.get(k) is not True for k in ['hard_limit_confirmed', 'overshoot_accepted', 'auto_reload_off_confirmed'])
            or record.get('project_id') != data['project_id']
            or manifest.get('agent_registry', {}).get('project_id') != data['project_id']
            or not valid_amount(record.get('hard_limit_usd'))
            or record['hard_limit_usd'] != policy.get('project_hard_limit_usd')):
        raise ValueError('BUDGET_GATE: confirmação expirada, divergente ou incompleta.')
    return record


def check_saved(e, manifest, model):
    expected = manifest.get('agent_registry')
    if not expected:
        return
    if expected != binding(e):
        raise ValueError('Registro mudou; prepare nova run.')
    for role in NAMES:
        item = expected['agents'][role]
        if not identifier(item['id'], 'agent'):
            raise ValueError('PERSISTENT_AGENTS_BLOCKED: faltam IDs de agentes.')
        remote = agent_request(e, 'GET', expected['project_id'], '/' + item['id'])
        payload, _ = definition(e, role, model)
        if remote.get('id') != item['id'] or remote.get('instructions') != payload['instructions'] or remote.get('model') != model:
            raise ValueError('Agente remoto divergente; não iniciar sessão.')


def readiness(e, runtime, image=None, offline=False):
    data = binding(e)
    checks = {'application_key': 'PRESENT' if os.getenv('OPENAI_API_KEY') else 'MISSING',
              'executor_key': 'PRESENT' if os.getenv('OPENAI_EXECUTOR_API_KEY') else 'MISSING',
              'agents_read': 'NOT_CHECKED', 'agents_write': 'MANUAL_CHECK_REQUIRED',
              'responses_write': 'MANUAL_CHECK_REQUIRED', 'executor_connect': 'NOT_TESTED',
              'prepaid_balance': 'MANUAL_CHECK_REQUIRED', 'hard_spend_limit': 'MANUAL_CHECK_REQUIRED',
              'auto_reload': 'MANUAL_CHECK_REQUIRED', 'docker': 'NOT_CHECKED',
              'runtime_image': 'NOT_CHECKED', 'codex_cli': 'NOT_CHECKED',
              'workspace_isolation': 'RUN_PREFLIGHT_AND_DOCKER_SMOKE'}
    try:
        context = json.loads(runtime.docker(['context', 'inspect']))[0]['Endpoints']['docker']['Host']
        if not context.startswith(('unix://', 'npipe://')):
            raise ValueError('Nonlocal Docker')
        checks['docker'] = 'PASS_LOCAL'
        if image and re.fullmatch(r'sha256:[a-f0-9]{64}', image):
            actual = runtime.docker(['image', 'inspect', '--format', '{{.Id}}', image])
            if actual != image:
                raise ValueError('Image mismatch')
            checks['runtime_image'] = 'PASS'
            runtime.docker(['run', '--rm', '--pull=never', '--network=none', '--read-only',
                            '--user', '1000:1000', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                            '--entrypoint', 'codex', image, '--version'])
            checks['codex_cli'] = 'PASS_LOCAL_NO_KEYS'
    except ValueError:
        checks['docker'] = 'BLOCKED'
    agents = {}
    for role, item in data['agents'].items():
        agents[role] = 'MISSING_ID' if not item['id'] else 'LOCAL_ONLY'
        if not offline and item['id'] and data['project_id'] and os.getenv('OPENAI_API_KEY'):
            try:
                remote = agent_request(e, 'GET', data['project_id'], '/' + item['id'])
                # Compare the exact payload sent at registration, preserving Windows CRLF.
                body = (e.ROOT / 'docs/operations/engineer' / (role + '.md')).read_bytes().decode('utf-8-sig')
                agents[role] = 'PASS_READ' if remote.get('id') == item['id'] and remote.get('instructions') == body else 'MISMATCH'
                checks['agents_read'] = 'PASS' if agents[role] == 'PASS_READ' else 'PARTIAL'
            except ValueError:
                agents[role] = 'UNAVAILABLE'
    if any(v in ('PASS_READ', 'MISMATCH', 'UNAVAILABLE') for v in agents.values()):
        checks['agents_read'] = ('PASS' if all(v == 'PASS_READ' for v in agents.values()) else
                                 'PARTIAL' if any(v == 'PASS_READ' for v in agents.values()) else 'UNAVAILABLE')
    return {'state': 'BLOCKED_OR_MANUAL_CHECK_REQUIRED', 'project_id': data['project_id'],
            'project_name': data['project_name'], 'checks': checks, 'agents': agents,
            'session_created': False, 'spend_authorized': False,
            'note': 'Presença não prova escopo; GET não prova permissões de escrita. Nenhuma inferência executada.'}
