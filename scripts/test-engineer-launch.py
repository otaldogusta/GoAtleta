"""Launch-pack tests: offline fixtures only, no real agent or budget confirmation."""
from datetime import datetime, timezone, timedelta
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
import engineer_launch as launch
import engineer_coordination as coordination
spec = importlib.util.spec_from_file_location('engineer_fixture', Path(__file__).with_name('goatleta-engineer.py'))
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)


class LaunchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        folder = self.root / 'docs/operations/engineer'
        folder.mkdir(parents=True)
        for role in launch.NAMES:
            shutil.copyfile(e.ROOT / 'docs/operations/engineer' / (role + '.md'), folder / (role + '.md'))
        self.config = {'version': 1, 'project_id': 'proj_fixture', 'project_name': 'Go Atleta Engineer',
                       'agents': {r: {'id': None, 'profile_sha256': None} for r in launch.NAMES}}
        self.path = folder / 'agents.json'
        e.save(self.path, self.config)
        self.ctx = SimpleNamespace(ROOT=self.root, checked_bytes=e.checked_bytes, digest=e.digest, save=e.save,
                                   api=Mock(side_effect=AssertionError('Unexpected network')))

    def registered(self):
        for role in launch.NAMES:
            _, sha = launch.definition(self.ctx, role, 'fixture-model')
            self.config['agents'][role] = {'id': 'agent_' + role.replace('-', '_'), 'profile_sha256': sha}
        e.save(self.path, self.config)
        return launch.binding(self.ctx)

    def consent(self, **overrides):
        record = {'project_id': 'proj_fixture', 'hard_limit_usd': 10,
                  'hard_limit_confirmed': True, 'overshoot_accepted': True,
                  'auto_reload_off_confirmed': True, 'source': 'human_manual_check_not_api_verified',
                  'confirmed_at': datetime.now(timezone.utc).isoformat(), **overrides}
        p = self.root / '.tmp/engineer-platform-budget.json'
        p.parent.mkdir(exist_ok=True)
        e.save(p, record)

    def platform_manifest(self):
        return {'agent_registry': self.registered(), 'financial_policy': {
            'budget_mode': 'platform-hard-limit', 'project_hard_limit_usd': 10}}

    def test_definitions_from_versioned_profiles_no_tools_or_keys(self):
        for role in launch.NAMES:
            d, sha = launch.definition(self.ctx, role, 'fixture-model')
            self.assertEqual(e.digest(d['instructions'].encode()), sha)
            self.assertFalse(d['multi_agent']['enabled'])
            self.assertNotIn('api_key', d)

    def test_dry_registration_never_connects(self):
        self.assertEqual(launch.manage(self.ctx, 'coordinator', 'fixture')['state'], 'DRY_RUN')
        self.ctx.api.assert_not_called()

    def test_invalid_and_duplicate_agent_ids(self):
        for value in ['sess_wrong', '../agent_bad', 'agent_x?query=1']:
            self.config['agents']['coordinator'] = {'id': value, 'profile_sha256': 'a' * 64}
            e.save(self.path, self.config)
            with self.assertRaises(ValueError): launch.registry(self.ctx)
        self.registered()
        self.config['agents']['implementation'] = self.config['agents']['coordinator']
        e.save(self.path, self.config)
        with self.assertRaises(ValueError): launch.registry(self.ctx)

    def test_extra_secret_field_rejected(self):
        self.config['api_key'] = 'fixture-not-real'
        e.save(self.path, self.config)
        with self.assertRaises(ValueError): launch.registry(self.ctx)

    def test_profile_change_invalidates_binding(self):
        self.registered()
        (self.path.parent / 'coordinator.md').write_text('changed')
        with self.assertRaises(ValueError): launch.binding(self.ctx)

    def test_register_existing_mismatch_no_local_mutation(self):
        before = self.path.read_bytes()
        self.ctx.api.side_effect = None
        self.ctx.api.return_value = {'id': 'agent_fixture', 'instructions': 'different', 'model': 'fixture'}
        with self.assertRaises(ValueError): launch.manage(self.ctx, 'coordinator', 'fixture', 'agent_fixture', True)
        self.assertEqual(before, self.path.read_bytes())

    def test_live_create_passes_project_and_cannot_repeat(self):
        self.ctx.api.side_effect = None
        self.ctx.api.return_value = {'id': 'agent_fixture'}
        result = launch.manage(self.ctx, 'coordinator', 'fixture', live=True)
        self.assertEqual(result['agent_id'], 'agent_fixture')
        self.assertEqual(self.ctx.api.call_args.kwargs['project_id'], 'proj_fixture')
        with self.assertRaises(ValueError): launch.manage(self.ctx, 'coordinator', 'fixture', live=True)
        self.assertEqual(self.ctx.api.call_count, 1)

    def test_ambiguous_create_marker_prevents_retry(self):
        self.ctx.api.side_effect = ValueError('Ambiguous')
        with self.assertRaises(ValueError): launch.manage(self.ctx, 'coordinator', 'fixture', live=True)
        with self.assertRaises(FileExistsError): launch.manage(self.ctx, 'coordinator', 'fixture', live=True)
        self.assertEqual(self.ctx.api.call_count, 1)

    def test_missing_project_blocks_registration(self):
        self.config['project_id'] = None
        e.save(self.path, self.config)
        with self.assertRaises(ValueError): launch.manage(self.ctx, 'coordinator', 'fixture', live=True)
        self.ctx.api.assert_not_called()

    def test_strict_cannot_be_switched_at_create(self):
        m = {'financial_policy': {'budget_mode': 'strict', 'max_cost_usd': 5}}
        for mode in [None, 'strict', 'platform-hard-limit']:
            with self.assertRaisesRegex(ValueError, 'BUDGET_GATE'): launch.budget_gate(self.ctx, m, mode)
        self.ctx.api.assert_not_called()

    def test_platform_missing_or_unaccepted_confirmation(self):
        m = self.platform_manifest()
        with self.assertRaises(ValueError): launch.budget_gate(self.ctx, m)
        for changes in [{'overshoot_accepted': False}, {'project_id': 'proj_other'},
                        {'hard_limit_usd': 20}, {'hard_limit_usd': True},
                        {'auto_reload_off_confirmed': False}, {'source': 'model_claim'},
                        {'confirmed_at': (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()}]:
            self.consent(**changes)
            with self.assertRaises(ValueError): launch.budget_gate(self.ctx, m)

    def test_valid_manual_platform_consent_is_labeled_manual(self):
        m = self.platform_manifest()
        self.consent()
        self.assertEqual(launch.budget_gate(self.ctx, m)['source'], 'human_manual_check_not_api_verified')

    def test_noninteractive_cannot_confirm_platform_budget(self):
        with patch.object(sys.stdin, 'isatty', return_value=False), self.assertRaises(ValueError):
            launch.confirm_budget(self.ctx, 10)

    def test_readiness_compares_registered_crlf_payload_exactly(self):
        for role in launch.NAMES:
            (self.root / 'docs/operations/engineer' / (role + '.md')).write_bytes(b'# Profile\r\nRead only.\r\n')
        self.registered()
        self.ctx.api.side_effect = lambda method, suffix, *args, **kwargs: {
            'id': suffix.lstrip('/'), 'instructions': '# Profile\r\nRead only.\r\n'}
        rt = SimpleNamespace(docker=Mock(return_value=json.dumps([{'Endpoints': {'docker': {'Host': 'npipe://local'}}}])))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}):
            report = launch.readiness(self.ctx, rt)
        self.assertEqual(report['checks']['agents_read'], 'PASS')
        self.ctx.api.side_effect = lambda *args, **kwargs: {'id': 'agent_coordinator', 'instructions': 'Changed'}
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}):
            report = launch.readiness(self.ctx, rt)
        self.assertEqual(report['agents']['coordinator'], 'MISMATCH')

    def test_readiness_offline_never_invents_finance_or_write_permissions(self):
        rt = SimpleNamespace(docker=Mock(return_value=json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///fixture'}}}])))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture', 'OPENAI_EXECUTOR_API_KEY': 'fixture'}):
            report = launch.readiness(self.ctx, rt, offline=True)
        self.assertEqual(report['checks']['application_key'], 'PRESENT')
        for key in ['hard_spend_limit', 'prepaid_balance', 'auto_reload', 'agents_write', 'responses_write']:
            self.assertEqual(report['checks'][key], 'MANUAL_CHECK_REQUIRED')
        self.assertFalse(report['session_created'])
        self.ctx.api.assert_not_called()

    def test_missing_saved_agent_blocks_before_network(self):
        with self.assertRaisesRegex(ValueError, 'PERSISTENT_AGENTS_BLOCKED'):
            launch.check_saved(self.ctx, {'agent_registry': self.config}, 'fixture')
        self.ctx.api.assert_not_called()

    def test_remote_definition_mismatch_blocks_saved_session(self):
        registered = self.registered()
        self.ctx.api.side_effect = None
        self.ctx.api.return_value = {'id': registered['agents']['coordinator']['id'], 'instructions': 'tampered', 'model': 'fixture-model'}
        with self.assertRaises(ValueError):
            launch.check_saved(self.ctx, {'agent_registry': registered}, 'fixture-model')

    def history(self, with_child=True):
        turns = [{'id': 'turn_root', 'status': 'completed', 'subagent_id': None}]
        items = [{'id': 'answer_root', 'turn_id': 'turn_root', 'role': 'assistant', 'phase': 'final_answer', 'content': [{'type': 'output_text', 'text': 'Fixture analysis'}]}]
        if with_child:
            turns += [{'id': 'turn_child', 'status': 'completed', 'subagent_id': 'sub_child'}]
            items += [{'id': 'spawn', 'type': 'create_subagent_call', 'turn_id': 'turn_root', 'status': 'completed', 'agent_id': 'requester'},
                      {'id': 'wait', 'type': 'wait_for_subagents_call', 'turn_id': 'turn_root', 'status': 'completed', 'recipient_agent_ids': ['sub_child']},
                      {'id': 'cmd', 'type': 'command_execution', 'turn_id': 'turn_child', 'exit_code': 0},
                      {'id': 'answer_child', 'turn_id': 'turn_child', 'role': 'assistant', 'phase': 'final_answer', 'content': [{'type': 'output_text', 'text': 'Fixture analysis'}]}]
        h = {'turns': turns, 'items': items}
        e.save(self.root / 'history.json', h)
        return h

    def test_good_solo_answer_fails_delegation(self):
        r = coordination.evaluate(self.root, {'subagents_limit': 1}, self.history(False), self.ctx)
        self.assertEqual(r['state'], 'FAIL_MULTI_AGENT')

    def test_completed_spawn_does_not_prove_child_execution(self):
        h = self.history()
        h['turns'][1]['status'] = 'in_progress'
        self.assertEqual(coordination.evaluate(self.root, {'subagents_limit': 1}, h, self.ctx)['state'], 'FAIL_MULTI_AGENT')

    def test_empty_wait_target_is_reported_but_never_approved(self):
        h = self.history()
        next(i for i in h['items'] if i['id'] == 'wait')['recipient_agent_ids'] = []
        r = coordination.evaluate(self.root, {'subagents_limit': 1}, h, self.ctx)
        self.assertEqual(r['state'], 'FAIL_MULTI_AGENT')
        self.assertEqual(r['evidence']['observed_wait_item_ids'], ['wait'])
        self.assertEqual(r['evidence']['unattributed_wait_item_ids'], ['wait'])
        self.assertEqual(r['blocking_reasons'], ['WAIT_TARGET_NOT_PROVEN'])
        self.assertFalse(r['checks']['waited'])

    def test_structural_evidence_does_not_auto_approve_incorporation(self):
        r = coordination.evaluate(self.root, {'subagents_limit': 1}, self.history(), self.ctx)
        self.assertEqual(r['state'], 'PENDING_INCORPORATION_REVIEW')
        self.assertIsNone(r['checks']['incorporated'])

    def test_incorporation_review_requires_real_item_ids_and_matching_history(self):
        h = self.history()
        record = {'history_sha256': e.digest((self.root / 'history.json').read_bytes()),
                  'root_item_id': 'answer_root', 'specialist_item_id': 'answer_child',
                  'rationale': 'Fixture comparison', 'incorporated': True}
        e.save(self.root / 'coordination-review.json', record)
        self.assertEqual(coordination.evaluate(self.root, {'subagents_limit': 1}, h, self.ctx)['state'], 'PASS_MULTI_AGENT_REVIEWED')
        record['history_sha256'] = 'stale'
        e.save(self.root / 'coordination-review.json', record)
        self.assertEqual(coordination.evaluate(self.root, {'subagents_limit': 1}, h, self.ctx)['state'], 'PENDING_INCORPORATION_REVIEW')


if __name__ == '__main__':
    unittest.main()
