"""Offline adversarial tests; no browser, model, credentials, or remote calls."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import engineer_vnext as v
import engineer_coordination as c
import engineer_runtime as runtime

spec = importlib.util.spec_from_file_location('engineer', Path(__file__).with_name('goatleta-engineer.py'))
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)

class VNextTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.run = Path(self.tmp.name)
        self.manifest = {'vnext': True, 'filesystem_policy': 'read_only',
                         'visual_policy': {'ui': True, 'motion': False, 'viewports': list(v.VIEWPORTS)}}
        e.save(self.run / 'manifest.json', self.manifest)

    def visuals(self, motion=False):
        folder = self.run / 'evidence'
        folder.mkdir(exist_ok=True)
        self.manifest['visual_policy']['motion'] = motion
        e.save(self.run / 'manifest.json', self.manifest)
        fingerprint = v.sha((self.run / 'manifest.json').read_bytes())
        artifacts = []
        for name, size in v.VIEWPORTS.items():
            # Synthetic binary fixture, not product visual evidence.
            raw = b'\x89PNG\r\n\x1a\n' + b'\x00\x00\x00\x0dIHDR' + struct.pack('>II', *size)
            p = 'evidence/' + name + '.png'
            (self.run / p).write_bytes(raw)
            artifacts.append({'path': p, 'sha256': v.sha(raw), 'kind': 'screenshot', 'viewport': name})
            if motion:
                for reduced in (False, True):
                    p = 'evidence/' + name + str(reduced) + '.webm'
                    raw = b'\x1aE\xdf\xa3fixture'
                    (self.run / p).write_bytes(raw)
                    artifacts.append({'path':p,'sha256':v.sha(raw),'kind':'video','viewport':name,'reduced_motion':reduced})
        self.capture = {'state':'CAPTURED','manifest_sha256':fingerprint,'artifacts':artifacts}
        self.review = {'manifest_sha256':fingerprint,'evidence_reviewed':[a['path'] for a in artifacts],
                       'result':'PASS', **{k:[] for k in ['visual','ux','accessibility','motion','performance']}}
        self.save_visuals()

    def save_visuals(self):
        e.save(self.run / 'evidence/capture.json', self.capture)
        e.save(self.run / 'ui-review.json', self.review)

    def gate(self): return v.visual_gate(self.run, self.manifest)

    def test_code_only_is_unverified(self):
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_consistent_review_passes_without_claiming_native(self):
        self.visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'PASS')
        self.assertIn('not_automatic', self.gate()['scope'])

    def test_modified_evidence_invalidates_review(self):
        self.visuals()
        (self.run/self.capture['artifacts'][0]['path']).write_bytes(b'tampered')
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_stale_manifest_invalidates_review(self):
        self.visuals()
        self.manifest['new_field'] = True
        e.save(self.run/'manifest.json', self.manifest)
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_wrong_viewport_dimensions_rejected(self):
        self.visuals()
        self.capture['artifacts'][0]['viewport']='desktop'
        self.save_visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_unreviewed_viewport_rejected(self):
        self.visuals()
        self.review['evidence_reviewed'].pop()
        self.save_visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_high_and_blocker_findings_block(self):
        self.visuals()
        for severity in ('BLOCKER','HIGH'):
            self.review['visual']=[{'severity':severity,'file':'app/login.tsx','issue':'fixture',
               'impact':'fixture','recommendation':'fixture','evidence':self.review['evidence_reviewed'][0]}]
            self.review['result']='FAIL'
            self.save_visuals()
            self.assertEqual(self.gate()['UI_UX_GATE'],'FAIL')

    def test_misrepresented_result_not_accepted(self):
        self.visuals()
        self.review['result']='FAIL'
        self.save_visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_motion_requires_reduced_video_each_viewport(self):
        self.visuals(True)
        self.assertEqual(self.gate()['MOTION_GATE'],'PASS')
        self.capture['artifacts'][-1]['reduced_motion']=False
        self.save_visuals()
        self.assertEqual(self.gate()['MOTION_GATE'],'UNVERIFIED')

    def test_motion_failure_does_not_fabricate_ui_failure(self):
        self.visuals(True)
        self.review['motion']=[{'severity':'HIGH','file':'fixture.tsx','issue':'motion stalls',
            'impact':'interaction delayed','recommendation':'remove delay','evidence':self.review['evidence_reviewed'][-1]}]
        self.review['result']='FAIL'
        self.save_visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'PASS')
        self.assertEqual(self.gate()['MOTION_GATE'],'FAIL')

    def test_motion_scope_without_video_stays_unverified(self):
        self.visuals(False)
        self.manifest['visual_policy']['motion']=True
        e.save(self.run/'manifest.json',self.manifest)
        fingerprint=v.sha((self.run/'manifest.json').read_bytes())
        self.capture['manifest_sha256']=self.review['manifest_sha256']=fingerprint
        self.save_visuals()
        self.assertEqual(self.gate()['UI_UX_GATE'],'PASS')
        self.assertEqual(self.gate()['MOTION_GATE'],'UNVERIFIED')

    def test_writable_candidate_requires_new_contract(self):
        self.visuals()
        self.manifest['filesystem_policy']='scoped_write'
        self.assertEqual(self.gate()['UI_UX_GATE'],'UNVERIFIED')

    def test_evidence_path_traversal_rejected(self):
        for p in ('../secret', 'evidence/../manifest.json','C:/secret','/secret','manifest.json'):
            with self.subTest(path=p), self.assertRaises(ValueError): v.evidence_file(self.run,p)

    def test_tsx_alone_not_visual_trigger(self):
        r=v.route('Ajustar tipagem', ['app/login.tsx'], e.ROOT)
        self.assertTrue(r['tsx_hint_only'])
        self.assertFalse(r['ui'])

    def test_visual_login_not_automatic_security(self):
        r=v.route('Melhorar layout do login',[],e.ROOT)
        self.assertIn('ui-ux-motion-review',r['specialists'])
        self.assertNotIn('security-review',r['specialists'])

    def test_explicit_security_and_motion_bounded(self):
        r=v.route('Animação com jank',[],e.ROOT,security=True)
        self.assertEqual(len(r['specialists']),3)
        self.assertLessEqual(len(r['skills']),6)
        self.assertIn('fixing-motion-performance',r['skills'])

    def test_context_rejects_invalid_duplicate_or_writer_roles(self):
        for roles in (['bad'], ['test-review']*2, ['implementation'], list(v.ROLES)):
            with self.subTest(roles=roles), self.assertRaises(ValueError): v.plan({},e.ROOT,roles,'fixture')

    def test_context_budget_fails_closed(self):
        with self.assertRaisesRegex(ValueError,'CONTEXT_BUDGET'):
            v.plan({'workspace/AGENTS.md':b'x'*120001},e.ROOT,[],'fixture')

    def test_coordinator_context_excludes_test_sources(self):
        p=v.plan({'workspace/test.py':b'x','profiles/test-review.md':b't'},e.ROOT,['test-review'],'fixture')
        self.assertEqual(p['final_test_owner'],'test-review')
        self.assertNotIn('workspace/test.py',p['roles']['coordinator']['files'])
        self.assertIn('workspace/test.py',p['roles']['test-review']['files'])

    def test_prepared_only_blocks_before_api_or_budget(self):
        with patch.object(e,'verify',return_value=self.manifest), patch.object(e,'api') as api:
            e.save(self.run/'request.json', {})
            with self.assertRaisesRegex(ValueError,'VNEXT_PREPARED_ONLY'): e.create(self.run,True)
            api.assert_not_called()

    def test_ui_flags_cannot_bypass_reviewer(self):
        with self.assertRaisesRegex(ValueError,'revisor UI/UX'):
            e.prepare('fixture','fixture',[],['goatleta-testing'],vnext=True,ui=True,runs=self.run)

    def test_core_preflight_cannot_claim_ui_readiness(self):
        self.manifest['version']=3
        with patch.object(e,'verify',return_value=self.manifest), patch.object(runtime,'docker') as docker:
            result=runtime.preflight(self.run,e,'sha256:'+'a'*64)
            self.assertEqual(result['state'],'BLOCKED_RUNTIME')
            docker.assert_not_called()

    def test_vnext_cannot_provision_remote_executor(self):
        self.manifest['version']=3
        with patch.object(e,'verify',return_value=self.manifest), patch.object(runtime,'docker') as docker:
            with self.assertRaisesRegex(ValueError,'VNEXT_PREPARED_ONLY'):
                runtime.provision(self.run,e,'sha256:'+'a'*64,live=True)
            docker.assert_not_called()

    def test_prepared_bundle_has_only_selected_profiles_and_owner(self):
        run=e.prepare('Revisar testes','fixture',[],['goatleta-testing'],vnext=True,
                      specialists=['test-review'],runs=self.run)
        m=e.verify(run)
        self.assertEqual(m['subagents_limit'],1)
        self.assertEqual(m['context_plan']['final_test_owner'],'test-review')
        self.assertFalse((run/'bundle/profiles/implementation.md').exists())
        self.assertEqual(e.create(run)['state'],'dry_run')

    def history(self, targets):
        return {'turns':[{'id':'root','status':'completed'}, {'id':'child','status':'completed','subagent_id':'sub_1'}],
          'items':[{'id':'spawn','turn_id':'root','type':'create_subagent_call','status':'completed'},
                   {'id':'wait','turn_id':'root','type':'wait_for_subagents_call','status':'completed','recipient_agent_ids':targets},
                   {'id':'cmd','turn_id':'child','type':'command_execution','exit_code':0},
                   *[{'id':t+'_answer','turn_id':t,'role':'assistant','phase':'final_answer',
                      'content':[{'type':'output_text','text':'fixture'}]} for t in ('root','child')]]}

    def test_empty_wrong_unknown_and_saved_ids_cannot_wait(self):
        for ids in ([],None,['root'],['agent_saved'],['unknown'],['sub_1','unknown']):
            r=c.evaluate(self.run,{'subagents_limit':1},self.history(ids),e)
            with self.subTest(ids=ids):
                self.assertFalse(r['checks']['waited'])
                self.assertEqual(r['state'],'FAIL_MULTI_AGENT')

    def test_valid_wait_does_not_auto_approve_incorporation(self):
        r=c.evaluate(self.run,{'subagents_limit':1},self.history(['sub_1']),e)
        self.assertTrue(r['checks']['waited'])
        self.assertEqual(r['state'],'PENDING_INCORPORATION_REVIEW')

    def test_mixed_valid_and_invalid_waits_fail(self):
        h=self.history(['sub_1'])
        h['items'].append({**h['items'][1],'id':'badwait','recipient_agent_ids':[]})
        r=c.evaluate(self.run,{'subagents_limit':1},h,e)
        self.assertFalse(r['checks']['waited'])
        self.assertIn('WAIT_TARGET_NOT_PROVEN',r['blocking_reasons'])

    def test_every_child_needs_command_answer_and_wait(self):
        h=self.history(['sub_1'])
        h['turns'].append({'id':'child2','status':'completed','subagent_id':'sub_2'})
        r=c.evaluate(self.run,{'subagents_limit':2},h,e)
        self.assertFalse(r['checks']['waited'])
        self.assertFalse(r['checks']['independent_command_evidence'])

if __name__=='__main__': unittest.main()
