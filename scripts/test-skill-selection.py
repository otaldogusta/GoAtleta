"""Behavioral checks for advisory routing; all telemetry stays in temporary files."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
from unittest.mock import patch

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('routing', Path(__file__).with_name('explain-skill-selection.py'))
routing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routing)
CONFIG = json.loads(routing.CONFIG.read_text(encoding='utf-8'))
KNOWN = routing.registry(CONFIG)


def names(result):
    return {s['name'] for s in result['selected']}


class SelectionTests(unittest.TestCase):
    def test_max_primary_rejects_missing_field_before_routing(self):
        with self.assertRaisesRegex(ValueError, 'max_primary.*inteiro.*1.*6'):
            routing.select('Revisar política RLS', {}, KNOWN)

    def test_max_primary_rejects_invalid_values_before_routing(self):
        class IntSubclass(int):
            pass

        for value in [True, False, None, '', '1', '6', 'invalid', 1.0, 6.0, 1.5,
                      0, -1, -6, 7, 100, IntSubclass(1)]:
            with self.subTest(value=value, value_type=type(value).__name__):
                with self.assertRaisesRegex(ValueError, 'max_primary.*inteiro.*1.*6'):
                    routing.select('Revisar política RLS', {'max_primary': value}, KNOWN)

    def test_max_primary_accepts_boundaries_and_preserves_order(self):
        task = 'Nova tela de scouting com RLS no Expo e fluxo web'
        baseline = routing.select(task, CONFIG, KNOWN)
        for limit in [1, 6]:
            with self.subTest(max_primary=limit):
                result = routing.select(task, {**CONFIG, 'max_primary': limit}, KNOWN)
                self.assertEqual(len(result['selected']), limit)
                self.assertEqual(result['selected'], baseline['selected'][:limit])
                self.assertEqual(result['metrics']['suggested'], limit)
                self.assertEqual(result['metrics']['candidates'],
                                 len(result['selected']) + len(result['rejected']))
                self.assertTrue(result['requires_staging'])
                self.assertTrue(result['needs_inspection'])
                if limit == 6:
                    self.assertEqual(result, baseline)

    def test_portable_registry_preserves_selection(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'registry.json'
            path.write_text(json.dumps({'version': 1, 'skills': KNOWN}), encoding='utf-8')
            with patch.dict(os.environ, {'GOATLETA_SKILL_REGISTRY': str(path)}):
                portable = routing.registry(CONFIG)
            self.assertEqual(portable, KNOWN)
            self.assertEqual(routing.select('Revisar política RLS', CONFIG, portable),
                             routing.select('Revisar política RLS', CONFIG, KNOWN))

    def test_portable_registry_rejects_invalid_schema(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'registry.json'
            for data in [[], {'version': 1, 'skills': {'fixture': 'all'}}, {'version': 2, 'skills': KNOWN}]:
                path.write_text(json.dumps(data), encoding='utf-8')
                with patch.dict(os.environ, {'GOATLETA_SKILL_REGISTRY': str(path)}), self.assertRaises(ValueError):
                    routing.registry(CONFIG)

    def test_text_field_is_not_cosmetic(self):
        result = routing.select('Adicionar campo texto à ficha do atleta', CONFIG, KNOWN)
        self.assertTrue({'goatleta-security', 'goatleta-database', 'goatleta-data-model'} <= names(result))

    def test_correcting_button_text_remains_cosmetic(self):
        result = routing.select('Corrigir texto do botão de login', CONFIG, KNOWN)
        self.assertEqual(names(result), {'goatleta-design-system', 'goatleta-courtside-ux'})

    def test_multiline_and_extra_whitespace(self):
        task = 'Melhore a tela Aula\n  do\tDia'
        self.assertEqual(names(routing.select(task, CONFIG, KNOWN)),
                         names(routing.select('Melhore a tela Aula do Dia', CONFIG, KNOWN)))

    def test_explicit_auxiliary_cannot_hide_overflow(self):
        aux = [n for n, layer in KNOWN.items() if layer == 'auxiliary'][:6]
        result = routing.select('Corrigir RLS', CONFIG, KNOWN, aux)
        self.assertTrue(result['requires_staging'])
        self.assertTrue(result['needs_inspection'])
        self.assertIn('goatleta-security', {s['name'] for s in result['rejected']})

    def test_corrupt_metrics_fail_without_leaking_or_rewriting(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'events.jsonl'
            for content in ['private-fixture-value', '{"version": 1, "used": "secret"}',
                            '{"version": 1, "used": [], "local_used": -1, "external_used": 1}']:
                path.write_text(content, encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'linha 1') as caught:
                    routing.metrics(path)
                self.assertNotIn(content, str(caught.exception))
                self.assertEqual(path.read_text(encoding='utf-8'), content)

    def test_cli_json_is_read_only_and_utf8(self):
        before = routing.LOG.read_bytes() if routing.LOG.exists() else None
        run = subprocess.run([sys.executable, str(routing.ROOT / 'scripts/explain-skill-selection.py'),
                              'Corrigir texto do botão de login', '--json'],
                             capture_output=True, encoding='utf-8')
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(json.loads(run.stdout)['task'], 'Corrigir texto do botão de login')
        after = routing.LOG.read_bytes() if routing.LOG.exists() else None
        self.assertEqual(before, after)

    def test_cli_rejects_unknown_area(self):
        run = subprocess.run([sys.executable, str(routing.ROOT / 'scripts/explain-skill-selection.py'),
                              'Investigar', '--area', 'not-a-real-area'], capture_output=True)
        self.assertEqual(run.returncode, 2)

    def test_scenario_matrix(self):
        scenarios = [
            ('Revisar política RLS', {'goatleta-security', 'goatleta-database'}),
            ('Criar migration para tabela', {'goatleta-data-model', 'supabase:supabase'}),
            ('Corrigir permissões de professor', {'goatleta-security'}),
            ('Trocar espaçamento da tela Aula do Dia', {'goatleta-design-system'}),
            ('Ajustar rótulo do botão de convite', {'goatleta-design-system'}),
            ('Alterar planejamento anual', {'goatleta-periodization'}),
            ('Corrigir rotação no voleibol', {'goatleta-volleyball-domain'}),
            ('Diagnosticar FPS no Android', {'react-native-best-practices', 'expo'}),
            ('Refatorar API de componentes', {'goatleta-architecture', 'vercel-composition-patterns'}),
            ('Investigar GitHub Actions', {'gh-fix-ci'}),
            ('Responder comentários do PR', {'gh-address-comments'}),
            ('Testar fluxo web no navegador', {'playwright-cli'}),
            ('Reconciliar documento pedagógico', {'goatleta-document-intelligence'}),
            ('Acessibilidade da interface', {'goatleta-courtside-ux'}),
            ('Corrigir bug na autenticação', {'goatleta-security', 'goatleta-testing'}),
            ('Adicione um novo campo na ficha do atleta', {'goatleta-data-model', 'goatleta-security'}),
        ]
        for task, expected in scenarios:
            with self.subTest(task=task):
                result = routing.select(task, CONFIG, KNOWN)
                self.assertTrue(expected <= names(result), result)
                self.assertLessEqual(len(result['selected']), 6)

    def test_workspace_scouting_preserves_security_and_domain(self):
        result = routing.select('Corrigir isolamento de workspace no scouting', CONFIG, KNOWN)
        self.assertTrue({'goatleta-security', 'goatleta-data-model', 'goatleta-testing',
                         'goatleta-volleyball-domain', 'supabase:supabase'} <= names(result))

    def test_invitation_web_has_browser_and_backend(self):
        result = routing.select('Corrija falha em convite de professor no fluxo web', CONFIG, KNOWN)
        self.assertTrue({'goatleta-security', 'goatleta-database', 'playwright-cli'} <= names(result))

    def test_cosmetic_login_does_not_load_authorization(self):
        result = routing.select('Troque apenas a cor do botão na tela de login', CONFIG, KNOWN)
        self.assertEqual(names(result), {'goatleta-design-system', 'goatleta-courtside-ux'})

    def test_cosmetic_and_functional_not_reduced_to_cosmetic(self):
        result = routing.select('Troque a cor e corrija convite de professor', CONFIG, KNOWN)
        self.assertIn('goatleta-security', names(result))

    def test_new_athlete_field_has_persistence(self):
        result = routing.select('Adicione um novo campo na ficha do atleta', CONFIG, KNOWN)
        self.assertTrue({'goatleta-architecture', 'goatleta-data-model', 'goatleta-database',
                         'goatleta-security'} <= names(result))

    def test_lesson_ui_keeps_domain_and_design(self):
        result = routing.select('Melhore a tela Aula do Dia', CONFIG, KNOWN)
        self.assertTrue({'goatleta-periodization', 'goatleta-design-system'} <= names(result))

    def test_bound_and_explanation(self):
        result = routing.select('Nova tela de scouting com RLS no Expo e fluxo web', CONFIG, KNOWN)
        self.assertLessEqual(len(result['selected']), 6)
        self.assertTrue(result['rejected'])
        self.assertEqual(result['metrics']['candidates'], len(result['selected']) + len(result['rejected']))
        self.assertIn('goatleta-security', names(result))

    def test_no_vague_affinity_or_substring_match(self):
        result = routing.select('Investigue a decoração', CONFIG, KNOWN)
        self.assertEqual(names(result), set())
        self.assertTrue(result['needs_inspection'])

    def test_explicit_auxiliary_and_invalid_name(self):
        result = routing.select('Avaliar parser', CONFIG, KNOWN, ['property-based-testing'])
        self.assertEqual(names(result), {'property-based-testing'})
        with self.assertRaises(ValueError):
            routing.select('Avaliar parser', CONFIG, KNOWN, ['nonexistent-skill'])

    def test_confirmed_area_can_override_short_prompt(self):
        result = routing.select('Investigar rotina', CONFIG, KNOWN, areas=['authorization'])
        self.assertIn('goatleta-security', names(result))

    def test_more_than_six_explicit_requires_split(self):
        with self.assertRaises(ValueError):
            routing.select('Tarefa ampla', CONFIG, KNOWN, CONFIG['core'][:7])

    def test_actual_use_and_privacy(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'events.jsonl'
            self.assertEqual(routing.metrics(path)['recorded_tasks'], 0)
            result = routing.select('Corrigir convite privado do atleta fictício', CONFIG, KNOWN)
            self.assertFalse(path.exists())
            routing.record(result, ['goatleta-security', 'supabase:supabase'], KNOWN, path)
            event = json.loads(path.read_text(encoding='utf-8'))
            self.assertNotIn('task', event)
            self.assertNotIn('fictício', path.read_text(encoding='utf-8'))
            self.assertEqual(event['local_used'], 1)
            self.assertEqual(event['external_used'], 1)
            self.assertEqual(routing.metrics(path)['recorded_tasks'], 1)
            with self.assertRaises(ValueError):
                routing.record(result, ['unknown'], KNOWN, path)
            self.assertEqual(routing.metrics(path)['recorded_tasks'], 1)

    def test_rules_reference_real_registry_names(self):
        for rule in CONFIG['rules']:
            self.assertTrue(set(rule['skills']) <= KNOWN.keys())


if __name__ == '__main__':
    unittest.main()
