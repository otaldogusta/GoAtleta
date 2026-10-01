"""Host-side human integration gate. Never mounted in the executor."""
import difflib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def evidence(run, e, runtime):
    manifest = e.verify(run)
    if read(run / 'container.json').get('state') != 'removed':
        raise ValueError('REVIEW_BLOCKED: teardown obrigatório.')
    attestation = runtime.attest(run, e)
    report = runtime.report(run, e)
    if (run / 'budget-result.json').exists() and read(run / 'budget-result.json').get('state') == 'BUDGET_GATE':
        raise ValueError('BUDGET_GATE: revisar política e preparar nova execução; integração bloqueada.')
    if attestation['status'] != 'PASS' or not report['root_turn_completed']:
        raise ValueError('REVIEW_BLOCKED: conclusão e atestação PASS obrigatórias.')
    if manifest.get('subagents_limit') and report.get('coordination', {}).get('state') != 'PASS_MULTI_AGENT_REVIEWED':
        raise ValueError('REVIEW_BLOCKED: coordenação independente revisada obrigatória.')
    if not manifest['allowed_writes']:
        raise ValueError('REVIEW_BLOCKED: nenhuma alteração autorizada para integrar.')
    import engineer_vnext
    visual = engineer_vnext.visual_gate(run, manifest)
    if any(visual[k] in ('FAIL', 'UNVERIFIED') for k in ('UI_UX_GATE', 'MOTION_GATE')):
        raise ValueError('UI_UX_GATE: evidência visual/motion ausente, divergente ou bloqueante.')
    snapshot = runtime.snapshot(run / 'runtime', e)
    return {'manifest_sha256': e.digest((run / 'manifest.json').read_bytes()),
            'history_sha256': e.digest((run / 'history.json').read_bytes()),
            'candidate': {p: v['sha256'] for p, v in sorted(snapshot.items())},
            'allowed_writes': manifest['allowed_writes'], 'visual_evidence': visual}


def validate_candidate(run, e, runtime):
    proof = evidence(run, e, runtime)
    manifest = e.verify(run)
    if not manifest['requirements']['validation_commands']:
        raise ValueError('REVIEW_BLOCKED: defina validações da tarefa.')
    image = e.require_preflight(run, manifest)['image']
    context = json.loads(runtime.docker(['context', 'inspect']))[0]['Endpoints']['docker']['Host']
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
    args += runtime.task_environment(manifest)
    args += ['--entrypoint', 'python', image, '-B', '/workspace/runtime/preflight.py']
    result = json.loads(runtime.docker(args))
    validations = result.get('validation', [])
    if ([v.get('command') for v in validations] != manifest['requirements']['validation_commands']
            or any(v.get('exit_code') != 0 for v in validations)):
        result['state'] = 'BLOCKED_RUNTIME'
    # Commands execute untrusted candidate code only inside a credential-free isolated container.
    if proof != evidence(run, e, runtime):
        raise ValueError('Candidato mudou durante validação.')
    e.save(run / 'candidate-validation.json', {'evidence': proof, 'result': result})
    return {'state': 'TESTS_PASS' if result.get('state') == 'READY' else 'TESTS_FAIL',
            'validation': result.get('validation')}


def review(run, e, runtime):
    proof = evidence(run, e, runtime)
    checks = read(run / 'candidate-validation.json')
    if checks.get('evidence') != proof or checks.get('result', {}).get('state') != 'READY':
        raise ValueError('REVIEW_BLOCKED: testes ausentes, falhos ou candidato alterado.')
    proof['validation_sha256'] = e.digest((run / 'candidate-validation.json').read_bytes())
    fingerprint = e.digest(json.dumps(proof, sort_keys=True).encode())
    patch = []
    for p in proof['allowed_writes']:
        before = (run / 'bundle/workspace' / p).read_text(encoding='utf-8').splitlines(True)
        after = (run / 'runtime/workspace' / p).read_text(encoding='utf-8').splitlines(True)
        patch.extend(difflib.unified_diff(before, after, fromfile='a/' + p, tofile='b/' + p))
    (run / 'candidate.diff').write_text(''.join(patch), encoding='utf-8')
    result = {'state': 'WAITING_FOR_HUMAN', 'fingerprint': fingerprint, 'evidence': proof,
              'diff': str(run / 'candidate.diff')}
    e.save(run / 'review-request.json', result)
    return result


