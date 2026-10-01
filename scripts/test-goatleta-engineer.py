"""Offline lifecycle and isolation tests. Never connects to OpenAI."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('engineer', Path(__file__).with_name('goatleta-engineer.py'))
engineer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engineer)
runtime_spec = importlib.util.spec_from_file_location('runtime', Path(__file__).with_name('engineer_runtime.py'))
runtime = importlib.util.module_from_spec(runtime_spec)
runtime_spec.loader.exec_module(runtime)


class EngineerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def prepared(self):
        run = engineer.prepare('Revisar o roteador sem editar', 'fixture-model',
                               ['scripts/explain-skill-selection.py'], ['goatleta-testing'], runs=self.base)
        engineer.save(run / 'preflight.json', {'state': 'READY', 'image': 'sha256:' + 'a' * 64,
                      'manifest_sha256': engineer.digest((run / 'manifest.json').read_bytes())})
        return run

    def test_bundle_verifies_and_contains_only_selected_project_skill(self):
        run = self.prepared()
        result = engineer.verify(run)
        self.assertEqual(result['skills'], ['goatleta-testing'])
        self.assertFalse(any('.env' in n or '.git/' in n for n in result['files']))
        self.assertIn('workspace/scripts/explain-skill-selection.py', result['files'])

    def test_dry_run_never_calls_api(self):
        run = self.prepared()
        with patch.object(engineer, 'api', side_effect=AssertionError('network')):
            self.assertEqual(engineer.create(run)['state'], 'dry_run')
        self.assertFalse((run / 'create-attempt.json').exists())

    def test_missing_preflight_blocks_before_api_and_attempt(self):
        run = self.prepared()
        (run / 'preflight.json').unlink()
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer, 'api') as api:
            with self.assertRaisesRegex(ValueError, 'BLOCKED_RUNTIME'):
                engineer.create(run, True)
            api.assert_not_called()
        self.assertFalse((run / 'create-attempt.json').exists())

    def test_changed_image_blocks_provision(self):
        run = self.prepared()
        with patch.object(runtime, 'docker') as docker:
            with self.assertRaisesRegex(ValueError, 'BLOCKED_RUNTIME'):
                runtime.provision(run, engineer, 'sha256:' + 'b' * 64, True)
            docker.assert_not_called()

    def test_execution_copy_changed_after_preflight_blocks_api(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        (run / 'runtime/workspace/AGENTS.md').write_text('changed')
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer, 'api') as api:
            with self.assertRaises(ValueError):
                engineer.create(run, True)
            api.assert_not_called()

    def test_report_requires_command_evidence_for_skill_reads_and_tests(self):
        run = self.prepared()
        skill = (run / 'bundle/capabilities/goatleta-testing/SKILL.md').read_text(encoding='utf-8-sig')
        engineer.save(run / 'history.json', {'turns': [], 'items': [
            {'id': 'pending_output', 'type': 'command_execution', 'exit_code': 0, 'command': None, 'output': None},
            {'id': 'read_skill', 'type': 'command_execution', 'exit_code': 0,
             'command': 'cat /capabilities/goatleta-testing/SKILL.md', 'output': skill},
            {'id': 'run_tests', 'type': 'command_execution', 'exit_code': 0,
             'command': 'python -B scripts/test-skill-selection.py', 'output': '...\nRan 23 tests in 0.5s\n\nOK\n'}]})
        result = runtime.report(run, engineer)
        self.assertEqual(result['skills_opened'], ['goatleta-testing'])
        self.assertEqual(result['tests_count'], 23)
        self.assertEqual(result['test_runs'][0]['item_id'], 'run_tests')

    def test_router_profile_has_explicit_dependencies_without_catalog_bodies(self):
        run = engineer.prepare('Revisar', 'fixture', [], ['goatleta-testing'], runs=self.base, profile='router')
        manifest = engineer.verify(run)
        self.assertIn('workspace/runtime/skill-registry.json', manifest['files'])
        self.assertIn('workspace/docs/operations/skill-routing.json', manifest['files'])
        self.assertNotIn('workspace/docs/operations/skills-package.lock.json', manifest['files'])
        self.assertEqual(len(manifest['requirements']['validation_commands']), 2)

    def test_tampered_bundle_blocks_create(self):
        run = self.prepared()
        (run / 'bundle/workspace/AGENTS.md').write_text('changed')
        with patch.object(engineer, 'api', side_effect=AssertionError('network')):
            with self.assertRaises(ValueError):
                engineer.create(run, True)

    def test_modified_request_blocks_create(self):
        run = self.prepared()
        (run / 'request.json').write_text('{}')
        with self.assertRaises(ValueError):
            engineer.verify(run)

    def test_extra_file_detected(self):
        run = self.prepared()
        (run / 'bundle/extra.txt').write_text('fixture')
        with self.assertRaises(ValueError):
            engineer.verify(run)

    def test_path_and_hidden_files_rejected(self):
        for name in ['../other', '.env.local', '.git/config', 'C:/private/key', 'node_modules/pkg/index.js']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                engineer.source(engineer.ROOT, name)

    def test_credential_detection(self):
        path = self.base / 'example.txt'
        path.write_text('sk-proj-' + 'A' * 30)
        with self.assertRaises(ValueError):
            engineer.checked_bytes(path)

    def test_limit_on_skills_and_missing_selection(self):
        for skills in [[], ['goatleta-testing'] + ['goatleta-fake-' + str(n) for n in range(6)]]:
            with self.assertRaises(ValueError):
                engineer.prepare('Tarefa sem classificação', 'fixture', [], skills, runs=self.base)

    def test_external_skill_not_exported_implicitly(self):
        with self.assertRaises(ValueError):
            engineer.prepare('Revisar', 'fixture', [], ['gh-fix-ci'], runs=self.base)

    def test_missing_key_does_not_create_attempt_or_network(self):
        run = self.prepared()
        with patch.dict(os.environ, {}, clear=True), patch.object(engineer, 'api') as api:
            with self.assertRaises(ValueError):
                engineer.create(run, True)
            api.assert_not_called()
        self.assertFalse((run / 'create-attempt.json').exists())

    def test_create_and_duplicate_protection(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer, 'api', return_value={'id': 'sess_fixture'}) as api:
            self.assertEqual(engineer.create(run, True)['state'], 'created_executor_not_started')
            with self.assertRaises(FileExistsError):
                engineer.create(run, True)
            self.assertEqual(api.call_count, 1)

    def test_ambiguous_create_outcome_is_not_retried(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer, 'api', side_effect=ValueError('transport')) as api:
            with self.assertRaises(ValueError):
                engineer.create(run, True)
            with self.assertRaises(FileExistsError):
                engineer.create(run, True)
            self.assertEqual(api.call_count, 1)

    def test_cancel_is_request_not_confirmation(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'id': 'sess_fixture'})
        with patch.object(engineer, 'api', return_value={}):
            self.assertEqual(engineer.remote(run, 'cancel')['state'], 'cancel_requested_not_confirmed')

    def test_session_id_cannot_change_request_destination(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'id': '../other'})
        with patch.object(engineer, 'api') as api:
            with self.assertRaises(ValueError):
                engineer.remote(run, 'status')
            api.assert_not_called()

    def test_redirect_is_rejected(self):
        with self.assertRaises(ValueError):
            engineer.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.invalid')

    def test_api_contract_uses_fixed_host_and_beta_header(self):
        opener = MagicMock()
        opener.open.return_value = io.BytesIO(b'{"id":"sess_fixture"}')
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer.urllib.request, 'build_opener', return_value=opener):
            result = engineer.api('POST', payload={'input': 'fixture'})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.openai.com/v1/agents/sessions')
        self.assertEqual(request.get_header('Openai-beta'), 'agents=v1')
        self.assertEqual(json.loads(request.data), {'input': 'fixture'})
        self.assertEqual(result['id'], 'sess_fixture')

    def test_empty_event_ack_is_not_an_empty_session_success(self):
        opener = MagicMock()
        opener.open.side_effect = [io.BytesIO(b''), io.BytesIO(b'')]
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}), patch.object(engineer.urllib.request, 'build_opener', return_value=opener):
            self.assertEqual(engineer.api('POST', '/sess_fixture/events', {'events': []}), {})
            with self.assertRaises(json.JSONDecodeError):
                engineer.api('POST', payload={'input': 'fixture'})

    def test_cli_doctor_does_not_print_keys(self):
        run = subprocess.run([sys.executable, str(engineer.ROOT / 'scripts/goatleta-engineer.py'), 'doctor'],
                             capture_output=True, encoding='utf-8', env={**os.environ, 'OPENAI_API_KEY': 'fixture-private-value'})
        self.assertEqual(run.returncode, 0)
        self.assertTrue(json.loads(run.stdout)['application_key_present'])
        self.assertNotIn('fixture-private-value', run.stdout + run.stderr)

    def test_default_is_read_only_without_delegation(self):
        run = self.prepared()
        self.assertEqual(engineer.verify(run)['filesystem_policy'], 'read_only')
        request = runtime.read(run / 'request.json')
        self.assertEqual(request['agent']['multi_agent'], {'enabled': False})

    def test_attestation_detects_changes_deletions_binary_and_added_files(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        self.assertEqual(runtime.attest(run, engineer)['status'], 'PASS')
        (run / 'runtime/workspace/AGENTS.md').unlink()
        (run / 'runtime/workspace/extra').write_bytes(b'\x00\xff')
        result = runtime.attest(run, engineer)
        self.assertEqual(result['status'], 'FAIL')
        self.assertIn('workspace/AGENTS.md', result['deleted'])
        self.assertIn('workspace/extra', result['binary_changes'])
        self.assertEqual(engineer.verify(run)['filesystem_policy'], 'read_only')

    def test_expected_write_must_happen_and_be_scoped(self):
        path = 'scripts/explain-skill-selection.py'
        run = engineer.prepare('Revisar', 'fixture', [path], ['goatleta-testing'],
                               runs=self.base, allow_write=[path])
        runtime.stage(run, engineer)
        self.assertEqual(runtime.attest(run, engineer)['status'], 'FAIL')
        (run / 'runtime/workspace' / path).write_text('expected change')
        self.assertEqual(runtime.attest(run, engineer)['status'], 'PASS')
        (run / 'runtime/profiles/coordinator.md').write_text('unexpected')
        self.assertEqual(runtime.attest(run, engineer)['status'], 'FAIL')

    def test_stage_does_not_overwrite_evidence(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        with self.assertRaises(ValueError):
            runtime.stage(run, engineer)

    def test_teardown_rejects_foreign_container(self):
        run = self.prepared()
        with patch.object(runtime, 'docker', return_value='{"goatleta.engineer.run":"foreign"}') as docker:
            with self.assertRaises(ValueError):
                runtime.teardown(run, engineer, True)
            self.assertEqual(docker.call_count, 1)

    def test_provision_dry_run_does_not_start_docker(self):
        run = self.prepared()
        with patch.object(runtime, 'docker', side_effect=AssertionError('docker')):
            result = runtime.provision(run, engineer, 'sha256:' + 'a' * 64)
        self.assertFalse(result['executor_started'])

    def test_provision_is_read_only_and_only_passes_executor_key(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'environment': {'id': 'env_fixture',
                      'remote_url': 'https://api.openai.com/v1/agents/environments/connect'}})
        with patch.dict(os.environ, {'OPENAI_EXECUTOR_API_KEY': 'executor-fixture', 'OPENAI_API_KEY': 'controller-fixture'}), \
             patch.object(runtime, 'docker', side_effect=['[{"Endpoints":{"docker":{"Host":"unix:///var/run/docker.sock"}}}]', 'image', 'a' * 64]) as docker:
            runtime.provision(run, engineer, 'sha256:' + 'a' * 64, True)
        call = docker.call_args
        args = call.args[0]
        self.assertIn('--read-only', args)
        self.assertIn('CODEX_HOME=/home/node', args)
        self.assertTrue(any(v.startswith('/home/node:rw,') for v in args))
        self.assertTrue(all(',readonly' in arg for arg in args if arg.startswith('type=bind')))
        self.assertNotIn('controller-fixture', str(call))
        self.assertNotIn('executor-fixture', str(args))
        self.assertEqual(call.kwargs['executor_key'], 'executor-fixture')

    def test_report_does_not_claim_idle_or_attestation_is_remote_success(self):
        run = self.prepared()
        runtime.stage(run, engineer)
        runtime.attest(run, engineer)
        engineer.save(run / 'session.json', {'id': 'sess_fixture', 'status': 'idle'})
        result = runtime.report(run, engineer)
        self.assertFalse(result['root_turn_completed'])
        self.assertIsNone(result['usage'])
        self.assertIsNone(result['estimated_cost_usd'])

    def test_report_counts_persisted_commands_and_exports_final_answer(self):
        run = self.prepared()
        engineer.save(run / 'history.json', {'turns': [{'id': 'turn_fixture', 'status': 'completed',
                      'subagent_id': None, 'started_at': 10, 'completed_at': 75}],
                      'items': [{'type': 'command_execution', 'status': 'failed'},
                                {'type': 'command_execution', 'status': 'completed'},
                                {'type': 'message', 'role': 'assistant', 'phase': 'final_answer',
                                 'content': [{'type': 'output_text', 'text': 'Fixture result'}]}]})
        result = runtime.report(run, engineer)
        self.assertEqual(result['commands_count'], 2)
        self.assertEqual(result['failed_commands_count'], 1)
        self.assertEqual(result['turns'][0]['duration_seconds'], 65)
        self.assertEqual((run / 'agent-response.md').read_text(), 'Fixture result')

    def test_reconcile_persists_required_actions_and_all_history_pages(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'id': 'sess_fixture'})
        with patch.object(engineer, 'api', side_effect=[
            {'id': 'sess_fixture', 'status': 'requires_action', 'required_actions': [{'type': 'environment_connection'}]},
            {'data': [{'id': 'turn_root', 'subagent_id': None, 'status': 'completed'}], 'has_more': True, 'last_id': 'turn_root'},
            {'data': [], 'has_more': False}, {'data': [], 'has_more': False}]):
            result = runtime.reconcile(run, engineer)
        self.assertEqual(result['required_actions'], ['environment_connection'])
        self.assertEqual(result['turns'], 1)
        self.assertTrue((run / 'history.json').exists())

    def test_reconcile_fetches_separate_specialist_history(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'id': 'sess_fixture'})
        root = {'id': 'turn_root', 'subagent_id': None, 'status': 'completed'}
        child = {'id': 'turn_child', 'subagent_id': 'subagent_fixture', 'status': 'completed'}
        with patch.object(engineer, 'api', side_effect=[
            {'id': 'sess_fixture', 'status': 'idle'},
            {'data': [root]}, {'data': [{'id': 'call_create', 'type': 'create_subagent_call'}]},
            {'data': [{'id': 'subagent_fixture'}]}, {'data': [child]},
            {'data': [{'id': 'child_answer', 'type': 'message'}]}]) as api:
            result = runtime.reconcile(run, engineer)
        self.assertEqual(result['turns'], 2)
        self.assertEqual(result['items'], 2)
        self.assertIn('/subagents/subagent_fixture/items', api.call_args.args[1])
        history = json.loads((run / 'history.json').read_text())
        self.assertEqual(history['subagents'][0]['id'], 'subagent_fixture')

    def test_docker_child_environment_excludes_controller_key(self):
        completed = MagicMock(returncode=0, stdout='ok')
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'private-controller', 'DOCKER_HOST': 'tcp://other'}), \
             patch.object(runtime.subprocess, 'run', return_value=completed) as process:
            runtime.docker(['version'], executor_key='restricted-executor')
        env = process.call_args.kwargs['env']
        self.assertNotIn('OPENAI_API_KEY', env)
        self.assertNotIn('DOCKER_HOST', env)
        self.assertEqual(env['CODEX_API_KEY'], 'restricted-executor')

    def test_executor_refuses_untrusted_destination_before_docker(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'environment': {'id': 'env_fixture',
                      'remote_url': 'wss://example.invalid/connect'}})
        with patch.dict(os.environ, {'OPENAI_EXECUTOR_API_KEY': 'fixture'}), patch.object(runtime, 'docker') as docker:
            with self.assertRaises(ValueError):
                runtime.provision(run, engineer, 'sha256:' + 'a' * 64, True)
            docker.assert_not_called()

    def test_executor_refuses_insecure_registration(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'environment': {'id': 'env_fixture',
                      'remote_url': 'http://api.openai.com/connect'}})
        with patch.dict(os.environ, {'OPENAI_EXECUTOR_API_KEY': 'fixture'}), patch.object(runtime, 'docker') as docker:
            with self.assertRaises(ValueError):
                runtime.provision(run, engineer, 'sha256:' + 'a' * 64, True)
            docker.assert_not_called()

    def test_retry_requires_confirmed_teardown(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'environment': {'id': 'env_fixture',
                      'remote_url': 'https://api.openai.com/connect'}})
        with patch.dict(os.environ, {'OPENAI_EXECUTOR_API_KEY': 'fixture'}), \
             patch.object(runtime, 'docker', side_effect=['[{"Endpoints":{"docker":{"Host":"unix:///var/run/docker.sock"}}}]', 'image']) as docker:
            with self.assertRaises(ValueError):
                runtime.provision(run, engineer, 'sha256:' + 'a' * 64, True, retry_after_teardown=True)
        self.assertEqual(docker.call_count, 2)

    def test_recovery_cannot_replace_bound_session(self):
        run = self.prepared()
        engineer.save(run / 'session.json', {'id': 'sess_original'})
        with patch.object(engineer, 'api') as api:
            with self.assertRaises(ValueError):
                runtime.reconcile(run, engineer, 'sess_other')
            api.assert_not_called()

    def test_teardown_preserves_bundle_and_does_not_cancel_api(self):
        run = self.prepared()
        with patch.object(runtime, 'docker', side_effect=[json.dumps({'goatleta.engineer.run': run.name}), 'removed']), \
             patch.object(engineer, 'api', side_effect=AssertionError('API')):
            result = runtime.teardown(run, engineer, True)
        self.assertEqual(result['state'], 'removed')
        self.assertTrue((run / 'bundle/workspace/AGENTS.md').exists())
        self.assertEqual(runtime.teardown(run, engineer, True)['state'], 'already_removed')


if __name__ == '__main__':
    unittest.main()
