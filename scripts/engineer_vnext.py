"""Local vNext planning and evidence gates. No API, execution or approval authority."""
import hashlib
import json
from pathlib import Path
import re

ROLES = ('implementation', 'test-review', 'security-review', 'ui-ux-motion-review')
VIEWPORTS = {'mobile-small': [390, 844], 'tablet': [768, 1024], 'desktop': [1440, 900]}
SEVERITIES = {'BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'INFO'}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def route(task, files, root, ui=False, motion=False, security=False):
    policy = json.loads((root / 'docs/operations/engineer/policies/agent-routing.json').read_text(encoding='utf8'))
    text = task.casefold()
    motion = motion or any(t in text for t in policy['motion_terms'])
    ui = ui or motion or any(t in text for t in policy['ui_terms'])
    security = security or (not ui and any(t in text for t in policy['security_terms']))
    # Security is an explicit affected surface; visual changes on auth screens do not imply it.
    roles = ['test-review']
    if security:
        roles.append('security-review')
    if ui:
        roles.append('ui-ux-motion-review')
    skills = ['goatleta-design-system', 'goatleta-courtside-ux'] if ui else ['goatleta-testing']
    if security:
        skills.append('goatleta-security')
    external = []
    if motion:
        external.append('animate-expo')
        if any(t in text for t in ('trava', 'jank', 'stutter', 'performance')):
            external.append('fixing-motion-performance')
    elif ui and any(t in text for t in ('expo', 'react native', 'nova tela')):
        external += ['expo-native-ui', 'vercel-react-native-skills']
    return {'specialists': roles[:3], 'skills': (skills + external)[:6], 'ui': ui, 'motion': motion,
            'tsx_hint_only': any(p.endswith(('.tsx', '.jsx')) for p in files),
            'security_surface': security, 'aliases': policy['skill_aliases']}


def plan(payload, root, specialists, task):
    if len(specialists) > 3 or len(set(specialists)) != len(specialists) or any(r not in ROLES for r in specialists):
        raise ValueError('VNEXT: selecione até três papéis únicos válidos.')
    if 'implementation' in specialists:
        raise ValueError('VNEXT: Implementation exige fase gravável separada; pacote atual é de revisão read-only.')
    budgets = json.loads((root / 'docs/operations/engineer/policies/context-budget.json').read_text(encoding='utf8'))
    coordinator = ['workspace/AGENTS.md', 'workspace/docs/operations/skill-governance.md',
                   'workspace/docs/operations/validation-ladder.md', 'workspace/runtime/task-requirements.json',
                   'profiles/coordinator.md']
    contexts = {}
    for role in ['coordinator', *specialists]:
        if role == 'coordinator':
            paths = [p for p in coordinator if p in payload]
        else:
            names = {'test-review': ('testing',), 'security-review': ('security', 'data-model'),
                     'ui-ux-motion-review': ('design-system', 'courtside', 'animate', 'motion', 'expo', 'react-native')}[role]
            paths = [p for p in payload if (p.startswith('workspace/') and not p.endswith('preflight.py'))
                     or p == 'profiles/' + role + '.md'
                     or (p.startswith('capabilities/') and any(n in p for n in names))]
        count, size = len(paths), sum(len(payload[p]) for p in paths)
        if count > budgets[role]['max_files'] or size > budgets[role]['max_bytes']:
            raise ValueError('CONTEXT_BUDGET: ' + role + ' excede arquivos/bytes; reduza a etapa.')
        contexts[role] = {'files': paths, 'files_available': count, 'bytes_available': size,
                          'skills_available': sorted({p.split('/')[1] for p in paths if p.startswith('capabilities/')}),
                          'budget': budgets[role]}
    return {'version': 1, 'task': task, 'roles': contexts,
            'final_test_owner': 'test-review' if 'test-review' in specialists else None,
            'isolation': 'instruction_partition_only_shared_filesystem',
            'token_guarantee': False}


def context_report(run, manifest, history):
    contexts = manifest.get('context_plan', {}).get('roles', {})
    # Root attribution is known; specialist role attribution requires explicit mapping.
    root_turns = {t['id'] for t in history.get('turns', []) if not t.get('subagent_id')}
    result = {}
    for role, context in contexts.items():
        opened = []
        for p in context['files']:
            raw = (run / 'bundle' / p).read_text(encoding='utf-8-sig')
            if role == 'coordinator' and any(i.get('turn_id') in root_turns and i.get('exit_code') == 0
                    and raw and raw in str(i.get('output', '')) for i in history.get('items', [])):
                opened.append(p)
        result[role] = {**context, 'files_opened': opened if role == 'coordinator' else None,
                        'skills_opened': sorted({p.split('/')[1] for p in opened if p.startswith('capabilities/')}) if role == 'coordinator' else None,
                        'input_bytes': None, 'observability': 'full_content_command_output_only; unknown is null'}
    return result


def evidence_file(run, relative):
    p = Path(relative)
    if p.is_absolute() or '..' in p.parts or ':' in relative or not p.parts or p.parts[0] != 'evidence':
        raise ValueError('Evidência fora de evidence/.')
    target = run / p
    if any(x.is_symlink() or (hasattr(x, 'is_junction') and x.is_junction()) for x in [target, *target.parents]):
        raise ValueError('Link em evidência.')
    if not target.resolve().is_relative_to(run.resolve()) or not target.is_file():
        raise ValueError('Evidência ausente.')
    return target


def visual_gate(run, manifest):
    policy = manifest.get('visual_policy', {})
    if not policy.get('ui'):
        return {'UI_UX_GATE': 'NOT_APPLICABLE', 'MOTION_GATE': 'NOT_APPLICABLE', 'evidence_hashes': {}}
    missing = {'UI_UX_GATE': 'UNVERIFIED', 'MOTION_GATE': 'UNVERIFIED' if policy.get('motion') else 'NOT_APPLICABLE', 'evidence_hashes': {}}
    try:
        capture = json.loads((run / 'evidence/capture.json').read_text(encoding='utf8'))
        review = json.loads((run / 'ui-review.json').read_text(encoding='utf8'))
        fingerprint = sha((run / 'manifest.json').read_bytes())
        if capture['manifest_sha256'] != fingerprint or review['manifest_sha256'] != fingerprint:
            return missing
        if manifest.get('filesystem_policy') != 'read_only':
            return missing  # Writable candidates require a separate candidate-bound evidence contract.
        if capture.get('state') != 'CAPTURED' or not isinstance(review.get('evidence_reviewed'), list):
            return missing
        hashes = {}
        shots, motion_views, reduced_views = set(), set(), set()
        for item in capture['artifacts']:
            target = evidence_file(run, item['path'])
            raw = target.read_bytes()
            if sha(raw) != item['sha256'] or item['path'] in hashes:
                return missing
            if item['kind'] == 'screenshot':
                import struct
                if len(raw) < 24 or raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[12:16] != b'IHDR': return missing
                if list(struct.unpack('>II', raw[16:24])) != VIEWPORTS.get(item['viewport']): return missing
            if item['kind'] == 'video' and not raw.startswith(b'\x1aE\xdf\xa3'): return missing
            hashes[item['path']] = item['sha256']
            if item['path'] not in review['evidence_reviewed']:
                continue
            if item['kind'] == 'screenshot': shots.add(item['viewport'])
            if item['kind'] == 'video': motion_views.add(item['viewport'])
            if item['kind'] == 'video' and item.get('reduced_motion') is True: reduced_views.add(item['viewport'])
        if not set(policy['viewports']).issubset(shots) or not review['evidence_reviewed'] or any(p not in hashes for p in review['evidence_reviewed']):
            return missing
        findings = []
        for category in ('visual', 'ux', 'accessibility', 'motion', 'performance'):
            if not isinstance(review.get(category), list): return missing
            for finding in review[category]:
                if finding.get('severity') not in SEVERITIES or finding.get('evidence') not in review['evidence_reviewed']:
                    return missing
                if any(not isinstance(finding.get(k), str) or not finding[k].strip() for k in ('file', 'issue', 'impact', 'recommendation')):
                    return missing
                findings.append(finding)
        def finding_status(values):
            return ('FAIL' if any(f['severity'] in ('BLOCKER', 'HIGH') for f in values)
                    else 'PASS_WITH_FINDINGS' if values else 'PASS')
        status = finding_status(findings)
        if review.get('result') != status:
            return missing
        if review['motion'] and not policy.get('motion'):
            return missing  # Expand the motion scope before approving a discovered motion issue.
        ui_status = finding_status([f for category in ('visual', 'ux', 'accessibility', 'performance') for f in review[category]])
        motion_ok = set(policy['viewports']).issubset(motion_views & reduced_views)
        return {'UI_UX_GATE': ui_status, 'MOTION_GATE': finding_status(review['motion']) if policy.get('motion') and motion_ok else missing['MOTION_GATE'],
                'evidence_hashes': hashes, 'review_sha256': sha((run / 'ui-review.json').read_bytes()),
                'capture_sha256': sha((run / 'evidence/capture.json').read_bytes()),
                'scope': 'review_evidence_not_automatic_visual_judgment_or_native_performance'}
    except (ValueError, OSError, KeyError, TypeError, AttributeError):
        return missing


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Seleção local; não executa nem chama modelos.')
    parser.add_argument('task')
    parser.add_argument('--file', action='append', default=[])
    parser.add_argument('--ui', action='store_true')
    parser.add_argument('--motion', action='store_true')
    parser.add_argument('--security', action='store_true', help='Mudança funcional em dados/permissões, não apenas aparência.')
    args = parser.parse_args()
    print(json.dumps(route(args.task, args.file, Path(__file__).resolve().parents[1], args.ui, args.motion, args.security), ensure_ascii=False, indent=2))
