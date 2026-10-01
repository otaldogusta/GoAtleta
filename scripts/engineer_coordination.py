"""Evidence-based multi-agent reporting; semantic incorporation remains reviewable."""
import json


def has_text(item):
    return any(c.get('type') == 'output_text' and isinstance(c.get('text'), str) and c['text'].strip()
               for c in item.get('content', []))


def evaluate(run, manifest, history, e):
    if not manifest.get('subagents_limit'):
        return {'state': 'NOT_REQUESTED'}
    turns = history.get('turns', [])
    items = history.get('items', [])
    roots = [t for t in turns if t.get('subagent_id') is None]
    root_ids = {t.get('id') for t in roots}
    children = [t for t in turns if t.get('subagent_id')]
    child_turn_ids = {t.get('id') for t in children}
    child_ids = {t['subagent_id'] for t in children}
    create = [i['id'] for i in items if i.get('type') == 'create_subagent_call'
              and i.get('status') == 'completed' and i.get('turn_id') in root_ids]
    wait = [i['id'] for i in items if i.get('type') == 'wait_for_subagents_call'
            and i.get('status') == 'completed' and i.get('turn_id') in root_ids
            and isinstance(i.get('recipient_agent_ids'), list) and i['recipient_agent_ids']
            and all(isinstance(v, str) and v in child_ids for v in i['recipient_agent_ids'])]
    wait_calls = [i['id'] for i in items if i.get('type') == 'wait_for_subagents_call'
                  and i.get('status') == 'completed' and i.get('turn_id') in root_ids]
    commands = [i['id'] for i in items if i.get('type') == 'command_execution'
                and i.get('turn_id') in child_turn_ids and i.get('exit_code') == 0]
    child_answers = [i for i in items if i.get('turn_id') in child_turn_ids
                     and i.get('role') == 'assistant' and i.get('phase') == 'final_answer' and has_text(i)]
    root_answers = [i for i in items if i.get('turn_id') in root_ids
                    and i.get('role') == 'assistant' and i.get('phase') == 'final_answer' and has_text(i)]
    covered = {v for i in items if i.get('id') in wait for v in i['recipient_agent_ids']}
    checks = {'delegated': bool(create and children),
              'specialist_completed': bool(children) and all(t.get('status') == 'completed' for t in children),
              'independent_command_evidence': bool(children) and all(
                  any(i.get('turn_id') == t['id'] and i.get('id') in commands for i in items)
                  and any(i.get('turn_id') == t['id'] for i in child_answers) for t in children),
              'waited': bool(wait) and set(wait_calls) == set(wait) and child_ids.issubset(covered),
              'root_completed': bool(roots) and roots[-1].get('status') == 'completed',
              'root_answer_present': bool(root_answers), 'incorporated': None}
    review_path = run / 'coordination-review.json'
    if history and review_path.is_file():
        review = json.loads(review_path.read_text(encoding='utf-8'))
        reviewed_ids = review.get('specialist_item_ids', [review.get('specialist_item_id')])
        covered_turns = {i['turn_id'] for i in child_answers if i['id'] in reviewed_ids}
        if (review.get('history_sha256') == e.digest((run / 'history.json').read_bytes())
                and review.get('root_item_id') in {i['id'] for i in root_answers}
                and child_turn_ids.issubset(covered_turns)
                and isinstance(review.get('rationale'), str) and review['rationale'].strip()
                and type(review.get('incorporated')) is bool):
            checks['incorporated'] = review['incorporated']
    structural = all(v for k, v in checks.items() if k != 'incorporated')
    if not roots or roots[-1].get('status') not in ('completed', 'failed', 'cancelled'):
        state = 'PENDING_EXECUTION'
    elif not structural or checks['incorporated'] is False:
        state = 'FAIL_MULTI_AGENT'
    elif checks['incorporated'] is None:
        state = 'PENDING_INCORPORATION_REVIEW'
    else:
        state = 'PASS_MULTI_AGENT_REVIEWED'
    return {'state': state, 'checks': checks, 'specialist_turns': children,
            'blocking_reasons': ([] if checks['waited'] else ['WAIT_TARGET_NOT_PROVEN']),
            'evidence': {'create_item_ids': create, 'wait_item_ids': wait,
                         'observed_wait_item_ids': wait_calls,
                         'unattributed_wait_item_ids': [i for i in wait_calls if i not in wait],
                         'specialist_command_ids': commands,
                         'specialist_answer_ids': [i['id'] for i in child_answers],
                         'root_answer_ids': [i['id'] for i in root_answers]},
            'note': 'Saved agent IDs are not inferred from subagent IDs or create.agent_id (requester).'}


def summary(result):
    c = result.get('coordination', {})
    opened = result.get('skills_opened')
    changed = result.get('changed_files')
    return ('# Go Atleta Engineer — ' + result['run_id'] + '\n\n'
            + '| Evidência | Estado |\n| --- | --- |\n'
            + f"| Coordenador concluído | {result['root_turn_completed']} |\n"
            + f"| Coordenação | {c.get('state', 'NOT_REQUESTED')} |\n"
            + f"| Arquivos alterados | {len(changed) if changed is not None else 'desconhecido'} |\n"
            + f"| Testes observados | {result.get('tests_count') if result.get('tests_count') is not None else 'não comprovados'} |\n"
            + f"| Skills selecionadas / abertas | {len(result['skills_selected'])} / {len(opened) if opened is not None else 'não comprovado'} |\n"
            + f"| Atestação | {result.get('attestation_status') or 'pendente'} |\n"
            + f"| Container | {result.get('container_state') or 'não iniciado'} |\n"
            + ''.join(f'| {name} | {value} |\n' for name, value in result.get('visual_gates', {}).items()
                      if name in ('UI_UX_GATE', 'MOTION_GATE'))
            + f"| Orçamento | {result.get('financial_policy', {}).get('budget_mode', 'legacy')} |\n"
            + '| Custo real | desconhecido; não é zero |\n'
            + f"| Integração | {'BLOCKED_READ_ONLY' if result['filesystem_policy'] == 'read_only' else result['quality_gate']} |\n\n"
            + 'Detalhes e IDs: run-report.json. Ausência de evidência não significa aprovação.\n')
