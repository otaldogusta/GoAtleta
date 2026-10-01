"""Synthetic receipts are confined to temporary fixtures; no live approval or Docker."""
import json
from pathlib import Path
import tempfile
import unittest
import engineer_ui_runtime as ui

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name); self.run=self.root/'run'; self.run.mkdir()
        (self.root/'scripts').mkdir(); (self.root/'scripts/engineer_ui_evidence.mjs').write_text('fixture')
        (self.run/'evidence').mkdir()
        self.manifest={'files':{'workspace/app/login.tsx':'source-fixture'}}
        self.save('manifest.json',self.manifest)
        self.capture={'state':'CAPTURED','source_hashes':{'app/login.tsx':'source-fixture'},'artifacts':[]}
        for view in ('mobile-small','tablet','desktop'):
            for kind in ('screenshot','video','accessibility'):
                for reduced in (False,True):
                    name=f'evidence/{view}-{kind}-{reduced}.fixture'
                    (self.run/name).write_text('synthetic; never product evidence')
                    self.capture['artifacts'].append({'path':name,'kind':kind,'viewport':view,
                        'reduced_motion':reduced,'sha256':ui.digest(self.run/name)})
        self.save('evidence/capture.json',self.capture)
        self.receipt={'state':'UI_RUNTIME_READY','image':'fixture-image','network':'none','exit_code':0,
            'container_removed':True,'manifest_sha256':ui.digest(self.run/'manifest.json'),
            'capture_sha256':ui.digest(self.run/'evidence/capture.json'),
            'harness_sha256':ui.digest(self.root/'scripts/engineer_ui_evidence.mjs')}
        self.save('ui-runtime-validation.json',self.receipt)

    def save(self,p,v): (self.run/p).write_text(json.dumps(v),encoding='utf8')
    def check(self): return ui.readiness(self.run,self.root,'fixture-image')['state']

    def test_complete_receipt_only_proves_infrastructure(self):
        r=ui.readiness(self.run,self.root,'fixture-image')
        self.assertEqual(r['state'],'READY'); self.assertIn('not_visual_approval',r['evidence_scope'])
    def test_receipt_without_teardown_is_blocked(self):
        self.receipt['container_removed']=False; self.save('ui-runtime-validation.json',self.receipt)
        self.assertEqual(self.check(),'BLOCKED_RUNTIME')
    def test_changed_harness_is_blocked(self):
        (self.root/'scripts/engineer_ui_evidence.mjs').write_text('changed')
        self.assertEqual(self.check(),'BLOCKED_RUNTIME')
    def test_changed_artifact_is_blocked(self):
        (self.run/self.capture['artifacts'][0]['path']).write_text('changed')
        self.assertEqual(self.check(),'BLOCKED_RUNTIME')
    def test_wrong_image_is_blocked(self):
        self.assertEqual(ui.readiness(self.run,self.root,'wrong')['state'],'BLOCKED_RUNTIME')
    def test_missing_viewport_is_blocked_even_with_new_capture_hash(self):
        self.capture['artifacts'].pop();self.save('evidence/capture.json',self.capture)
        self.receipt['capture_sha256']=ui.digest(self.run/'evidence/capture.json');self.save('ui-runtime-validation.json',self.receipt)
        self.assertEqual(self.check(),'BLOCKED_RUNTIME')
    def test_wrong_source_is_blocked(self):
        self.capture['source_hashes']={};self.save('evidence/capture.json',self.capture)
        self.receipt['capture_sha256']=ui.digest(self.run/'evidence/capture.json');self.save('ui-runtime-validation.json',self.receipt)
        self.assertEqual(self.check(),'BLOCKED_RUNTIME')

if __name__=='__main__': unittest.main()
