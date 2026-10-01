"""Negative-path gate, budget, trace and dataset tests. No network or real approval."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.dont_write_bytecode = True
import engineer_budget as budget
import engineer_review as review
import engineer_runtime as runtime
import engineer_benchmark as benchmark

spec = importlib.util.spec_from_file_location('engineer', Path(__file__).with_name('goatleta-engineer.py'))
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)


class ControlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def candidate(self):
        p = 'scripts/explain-skill-selection.py'
        run = e.prepare('fixture', 'fixture', [], ['goatleta-testing'], runs=self.root / 'runs',
                        profile='router', allow_write=[p])
        runtime.stage(run, e)
        with (run / 'runtime/workspace' / p).open('ab') as stream:
            stream.write(b'\n# fixture candidate\n')
        e.save(run / 'container.json', {'state': 'removed'})
        e.save(run / 'history.json', {'turns': [{'id': 'turn_fixture', 'status': 'completed'}], 'items': []})
        e.save(run / 'preflight.json', {'state': 'READY', 'image': 'sha256:' + 'a' * 64,
               'manifest_sha256': e.digest((run / 'manifest.json').read_bytes())})
        target = self.root / 'checkout' / p
        target.parent.mkdir(parents=True)
        target.write_bytes((run / 'bundle/workspace' / p).read_bytes())
        return run, target

    def validation(self, run):
        def docker(args):
            if args[:2] == ['context', 'inspect']:
                return json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///fixture'}}}])
            self.assertIn('--network=none', args)
            self.assertNotIn('CODEX_API_KEY', args)
            self.assertTrue(all('readonly' in a for a in args if a.startswith('type=bind')))
            return json.dumps({'state': 'READY', 'validation': [
                {'command': cmd, 'exit_code': 0} for cmd in e.verify(run)['requirements']['validation_commands']]})
        with patch.object(runtime, 'docker', side_effect=docker):
            return review.validate_candidate(run, e, runtime)

    def fixture_approval(self, run):
        request = review.review(run, e, runtime)
        e.save(run / 'human-decision.json', {'state': 'APPROVED', 'fingerprint': request['fingerprint']})

    def test_no_approval_no_checkout_write(self):
        run, target = self.candidate()
        self.validation(run)
        before = target.read_bytes()
        with self.assertRaisesRegex(ValueError, 'WAITING_FOR_HUMAN'):
            review.integrate(run, e, runtime, self.root / 'checkout')
        self.assertEqual(before, target.read_bytes())
        self.assertFalse((run / 'integration-attempt.json').exists())

    def test_noninteractive_cannot_approve(self):
        with patch.object(sys.stdin, 'isatty', return_value=False), self.assertRaises(ValueError):
            review.decide(self.root, e, runtime)

    def test_test_failure_blocks_review(self):
        run, _ = self.candidate()
        proof = review.evidence(run, e, runtime)
        e.save(run / 'candidate-validation.json', {'evidence': proof, 'result': {'state': 'BLOCKED_RUNTIME'}})
        with self.assertRaisesRegex(ValueError, 'REVIEW_BLOCKED'):
            review.review(run, e, runtime)

    def test_tamper_invalidates_tests_and_approval(self):
        run, _ = self.candidate()
        self.validation(run)
        self.fixture_approval(run)
        with (run / 'runtime/workspace/scripts/explain-skill-selection.py').open('ab') as f:
            f.write(b'# another change\n')
        with self.assertRaisesRegex(ValueError, 'REVIEW_BLOCKED'):
            review.integrate(run, e, runtime, self.root / 'checkout')

    def test_revalidation_still_invalidates_old_approval(self):
        run, _ = self.candidate()
        self.validation(run)
        self.fixture_approval(run)
        with (run / 'runtime/workspace/scripts/explain-skill-selection.py').open('ab') as f:
            f.write(b'# another change\n')
        self.validation(run)
        with self.assertRaisesRegex(ValueError, 'WAITING_FOR_HUMAN'):
            review.integrate(run, e, runtime, self.root / 'checkout')

    def test_unexpected_file_blocks_gate(self):
        run, _ = self.candidate()
        (run / 'runtime/workspace/unexpected.txt').write_text('bad')
        with self.assertRaisesRegex(ValueError, 'REVIEW_BLOCKED'):
            review.evidence(run, e, runtime)

    def test_running_container_blocks_gate(self):
        run, _ = self.candidate()
        e.save(run / 'container.json', {'state': 'running'})
        with self.assertRaisesRegex(ValueError, 'teardown'):
            review.evidence(run, e, runtime)

    def test_changed_local_baseline_preserved(self):
        run, target = self.candidate()
        self.validation(run)
        self.fixture_approval(run)
        target.write_text('concurrent user work')
        with self.assertRaisesRegex(ValueError, 'BASELINE_CHANGED'):
            review.integrate(run, e, runtime, self.root / 'checkout')
        self.assertEqual(target.read_text(), 'concurrent user work')

    def test_fixture_approval_integrates_once_and_keeps_backup(self):
        run, target = self.candidate()
        before = target.read_bytes()
        self.validation(run)
        self.fixture_approval(run)
        result = review.integrate(run, e, runtime, self.root / 'checkout')
        self.assertEqual(result['state'], 'INTEGRATED')
        self.assertEqual(target.read_bytes(), (run / 'runtime/workspace/scripts/explain-skill-selection.py').read_bytes())
        self.assertEqual(before, (run / 'integration-backup/scripts/explain-skill-selection.py').read_bytes())
        with self.assertRaises(ValueError):
            review.integrate(run, e, runtime, self.root / 'checkout')

    def test_rejection_never_integrates(self):
        run, _ = self.candidate()
        self.validation(run)
        request = review.review(run, e, runtime)
        e.save(run / 'human-decision.json', {'state': 'REJECTED', 'fingerprint': request['fingerprint']})
        with self.assertRaisesRegex(ValueError, 'WAITING_FOR_HUMAN'):
            review.integrate(run, e, runtime, self.root / 'checkout')

    def test_budget_blocks_integration_even_with_pass(self):
        run, _ = self.candidate()
        e.save(run / 'budget-result.json', {'state': 'BUDGET_GATE'})
        with self.assertRaisesRegex(ValueError, 'BUDGET_GATE'):
            review.evidence(run, e, runtime)

    def test_budget_exact_boundary_and_excess(self):
        p = {**budget.DEFAULT, 'max_tokens_per_turn': 10}
        result = budget.evaluate(p, {'turns': [{'status': 'completed', 'usage': {'total_tokens': 10}}]})
        self.assertEqual(result['state'], 'WITHIN_OBSERVED_LIMITS')
        result = budget.evaluate(p, {'turns': [{'status': 'completed', 'usage': {'total_tokens': 11}}]})
        self.assertEqual(result['violations'], ['tokens_per_turn'])

    def test_session_usage_does_not_double_count_child_turn(self):
        h = {'turns': [{'status': 'completed', 'usage': {'total_tokens': 715514}},
                       {'status': 'completed', 'subagent_id': 'child', 'usage': {'total_tokens': 264689}}]}
        r = budget.evaluate(budget.DEFAULT, h, session_usage={'total_tokens': 715514})
        self.assertEqual(r['observed']['total_tokens'], 715514)
        self.assertEqual(r['total_tokens_source'], 'session_aggregate')
        self.assertEqual(r['state'], 'BUDGET_GATE')
        for invalid in [None, {'total_tokens': True}, {'total_tokens': -1}]:
            self.assertEqual(budget.evaluate(budget.DEFAULT, h, session_usage=invalid)['observed']['total_tokens'], 980203)
        inconsistent = budget.evaluate(budget.DEFAULT, h, session_usage={'total_tokens': 100})
        self.assertEqual(inconsistent['observed']['total_tokens'], 715514)
        self.assertEqual(inconsistent['total_tokens_source'], 'max_reported_turn_session_usage_inconsistent')

    def test_missing_usage_not_zero_or_financial_estimate(self):
        result = budget.evaluate(budget.DEFAULT, {'turns': [{'status': 'completed'}]})
        self.assertIsNone(result['observed']['total_tokens'])
        self.assertFalse(result['usage_complete'])
        self.assertIsNone(result['financial_cost_usd'])

    def test_budget_invalid_bool_and_too_many_specialists(self):
        for p, n in [({**budget.DEFAULT, 'max_commands': True}, 0), (budget.DEFAULT, 2)]:
            with self.assertRaisesRegex(ValueError, 'BUDGET_GATE'):
                budget.validate(p, n)

    def test_trace_export_pages_and_otlp(self):
        run, _ = self.candidate()
        e.save(run / 'session.json', {'id': 'sess_fixture'})
        responses = [{'data': [{'id': 'tr_1', 'otlp': {'resourceSpans': [{'fixture': 1}]}}],
                      'has_more': True, 'last_id': 'tr_1'}, {'data': [], 'has_more': False}]
        with patch.object(e, 'api', side_effect=responses) as api:
            self.assertEqual(runtime.traces(run, e)['state'], 'EXPORTED')
            self.assertIn('after=tr_1', api.call_args.args[1])
        self.assertEqual(json.loads((run / 'traces.otlp.json').read_text())['resourceSpans'], [{'fixture': 1}])

    def test_trace_denial_does_not_expand_permissions(self):
        run, _ = self.candidate()
        e.save(run / 'session.json', {'id': 'sess_fixture'})
        with patch.object(e, 'api', side_effect=ValueError('HTTP 403')):
            self.assertEqual(runtime.traces(run, e)['state'], 'UNAVAILABLE')

    def test_benchmark_without_human_grades_is_unscored(self):
        result = benchmark.score({'id': 'fixture', 'base_commit': 'abc'}, {'tests_count': 50, 'base_commit': 'abc'})
        self.assertEqual(result['state'], 'UNSCORED')
        self.assertIsNone(result['grades']['diff_quality'])

    def test_benchmark_wrong_baseline_rejected(self):
        with self.assertRaises(ValueError):
            benchmark.score({'id': 'fixture', 'base_commit': 'abc'}, {'base_commit': 'current'})

    def test_strict_dollar_cap_blocks_before_network(self):
        run = e.prepare('fixture', 'fixture', [], ['goatleta-testing'], runs=self.root,
                        profile='router', max_cost_usd=5)
        with patch.object(e, 'api') as api, self.assertRaisesRegex(ValueError, 'BUDGET_GATE'):
            e.create(run, True)
        api.assert_not_called()
        self.assertFalse((run / 'create-attempt.json').exists())

    def test_ready_without_validation_commands_fails(self):
        run, _ = self.candidate()
        values = [json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///fixture'}}}]),
                  json.dumps({'state': 'READY', 'validation': []})]
        with patch.object(runtime, 'docker', side_effect=values):
            self.assertEqual(review.validate_candidate(run, e, runtime)['state'], 'TESTS_FAIL')

    def test_command_and_specialist_limits(self):
        history = {'turns': [{'subagent_id': 'a'}, {'subagent_id': 'b'}],
                   'items': [{'type': 'command_execution'}] * 41}
        result = budget.evaluate(budget.DEFAULT, history)
        self.assertEqual(set(result['violations']), {'commands', 'subagents'})

    def test_reconcile_budget_breach_cancels_and_removes(self):
        run, _ = self.candidate()
        e.save(run / 'session.json', {'id': 'sess_fixture'})
        history = [{'id': 'turn_fixture', 'status': 'in_progress', 'usage': {'total_tokens': 600000}}]
        with patch.object(e, 'remote', return_value={'session_id': 'sess_fixture'}) as remote, \
             patch.object(runtime, 'pages', side_effect=[history, []]), \
             patch.object(runtime, 'teardown', return_value={'state': 'removed'}) as teardown:
            result = runtime.reconcile(run, e)
            self.assertEqual(result['budget'], 'BUDGET_GATE')
            remote.assert_any_call(run, 'cancel')
            teardown.assert_called_once_with(run, e, live=True)


if __name__ == '__main__':
    unittest.main()
