"""Offline historical dataset and result collection. Never starts a paid run."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / 'docs/operations/engineer/benchmark.json'
CASES = [
    ('4b4258bb', 'rls', 'Proteger ciclos de planejamento por autorização e organização.'),
    ('f06622be', 'scouting', 'Restaurar navegação para análise e sessões de scouting da turma.'),
    ('ae76baa2', 'scouting', 'Restaurar a ação rápida de scouting na turma.'),
    ('3193257e', 'reports', 'Extrair a aba de relatório preservando comportamento e contratos.'),
    ('62c99f12', 'architecture', 'Extrair a aba de scouting da tela de sessão.'),
    ('215a8967', 'ui', 'Manter ações de periodização acessíveis acima do botão flutuante.'),
    ('cc6aadba', 'refactoring', 'Extrair o hook de relatório da sessão sem alterar persistência.'),
    ('5509ae67', 'periodization', 'Extrair conversão de pacote pedagógico para plano de treino.'),
    ('132074b1', 'bug', 'Preservar memoização das datas da turma.'),
    ('27d32c58', 'architecture', 'Isolar carregamento do dashboard de coordenação e escopo de requisições.'),
    ('8f8810db', 'security', 'Permitir atualização da própria foto do atleta com isolamento e atualização do avatar privado.'),
    ('5187dfa5', 'security', 'Concluir onboarding pelo convite de professor mantendo autorização.'),
    ('6043e8b6', 'security', 'Proteger onboarding de convite de professor e acesso ao perfil.'),
    ('ca4f7479', 'ui', 'Manter campos do relatório visíveis acima do teclado.'),
    ('71061339', 'bug', 'Estabilizar troca de conta OAuth sem reutilizar contexto da organização anterior.'),
    ('fdcc73e0', 'ui', 'Restaurar abertura do menu lateral do atleta no mobile.'),
    ('77d34e61', 'tests', 'Isolar teste Deno do webhook para não ser executado pelo Jest.'),
    ('1f83fa5d', 'bug', 'Normalizar formato do telefone confirmado.'),
    ('6a6c8196', 'bug', 'Ler corretamente o destino de telefone no payload do hook de SMS.'),
    ('0ab14944', 'tests', 'Esperar o servidor PostgreSQL final no harness e tornar avisos esperados verificáveis.'),
    ('1f7d0509', 'volleyball', 'Refinar etapas e exportação do fluxo de quadra visual 5x1.'),
    ('53246152', 'periodization', 'Persistir limites ACWR por turma nas camadas de dados existentes.'),
    ('365c9ad6', 'migrations', 'Normalizar versões das migrations para compatibilidade com Supabase CLI.'),
    ('89d6c126', 'reports', 'Persistir e recuperar a última edição do registro de sessão.'),
]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def build():
    rows = []
    for i, (ref, area, task) in enumerate(CASES, 1):
        commit = git('rev-parse', ref).decode().strip()
        parent = git('rev-parse', commit + '^').decode().strip()
        patch = git('diff', '--no-ext-diff', '--no-renames', parent, commit)
        files = git('diff', '--name-only', '--no-renames', parent, commit).decode().splitlines()
        rows.append({'id': f'GA-{i:03}', 'category': area, 'task': task,
                     'task_source': 'reconstructed_from_commit_not_original_ticket',
                     'base_commit': parent, 'reference_commit': commit,
                     'reference_diff_sha256': hashlib.sha256(patch).hexdigest(),
                     'reference_files': files,
                     'test_evidence_paths': [p for p in files if '/__tests__/' in p or '.test.' in p],
                     'state': 'CURATED_NOT_EXECUTED', 'runtime_profile': 'requires_case_specific_preflight',
                     'graders': ['scope', 'tests', 'regressions', 'semantic_review', 'human_correction'],
                     'acceptance': ['Satisfazer o objetivo preservando contratos do commit base.',
                                    'Revisar regressões e segurança com critérios específicos antes da run.',
                                    'Não exigir igualdade textual com o patch histórico.']})
    return {'version': 1, 'cases': rows, 'remote_runs': 0,
            'oracle_policy': 'Reference commit and patch stay evaluator-side; never send to implementation agent.',
            'limitations': 'Not original tickets; task criteria and runtime require review before paid execution.'}


def validate(data):
    seen = set()
    for case in data['cases']:
        if case['id'] in seen:
            raise ValueError('Duplicate case')
        seen.add(case['id'])
        parent = git('rev-parse', case['reference_commit'] + '^').decode().strip()
        patch = git('diff', '--no-ext-diff', '--no-renames', parent, case['reference_commit'])
        if parent != case['base_commit'] or hashlib.sha256(patch).hexdigest() != case['reference_diff_sha256']:
            raise ValueError('Historical reference changed')
    return {'state': 'VALID', 'cases': len(seen), 'categories': sorted({c['category'] for c in data['cases']}),
            'quality_measured': False, 'network': False}


def score(case, report, review=None):
    if report.get('base_commit') != case['base_commit']:
        raise ValueError('Run não partiu do commit-base deste caso; não pontuar replay contaminado.')
    review = review or {}
    # Human semantic grades are never inferred from an agent saying it passed.
    fields = ('diff_quality', 'regressions', 'human_correction', 'reviewer', 'rationale')
    return {'case_id': case['id'], 'base_commit': case['base_commit'], 'run_id': report.get('run_id'),
            'model': report.get('model'), 'skills': report.get('skills_selected'),
            'subagents': report.get('subagents_observed'), 'turns': report.get('turns'),
            'usage': report.get('usage'), 'cost_usd': report.get('estimated_cost_usd'),
            'tests': report.get('tests_count'), 'attestation': report.get('attestation_status'),
            'changed_files': report.get('changed_files'),
            'grades': {k: review.get(k) for k in fields},
            'state': 'REVIEWED' if all(review.get(k) is not None for k in fields) else 'UNSCORED'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate', 'score'])
    parser.add_argument('--case')
    parser.add_argument('--report', type=Path)
    parser.add_argument('--review', type=Path)
    args = parser.parse_args()
    if args.command == 'build':
        data = build()
        DATASET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        result = validate(data)
    else:
        data = json.loads(DATASET.read_text(encoding='utf-8'))
        if args.command == 'validate':
            result = validate(data)
        else:
            case = next(c for c in data['cases'] if c['id'] == args.case)
            report = json.loads(args.report.read_text(encoding='utf-8'))
            review = json.loads(args.review.read_text(encoding='utf-8')) if args.review else None
            result = score(case, report, review)
    print(json.dumps(result, ensure_ascii=False, indent=2))
