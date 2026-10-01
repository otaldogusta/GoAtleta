#!/usr/bin/env python3
"""Explain a bounded, advisory skill selection without executing skills or helpers."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'docs/operations/skill-routing.json'
LOG = ROOT / '.tmp/skill-selection/events.jsonl'


def normalize(text):
    plain = ''.join(c for c in unicodedata.normalize('NFD', text.lower())
                    if unicodedata.category(c) != 'Mn')
    return ' '.join(plain.split())


def contains(text, term):
    return re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', text) is not None


def registry(config):
    # Explicit portable index: names/layers only; never loads or executes skill bodies.
    portable = os.getenv('GOATLETA_SKILL_REGISTRY')
    if portable:
        data = json.loads(Path(portable).read_text(encoding='utf-8'))
        skills = data.get('skills') if isinstance(data, dict) else None
        if (not isinstance(data, dict) or data.get('version') != 1 or not isinstance(skills, dict) or not skills
                or any(not isinstance(n, str) or not n or layer not in {'core', 'trusted', 'auxiliary'}
                       for n, layer in skills.items())):
            raise ValueError('Índice portátil de skills inválido.')
        return skills
    local = {p.parent.name for folder in ['.agents/skills', '.codex/skills']
             for p in (ROOT / folder).glob('*/SKILL.md')}
    manifest = json.loads((ROOT / 'docs/operations/skills-package.lock.json').read_text(encoding='utf-8'))
    auxiliary = {item['name'] for item in manifest['skills']}
    return {**dict.fromkeys(auxiliary, 'auxiliary'),
            **dict.fromkeys(config['trusted'], 'trusted'),
            **dict.fromkeys(local, 'core')}


def select(task, config, known, includes=(), areas=()):
    max_primary = config.get('max_primary')
    if type(max_primary) is not int or not 1 <= max_primary <= 6:
        raise ValueError('max_primary deve ser um inteiro entre 1 e 6, inclusive.')
    text = normalize(task)
    cosmetic_pattern = (r'\b(?:troque|trocar|mude|mudar|altere|alterar|ajuste|ajustar|'
                        r'corrija|corrigir|melhore|melhorar)\s+'
                        r'(?:(?:apenas|somente|so|a|o|um|uma)\s+)*('
                        + '|'.join(map(re.escape, config['cosmetic_terms'])) + r')\b')
    remaining, cosmetic_actions = re.subn(cosmetic_pattern, '', text)
    cosmetic = (cosmetic_actions > 0 and not areas
                and not any(contains(remaining, t) for t in config['behavior_terms']))
    matches = [r for r in config['rules'] if r['area'] in areas or
               any(contains(text, t) for t in r['terms'])]
    if cosmetic:
        matches = [r for r in matches if r['area'] == 'ui']
    candidates = {}
    for rule in matches:
        for name in rule['skills']:
            candidates.setdefault(name, []).append(rule['area'])
    for name in includes:
        if name not in known:
            raise ValueError(f'Skill desconhecida no registro: {name}')
        candidates.setdefault(name, []).append('explicit')
    # Security and local domain knowledge precede supporting technologies.
    priority = {'goatleta-security': 0, 'goatleta-database': 1,
                'goatleta-data-model': 2, 'goatleta-testing': 3}
    ordered = sorted(candidates, key=lambda n: (
        0 if 'explicit' in candidates[n] else 1,
        {'core': 0, 'trusted': 1, 'auxiliary': 2}.get(known.get(n), 3),
        priority.get(n, 4)))
    selected = ordered[:config['max_primary']]
    if len(set(includes)) > config['max_primary']:
        raise ValueError('Divida a tarefa: mais de seis skills explícitas.')
    return {
        'task': task, 'mode': 'advisory',
        'areas': [r['area'] for r in matches],
        'selected': [{'name': n, 'layer': known[n], 'reason': ', '.join(candidates[n])}
                     for n in selected],
        'rejected': [{'name': n, 'reason': 'Limite de seis; avaliar em outra etapa se necessário.'}
                     for n in ordered if n not in selected],
        'unconsidered': 'Demais skills não são candidatas sem relação concreta ou seleção explícita.',
        'metrics': {'candidates': len(candidates), 'suggested': len(selected),
                    'local_suggested': sum(known[n] == 'core' for n in selected),
                    'external_suggested': sum(known[n] != 'core' for n in selected)},
        'requires_staging': len(ordered) > config['max_primary'],
        'needs_inspection': not bool(selected) or len(ordered) > config['max_primary'],
    }


def record(result, used, known, path=LOG):
    unknown = set(used) - known.keys()
    if unknown:
        raise ValueError('Skills utilizadas desconhecidas: ' + ', '.join(sorted(unknown)))
    names = sorted(set(used))
    event = {'version': 1, 'at': datetime.now(timezone.utc).isoformat(),
             'areas': result['areas'], 'candidates': result['metrics']['candidates'],
             'suggested': [s['name'] for s in result['selected']], 'used': names,
             'local_used': sum(known[n] == 'core' for n in names),
             'external_used': sum(known[n] != 'core' for n in names)}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(event, ensure_ascii=False) + '\n')
    return event


def metrics(path=LOG):
    events = []
    lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
            valid = (isinstance(event, dict) and event.get('version') == 1
                     and isinstance(event.get('used'), list)
                     and all(isinstance(n, str) for n in event['used'])
                     and all(type(event.get(k)) is int and event[k] >= 0
                             for k in ['local_used', 'external_used'])
                     and len(set(event['used'])) == len(event['used'])
                     and event['local_used'] + event['external_used'] == len(event['used']))
            if not valid:
                raise ValueError('Invalid metric event')
        except (ValueError, TypeError):
            raise ValueError(f'Evento de métricas inválido na linha {number}; arquivo preservado.') from None
        events.append(event)
    return {'recorded_tasks': len(events),
            'skill_uses': dict(Counter(n for e in events for n in e['used'])),
            'local_uses': sum(e['local_used'] for e in events),
            'external_uses': sum(e['external_used'] for e in events)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', nargs='?')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--include', action='append', default=[], help='Skill explícita e justificada pela tarefa')
    parser.add_argument('--area', action='append', default=[], help='Área confirmada após inspeção do código')
    parser.add_argument('--record-used', nargs='*', default=None, help='Registrar somente skills realmente lidas/utilizadas')
    parser.add_argument('--metrics', action='store_true')
    args = parser.parse_args()
    if args.metrics:
        if args.task or args.include or args.area or args.record_used is not None:
            parser.error('--metrics deve ser usado sozinho')
        try:
            print(json.dumps(metrics(), ensure_ascii=False, indent=2))
        except ValueError as error:
            parser.error(str(error))
        return
    if not args.task or not args.task.strip():
        parser.error('Informe uma tarefa concreta')
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    if set(args.area) - {r['area'] for r in config['rules']}:
        parser.error('Área desconhecida; consulte docs/operations/skill-routing.json')
    known = registry(config)
    try:
        result = select(args.task, config, known, args.include, args.area)
        if args.record_used is not None:
            result['recorded'] = record(result, args.record_used, known)
    except ValueError as error:
        parser.error(str(error))
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('TASK:', result['task'])
    print('SELECTED (recomendação; confirmar no código):')
    for item in result['selected']:
        print(f"  + {item['name']} [{item['layer']}]: {item['reason']}")
    if not result['selected']:
        print('  Nenhuma seleção automática; investigar o escopo.')
    if result['requires_staging']:
        print('  Dividir em etapas: há candidatas além do limite; não omitir validações necessárias.')
    print('REJECTED:')
    for item in result['rejected']:
        print(f"  - {item['name']}: {item['reason']}")
    print('  ' + result['unconsidered'])
    print('METRICS:', json.dumps(result['metrics'], ensure_ascii=False))


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    main()