def decide(run, e, runtime):
    if not sys.stdin.isatty():
        raise ValueError('Decisão exige terminal humano interativo; sem --yes ou stdin redirecionado.')
    request = review(run, e, runtime)
    print('Revise candidate.diff, candidate-validation.json e run-report.json nesta pasta:', run)
    print('Fingerprint:', request['fingerprint'])
    answer = input('Digite APROVAR <fingerprint> ou REJEITAR <fingerprint>: ').strip()
    decision = {'APROVAR ' + request['fingerprint']: 'APPROVED',
                'REJEITAR ' + request['fingerprint']: 'REJECTED'}.get(answer)
    if decision is None:
        raise ValueError('Decisão inválida; candidato permanece bloqueado.')
    if review(run, e, runtime)['fingerprint'] != request['fingerprint']:
        raise ValueError('Evidência mudou durante a revisão.')
    result = {'state': decision, 'fingerprint': request['fingerprint'],
              'at': datetime.now(timezone.utc).isoformat(), 'channel': 'interactive_host_terminal'}
    with (run / 'human-decision.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
    e.trace(run, 'human_decision', state=decision, fingerprint=request['fingerprint'])
    return result


def integrate(run, e, runtime, root=None):
    root = (root or e.ROOT).resolve()
    request = review(run, e, runtime)
    decision = read(run / 'human-decision.json') if (run / 'human-decision.json').exists() else {}
    if decision.get('state') != 'APPROVED' or decision.get('fingerprint') != request['fingerprint']:
        raise ValueError('WAITING_FOR_HUMAN: aprovação válida obrigatória; nenhuma escrita realizada.')
    marker = run / 'integration-attempt.json'
    if marker.exists():
        raise ValueError('Integração já tentada; reconciliar evidência antes de repetir.')
    manifest = e.verify(run)
    changes = []
    for p in manifest['allowed_writes']:
        target = e.source(root, p)
        # Reject any symlink/junction in the destination chain, including same-root links.
        for part in [root / p, *(root / p).parents]:
            if part == root.parent:
                break
            if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
                raise ValueError('Destino contém link.')
        before = target.read_bytes()
        if e.digest(before) != manifest['files']['workspace/' + p]:
            raise ValueError('BASELINE_CHANGED: preservar alteração local e preparar nova revisão.')
        after = (run / 'runtime/workspace' / p).read_bytes()
        changes.append((p, target, before, after))
    lock = root / '.tmp/engineer-integration.lock'
    lock.parent.mkdir(exist_ok=True)
    with lock.open('x') as stream:
        stream.write(run.name)
    try:
        # Recheck all targets after acquiring the controller lock.
        if any(target.read_bytes() != before for _, target, before, _ in changes):
            raise ValueError('BASELINE_CHANGED')
        with marker.open('x') as stream:
            json.dump({'fingerprint': request['fingerprint'], 'state': 'started'}, stream)
        for p, target, before, after in changes:
            backup = run / 'integration-backup' / p
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(before)
        applied = []
        try:
            for p, target, before, after in changes:
                temporary = target.with_name(target.name + '.engineer-tmp')
                with temporary.open('xb') as stream:
                    stream.write(after)
                os.replace(temporary, target)
                applied.append((target, before, after))
        except OSError:
            for target, before, after in reversed(applied):
                if target.read_bytes() == after:
                    target.write_bytes(before)
            raise
        result = {'state': 'INTEGRATED', 'files': [p for p, *_ in changes],
                  'fingerprint': request['fingerprint'], 'git_write': False}
        e.save(run / 'integration.json', result)
        return result
    finally:
        lock.unlink()
