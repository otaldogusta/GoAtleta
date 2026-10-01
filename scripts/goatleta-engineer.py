#!/usr/bin/env python3
"""Prepare a scoped engineering bundle; explicit commands manage Agents API sessions."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from types import SimpleNamespace
sys.dont_write_bytecode = True
import engineer_budget
import engineer_launch
import engineer_vnext

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / '.tmp/engineer-runs'
API = 'https://api.openai.com/v1/agents/sessions'
ROLES = ('coordinator', 'implementation', 'security-review', 'test-review')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def trace(run, kind, **fields):
    with (run / 'events.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'at': datetime.now(timezone.utc).isoformat(),
                                 'kind': kind, **fields}) + '\n')


def source(root, relative):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts or ':' in relative:
        raise ValueError('Use um caminho relativo dentro do repositório.')
    if any(p.startswith('.') or p.lower() in {'node_modules', 'secrets', 'credentials'} for p in path.parts):
        raise ValueError('Arquivos ocultos, credenciais e dependências não entram no pacote.')
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
        raise ValueError('Arquivo ausente ou fora da raiz permitida.')
    if resolved.suffix.lower() in {'.pem', '.key', '.p12', '.pfx'}:
        raise ValueError('Material de chave não pode entrar no pacote.')
    return resolved


def checked_bytes(path):
    if path.stat().st_size > 2_000_000:
        raise ValueError('Arquivo excede o limite de 2 MB.')
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig')
    if re.search(r'sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----|'
                 r'(?i:postgres(?:ql)?://[^\s:]+:[^\s@]+@)', text):
        raise ValueError('Possível credencial no conteúdo; arquivo não exportado.')
    return raw


def router():
    spec = importlib.util.spec_from_file_location('engineer_routing', ROOT / 'scripts/explain-skill-selection.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare(task, model, files, skills, root=ROOT, runs=RUNS, allow_write=None, subagents=0, profile=None, max_cost_usd=None,
            budget_mode='strict', project_hard_limit_usd=None, saved_agents=False, vnext=False, specialists=None,
            ui=False, motion=False):
    if not task.strip() or not model.strip():
        raise ValueError('Informe tarefa e modelo explicitamente.')
    if subagents not in range(4):
        raise ValueError('Use de zero a três subagentes.')
    specialists = specialists or []
    if vnext:
        if saved_agents or allow_write:
            raise ValueError('VNEXT: preparação local read-only com perfis novos; sem saved agents ou escrita.')
        ui = ui or motion or 'ui-ux-motion-review' in specialists
        if ui and 'ui-ux-motion-review' not in specialists:
            raise ValueError('VNEXT: UI/motion exige o revisor UI/UX Motion explícito.')
        subagents = len(specialists)
    elif specialists or ui or motion:
        raise ValueError('Use --vnext para especialistas/visual.')
    budget_policy = {**engineer_budget.DEFAULT, **({'max_subagents': 3} if vnext else {})}
    engineer_budget.validate(budget_policy, subagents)
    if budget_mode not in ('strict', 'platform-hard-limit'):
        raise ValueError('Modo de orçamento inválido.')
    if budget_mode == 'platform-hard-limit' and (max_cost_usd is not None or not saved_agents
                                                or not engineer_launch.valid_amount(project_hard_limit_usd)):
        raise ValueError('Modo platform exige agentes persistentes e limite de projeto; não aceita teto estrito simultâneo.')
    if budget_mode == 'strict' and project_hard_limit_usd is not None:
        raise ValueError('Limite de projeto não substitui teto estrito.')
    agent_registry = engineer_launch.binding(SimpleNamespace(**globals())) if saved_agents else None
    if max_cost_usd is not None and (type(max_cost_usd) not in (int, float)
                                   or not math.isfinite(max_cost_usd) or max_cost_usd <= 0):
        raise ValueError('Teto financeiro deve ser positivo e finito.')
    files = list(files)
    if vnext and (ui or motion):
        files = list(dict.fromkeys([*files, 'docs/operations/engineer/policies/visual-evidence.md',
                                   'docs/operations/engineer/schemas/ui-review.schema.json']))
    if profile == 'router':
        files = list(dict.fromkeys([*files, 'scripts/explain-skill-selection.py',
                                   'scripts/test-skill-selection.py', 'docs/operations/skill-routing.json']))
    writable = [source(root, p).relative_to(root.resolve()).as_posix() for p in (allow_write or [])]
    if any(p not in files for p in writable):
        raise ValueError('Cada --allow-write deve estar selecionado também em --file.')
    route = router()
    config = json.loads(route.CONFIG.read_text(encoding='utf-8'))
    selection = route.select(task, config, route.registry(config))
    chosen = list(dict.fromkeys(skills or [s['name'] for s in selection['selected']]))
    if vnext:
        aliases = {'goatleta-courtside-accessibility': 'goatleta-courtside-ux',
                   'react-native-skills': 'vercel-react-native-skills', 'expo-app-design': 'expo-native-ui'}
        chosen = list(dict.fromkeys(aliases.get(name, name) for name in chosen))
    if not chosen or len(chosen) > 6 or (not skills and selection['requires_staging']):
        raise ValueError('Confirme uma etapa de uma a seis skills com --skill.')
    # Only reviewed project skills are exported in this first runtime version.
    payload_files = {}
    for name in chosen:
        if vnext and name in {'animate-expo', 'vercel-react-native-skills', 'expo-native-ui', 'fixing-motion-performance'}:
            external = Path.home() / '.codex/skills' / name / 'SKILL.md'
            if not external.is_file() or external.is_symlink():
                raise ValueError('Skill externa selecionada indisponível; não instalar automaticamente: ' + name)
            payload_files['capabilities/' + name + '/SKILL.md'] = checked_bytes(external)
            continue  # Only reviewed instructions; never export/execute external helpers.
        if not re.fullmatch(r'goatleta-[a-z0-9-]+', name):
            raise ValueError('Esta versão exporta somente skills locais Go Atleta; selecione a etapa explicitamente.')
        folder = next((root / p / name for p in ['.agents/skills', '.codex/skills']
                       if (root / p / name / 'SKILL.md').is_file()), None)
        if folder is None:
            raise ValueError('Skill local não encontrada.')
        if not folder.resolve().is_relative_to(root.resolve()):
            raise ValueError('Pasta da skill escapa do repositório.')
        for file in folder.rglob('*'):
            if not file.is_file():
                continue
            if not file.resolve().is_relative_to(folder.resolve()):
                raise ValueError('Referência de skill fora da pasta permitida.')
            payload_files['capabilities/' + name + '/' + file.relative_to(folder).as_posix()] = checked_bytes(file)
    for relative in dict.fromkeys(['AGENTS.md', 'docs/operations/skill-governance.md',
                                   'docs/operations/validation-ladder.md', *files]):
        file = source(root, relative)
        payload_files['workspace/' + file.relative_to(root.resolve()).as_posix()] = checked_bytes(file)
    for role in ROLES:
        path = root / 'docs/operations/engineer' / (role + '.md')
        payload_files['profiles/' + role + '.md'] = checked_bytes(path)
    if vnext:
        payload_files['profiles/coordinator.md'] = checked_bytes(root / 'docs/operations/engineer/coordinator-vnext.md')
        if 'ui-ux-motion-review' in specialists:
            payload_files['profiles/ui-ux-motion-review.md'] = checked_bytes(root / 'docs/operations/engineer/ui-ux-motion-review.md')
        for role in ROLES[1:]:
            if role not in specialists:
                payload_files.pop('profiles/' + role + '.md', None)
    validation_commands = []
    environment = {'PYTHONDONTWRITEBYTECODE': '1'}
    if profile == 'router':
        index = {'version': 1, 'skills': route.registry(config),
                 'provenance': {'source': 'local_registry',
                                'routing_sha256': digest(checked_bytes(root / 'docs/operations/skill-routing.json'))}}
        payload_files['workspace/runtime/skill-registry.json'] = json.dumps(index, ensure_ascii=False).encode('utf-8')
        environment['GOATLETA_SKILL_REGISTRY'] = '/workspace/runtime/skill-registry.json'
        validation_commands = [['python', '-B', 'scripts/test-skill-selection.py'],
                               ['python', '-B', 'scripts/explain-skill-selection.py', 'Revisar política RLS', '--json']]
    payload_files['workspace/runtime/preflight.py'] = checked_bytes(root / 'scripts/engineer_preflight.py')
    requirements = {'runtime_requirements': {'python': '>=3.12', 'node': '>=22'},
                    'required_commands': ['python', 'node', 'git', 'rg'],
                    'required_files': [p.removeprefix('workspace/') for p in payload_files if p.startswith('workspace/')],
                    'required_skills': chosen, 'environment': environment,
                    'validation_commands': validation_commands, 'profile': profile}
    payload_files['workspace/runtime/task-requirements.json'] = json.dumps(requirements, ensure_ascii=False, indent=2).encode('utf-8')
    context_plan = engineer_vnext.plan(payload_files, root, specialists, task) if vnext else None
    if context_plan:
        payload_files['profiles/context-plan.json'] = json.dumps(context_plan, ensure_ascii=False, indent=2).encode('utf8')
    if sum(map(len, payload_files.values())) > 8_000_000:
        raise ValueError('Pacote excede 8 MB; reduza o escopo.')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    run = runs / uuid.uuid4().hex
    run.mkdir(parents=True)
    for relative, raw in payload_files.items():
        target = run / 'bundle' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    policy = 'scoped_write' if writable else 'read_only'
    restriction = ('Somente leitura: não crie, modifique, renomeie ou exclua arquivos em /workspace. '
                   'Use /tmp para arquivos temporários. ' if not writable else
                   'Edite somente estes arquivos em /workspace: ' + ', '.join(writable) + '. ')
    restriction += ('Não delegue a subagentes.' if not subagents else
                    'Delegue somente quando necessário, respeitando o limite configurado.')
    if vnext:
        restriction += ' Use apenas os papéis atribuídos em /profiles/context-plan.json; preserve os IDs exatos retornados e nunca espere com lista vazia. '
    restriction += ((' Leia somente o contexto do seu papel em /profiles/context-plan.json. '
                     'O dono dos testes executa os validation_commands aplicáveis; ' if vnext else
                    ' Leia explicitamente os SKILL.md selecionados em /capabilities e '
                    '/workspace/runtime/task-requirements.json. Execute os validation_commands aplicáveis; ') +
                    'não registre métricas em /workspace e não confunda testes anteriores com execução atual.')
    restriction += (' O pacote não contém .git: use comparação de arquivos, não git status. '
                    'Não faça push, deploy, migrations remotas, instalações ou conexões externas pela shell. '
                    'Não use service_role. Limites observados: ' + json.dumps(budget_policy) + '.')
    if vnext and 'test-review' in specialists:
        restriction += ' A execução da suíte final é exclusiva do Test Review; o Coordinator não repete validation_commands, apenas confere evidências.'
    request = {
        'agent': {'model': model,
                  'instructions': payload_files['profiles/coordinator.md'].decode('utf-8-sig') + '\n' + restriction,
                  'multi_agent': ({'enabled': True, 'max_concurrent_subagents': subagents}
                                  if subagents else {'enabled': False})},
        'environment': {'type': 'self_hosted', 'workspace_directory': '/workspace',
                        'capability_directories': ['/capabilities']},
        'input': task,
    }
    if agent_registry:
        coordinator_id = agent_registry['agents']['coordinator']['id']
        if coordinator_id:
            request['agent_id'] = coordinator_id
        request['agent']['service_tier'] = 'default'
    save(run / 'request.json', request)
    manifest = {'version': 3, 'head': head, 'skills': chosen, 'requirements': requirements,
                'budget_policy': budget_policy,
                'vnext': vnext, 'specialists': specialists, 'context_plan': context_plan,
                'visual_policy': {'ui': ui or motion, 'motion': motion,
                                  'viewports': list(engineer_vnext.VIEWPORTS) if ui or motion else []},
                'agent_registry': agent_registry,
                'financial_policy': {'max_cost_usd': max_cost_usd, 'budget_mode': budget_mode,
                                     'project_hard_limit_usd': project_hard_limit_usd,
                                     'enforcement': 'hard_cap_required' if budget_mode == 'strict' else 'platform_delayed_enforcement'},
                'filesystem_policy': policy, 'allowed_writes': writable, 'subagents_limit': subagents,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'files': {p: digest(raw) for p, raw in payload_files.items()},
                'request_sha256': digest((run / 'request.json').read_bytes()),
                'selection': selection['metrics'], 'state': 'prepared'}
    save(run / 'manifest.json', manifest)
    trace(run, 'prepared', files=len(payload_files), skills=chosen)
    return run


def verify(run, bundle=None):
    manifest = json.loads((run / 'manifest.json').read_text(encoding='utf-8'))
    bundle = bundle or run / 'bundle'
    if not bundle.is_dir() or bundle.is_symlink() or (hasattr(bundle, 'is_junction') and bundle.is_junction()):
        raise ValueError('Pacote ausente ou raiz inválida.')
    actual = {}
    for file in bundle.rglob('*'):
        if file.is_symlink() or (hasattr(file, 'is_junction') and file.is_junction()):
            raise ValueError('Links não são permitidos no pacote.')
        if file.is_file():
            if not file.resolve().is_relative_to(bundle.resolve()):
                raise ValueError('Arquivo do pacote escapa da raiz.')
            actual[file.relative_to(bundle).as_posix()] = digest(file.read_bytes())
    if actual != manifest['files'] or digest((run / 'request.json').read_bytes()) != manifest['request_sha256']:
        raise ValueError('Pacote alterado depois da preparação; prepare outra execução.')
    return manifest


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirecionamento da API recusado.')


def api(method, suffix='', payload=None, base=API, project_id=None):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        raise ValueError('OPENAI_API_KEY ausente no processo. Configure fora do repositório; não cole no chat.')
    data = json.dumps(payload).encode() if payload is not None else None
    if base not in (API, engineer_launch.AGENTS_API):
        raise ValueError('Endpoint não permitido.')
    headers = {'Authorization': 'Bearer ' + key, 'OpenAI-Beta': 'agents=v1', 'Content-Type': 'application/json'}
    if project_id:
        if not engineer_launch.identifier(project_id, 'proj'):
            raise ValueError('Project ID inválido.')
        headers['OpenAI-Project'] = project_id
    request = urllib.request.Request(base + suffix, data=data, method=method, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            response_body = response.read()
            if not response_body.strip() and method == 'POST' and suffix.endswith('/events'):
                return {}  # Event submission acknowledges success without a JSON body.
            return json.loads(response_body)
    except urllib.error.HTTPError as error:
        raise ValueError(f'API retornou HTTP {error.code}; corpo omitido para não expor conteúdo privado.') from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError('Falha de transporte; não repetir criação automaticamente. Verifique a sessão na plataforma.') from None


def create(run, live=False, budget_mode=None):
    manifest = verify(run)
    request = json.loads((run / 'request.json').read_text(encoding='utf-8'))
    if not live:
        return {'state': 'dry_run', 'network': False, 'files_uploaded': 0,
                'model': request['agent']['model'], 'environment': request['environment']['type']}
    if manifest.get('vnext'):
        raise ValueError('VNEXT_PREPARED_ONLY: nenhuma sessão remota autorizada neste pacote.')
    confirmation = engineer_launch.budget_gate(SimpleNamespace(**globals()), manifest, budget_mode)
    if not os.environ.get('OPENAI_API_KEY'):
        raise ValueError('OPENAI_API_KEY ausente; nenhuma chamada foi enviada.')
    require_preflight(run, manifest)
    verify(run, run / 'runtime')
    engineer_launch.check_saved(SimpleNamespace(**globals()), manifest, request['agent']['model'])
    marker = run / 'create-attempt.json'
    # Exclusive marker also prevents concurrent duplicate creation.
    with marker.open('x', encoding='utf-8') as stream:
        json.dump({'at': datetime.now(timezone.utc).isoformat(), 'state': 'outcome_pending'}, stream)
    trace(run, 'create_requested')
    if confirmation:
        save(run / 'platform-budget-confirmation.json', confirmation)
    project = (manifest.get('agent_registry') or {}).get('project_id')
    result = api('POST', payload=request, **({'project_id': project} if project else {}))
    session_id = result.get('id', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', session_id):
        raise ValueError('Resposta sem identificador válido; verificar plataforma antes de repetir.')
    save(run / 'session.json', result)
    trace(run, 'session_created', session_id=session_id)
    return {'session_id': session_id, 'state': 'created_executor_not_started', 'files_uploaded': 0}


def require_preflight(run, manifest):
    path = run / 'preflight.json'
    if manifest.get('version') < 3 or not path.is_file():
        raise ValueError('BLOCKED_RUNTIME: prepare novo pacote e execute preflight antes da API.')
    result = json.loads(path.read_text(encoding='utf-8'))
    if result.get('state') != 'READY' or result.get('manifest_sha256') != digest((run / 'manifest.json').read_bytes()):
        raise ValueError('BLOCKED_RUNTIME: preflight ausente, falhou ou está desatualizado.')
    return result


def remote(run, action):
    session = json.loads((run / 'session.json').read_text(encoding='utf-8'))
    session_id = session['id']
    if not re.fullmatch(r'[A-Za-z0-9_-]+', session_id):
        raise ValueError('Identificador de sessão inválido.')
    if action == 'status':
        result = api('GET', '/' + session_id)
        if result.get('id') != session_id:
            raise ValueError('A API retornou uma sessão diferente.')
        save(run / 'session.json', result)
        return {'session_id': session_id, 'status': result.get('status', 'not_reported'),
                'required_actions': [a.get('type') for a in result.get('required_actions', [])]}
    result = api('POST', '/' + session_id + '/events',
                 {'events': [{'type': 'agent.session.input.cancel'}]})
    trace(run, 'cancel_requested', session_id=session_id)
    return {'session_id': session_id, 'state': 'cancel_requested_not_confirmed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    doctor = commands.add_parser('doctor')
    doctor.add_argument('--live-readiness', action='store_true')
    doctor.add_argument('--offline', action='store_true')
    doctor.add_argument('--image')
    agents = commands.add_parser('agents-register')
    agents.add_argument('--role', choices=ROLES, required=True)
    agents.add_argument('--model', required=True)
    agents.add_argument('--agent-id', help='Registrar definição existente; omitir cria uma definição somente com --live.')
    agents.add_argument('--live', action='store_true')
    consent = commands.add_parser('confirm-platform-budget')
    consent.add_argument('--project-hard-limit-usd', type=float, required=True)
    prep = commands.add_parser('prepare')
    prep.add_argument('task')
    prep.add_argument('--model', required=True)
    prep.add_argument('--file', action='append', default=[])
    prep.add_argument('--skill', action='append', default=[])
    policy = prep.add_mutually_exclusive_group()
    policy.add_argument('--read-only', action='store_true')
    policy.add_argument('--allow-write', action='append', default=[])
    prep.add_argument('--subagents', type=int, choices=range(4), default=0)
    prep.add_argument('--profile', choices=['router'])
    prep.add_argument('--max-cost-usd', type=float, help='Teto estrito: bloqueia cobrança se não for tecnicamente garantido.')
    prep.add_argument('--budget-mode', choices=['strict', 'platform-hard-limit'], default='strict')
    prep.add_argument('--project-hard-limit-usd', type=float)
    prep.add_argument('--saved-agents', action='store_true')
    prep.add_argument('--vnext', action='store_true')
    prep.add_argument('--specialist', action='append', choices=engineer_vnext.ROLES, default=[])
    prep.add_argument('--ui', action='store_true')
    prep.add_argument('--motion', action='store_true')
    for name in ['verify', 'create', 'status', 'cancel', 'stage', 'attest', 'report', 'reconcile', 'provision', 'teardown', 'preflight', 'traces', 'validate-candidate', 'review', 'decide', 'integrate']:
        command = commands.add_parser(name)
        command.add_argument('run')
        if name in ['create', 'cancel', 'provision', 'teardown']:
            command.add_argument('--live', action='store_true')
        if name == 'create':
            command.add_argument('--budget-mode', choices=['strict', 'platform-hard-limit'])
        if name in ['provision', 'preflight']:
            command.add_argument('--image', required=True, help='Imagem local imutável sha256:...')
        if name == 'provision':
            command.add_argument('--retry-after-teardown', action='store_true')
        if name == 'reconcile':
            command.add_argument('--session-id', help='Recuperar sessão conhecida após interrupção da criação')
    args = parser.parse_args()
    try:
        if args.command == 'doctor':
            if args.live_readiness:
                import engineer_runtime
                result = engineer_launch.readiness(sys.modules[__name__], engineer_runtime, args.image, args.offline)
            else:
                result = {'application_key_present': bool(os.getenv('OPENAI_API_KEY')),
                      'executor_key_present': bool(os.getenv('OPENAI_EXECUTOR_API_KEY')),
                      'runtime': 'dedicated_self_hosted_environment_required',
                      'automatic_executor_start': False}
        elif args.command == 'agents-register':
            result = engineer_launch.manage(sys.modules[__name__], args.role, args.model, args.agent_id, args.live)
        elif args.command == 'confirm-platform-budget':
            result = engineer_launch.confirm_budget(sys.modules[__name__], args.project_hard_limit_usd)
        elif args.command == 'prepare':
            result = {'run': str(prepare(args.task, args.model, args.file, args.skill,
                                        allow_write=args.allow_write, subagents=args.subagents, profile=args.profile,
                                        max_cost_usd=(args.max_cost_usd if args.max_cost_usd is not None else
                                                      5 if args.budget_mode == 'strict' else None),
                                        budget_mode=args.budget_mode, project_hard_limit_usd=args.project_hard_limit_usd,
                                        saved_agents=args.saved_agents, vnext=args.vnext, specialists=args.specialist,
                                        ui=args.ui, motion=args.motion)), 'state': 'prepared'}
        else:
            run = Path(args.run).resolve()
            if not run.is_relative_to(RUNS.resolve()) or run == RUNS.resolve():
                raise ValueError('Execução deve estar no diretório local .tmp/engineer-runs.')
            if args.command == 'verify':
                manifest = verify(run)
                result = {'state': 'verified', 'files': len(manifest['files'])}
            elif args.command == 'create':
                result = create(run, args.live, args.budget_mode)
            elif args.command == 'cancel' and not args.live:
                result = {'state': 'dry_run', 'network': False}
            elif args.command in ['stage', 'attest', 'report', 'reconcile', 'provision', 'teardown', 'preflight', 'traces', 'validate-candidate', 'review', 'decide', 'integrate']:
                spec = importlib.util.spec_from_file_location('engineer_runtime', ROOT / 'scripts/engineer_runtime.py')
                runtime = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(runtime)
                if args.command in ['validate-candidate', 'review', 'decide', 'integrate']:
                    import engineer_review
                    result = getattr(engineer_review, args.command.replace('-', '_'))(run, sys.modules[__name__], runtime)
                else:
                    result = getattr(runtime, args.command)(run, sys.modules[__name__], **(
                    {'image': args.image, 'live': args.live, 'retry_after_teardown': args.retry_after_teardown} if args.command == 'provision' else
                    {'image': args.image} if args.command == 'preflight' else
                    {'live': args.live} if args.command == 'teardown' else
                    {'session_id': args.session_id} if args.command == 'reconcile' else {}))
            else:
                result = remote(run, args.command)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.command == 'attest' and result['status'] == 'FAIL':
            return 1
        if args.command == 'preflight' and result['state'] != 'READY':
            return 1
        if args.command == 'doctor' and args.live_readiness and result['state'] != 'READY':
            return 1
    except (ValueError, OSError) as error:
        # Do not render arbitrary filesystem or network error bodies.
        parser.exit(1, str(error) + '\n' if isinstance(error, ValueError)
                    else 'Falha local; arquivos preservados. Confira caminhos e tentativas anteriores.\n')


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    sys.exit(main())
