"""Conservative observed-usage limits; not a billing cap or invented API parameter."""
from datetime import datetime, timezone

DEFAULT = {'max_tokens_per_turn': 300000, 'max_total_tokens': 500000,
           'max_agent_turns': 4, 'max_subagents': 1, 'max_commands': 40,
           'max_runtime_seconds': 300}


def validate(policy, subagents):
    if set(policy) != set(DEFAULT) or any(type(v) is not int or v < 1 for v in policy.values()):
        raise ValueError('BUDGET_GATE: política inválida.')
    if subagents > policy['max_subagents']:
        raise ValueError('BUDGET_GATE: mais especialistas que o limite local autorizado.')


def evaluate(policy, history, started_at=None, now=None, session_usage=None):
    validate(policy, 0)
    turns = history.get('turns', [])
    items = history.get('items', [])
    usages = [t.get('usage', {}).get('total_tokens') if isinstance(t.get('usage'), dict) else None for t in turns]
    known_usage = [n for n in usages if type(n) is int and n >= 0]
    session_total = session_usage.get('total_tokens') if isinstance(session_usage, dict) else None
    session_total_valid = type(session_total) is int and session_total >= 0
    # Session usage already aggregates the coordinator and its descendants.
    # Never add child-turn usage to that aggregate a second time.
    total = session_total if session_total_valid else (sum(known_usage) if known_usage else None)
    source = 'session_aggregate' if session_total_valid else 'turn_sum_conservative_overlap_possible'
    if session_total_valid and known_usage and session_total < max(known_usage):
        total = max(known_usage)
        source = 'max_reported_turn_session_usage_inconsistent'
    counts = {'agent_turns': len(turns), 'subagents': len({t['subagent_id'] for t in turns if t.get('subagent_id')}),
              'commands': sum(i.get('type') == 'command_execution' for i in items),
              'total_tokens': total,
              'tokens_per_turn': max(known_usage) if known_usage else None}
    violations = [key for key in counts if counts[key] is not None and counts[key] > policy['max_' + key]]
    active = any(t.get('status') not in ('completed', 'failed', 'cancelled') for t in turns)
    if started_at and active:
        elapsed = (now or datetime.now(timezone.utc)).timestamp() - datetime.fromisoformat(started_at).timestamp()
        counts['runtime_seconds'] = max(0, elapsed)
        if elapsed > policy['max_runtime_seconds']:
            violations.append('runtime_seconds')
    return {'state': 'BUDGET_GATE' if violations else 'WITHIN_OBSERVED_LIMITS',
            'violations': violations, 'observed': counts,
            'usage_complete': bool(turns) and len(known_usage) == len(turns),
            'total_tokens_source': source,
            'token_semantics': 'includes_cached_input; turn_usage_may_include_descendants; not_billed_dollars',
            'financial_cost_usd': None, 'enforcement': 'observed_on_reconcile; runtime timeout in executor'}
