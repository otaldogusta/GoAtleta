import importlib.util, tempfile, unittest, json
from pathlib import Path
from zipfile import ZipFile
spec=importlib.util.spec_from_file_location('backup','scripts/scouting-storage-snapshot.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class BackupTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.base=Path(self.temp.name);self.root=self.base/'db';self.root.mkdir();d=self.root/m.PREFIXES[0];d.mkdir();(d/'0001.log').write_bytes(b'checkpoint');(d/'LOCK').write_bytes(b'locked');self.out=self.base/'backup'
 def tearDown(self):self.temp.cleanup()
 def test_roundtrip_and_scope(self):
  other=self.root/'https_other.leveldb';other.mkdir();(other/'private').write_bytes(b'private')
  r=m.snapshot(self.root,self.out);restored=self.base/'recovery-test';receipt=m.restore_isolated(Path(r['archive']),restored)
  self.assertEqual(m.inventory(self.root),m.inventory(restored));self.assertEqual(receipt['files'],1)
 def test_refuses_existing_destination(self):
  r=m.snapshot(self.root,self.out);d=self.base/'recovery-existing';d.mkdir()
  with self.assertRaises(ValueError):m.restore_isolated(Path(r['archive']),d)
 def test_refuses_live_destination(self):
  r=m.snapshot(self.root,self.out)
  with self.assertRaises(ValueError):m.restore_isolated(Path(r['archive']),self.root)
 def test_refuses_backup_inside_source(self):
  with self.assertRaises(ValueError):m.snapshot(self.root,self.root/'backup')
 def test_corrupt_member_no_partial_restore(self):
  r=m.snapshot(self.root,self.out);p=Path(r['archive']);bad=self.base/'bad.zip'
  with ZipFile(p) as z,ZipFile(bad,'w') as o:
   for n in z.namelist():o.writestr(n,z.read(n) if n=='manifest.json' else b'corrupt')
  d=self.base/'recovery-corrupt'
  with self.assertRaises(ValueError):m.restore_isolated(bad,d)
  self.assertFalse(d.exists())
 def test_traversal_no_partial_restore(self):
  p=self.base/'bad.zip'
  with ZipFile(p,'w') as z:
   z.writestr('manifest.json',json.dumps({'origin':'http://localhost:8081','kind':'physical-indexeddb-snapshot','files':{'../bad':{'bytes':1,'sha256':'x'}}}));z.writestr('../bad','x')
  with self.assertRaises(ValueError):m.restore_isolated(p,self.base/'recovery-traversal')
unittest.main()
