"""Real local Docker read-only smoke. No credentials, network or Agents API."""
import argparse
from pathlib import Path
import re
import sys
import tempfile
sys.dont_write_bytecode = True
from engineer_runtime import docker

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--image', required=True)
args = parser.parse_args()
if not re.fullmatch(r'sha256:[a-f0-9]{64}', args.image):
    parser.error('Use o ID imutável da imagem local.')
parent = Path(__file__).resolve().parents[1] / '.tmp'
parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='engineer-docker-smoke-', dir=parent) as directory:
    root = Path(directory)
    (root / 'fixture.txt').write_text('preserved', encoding='utf-8')
    js = r'''
const fs = require('fs');
const assert = require('assert');
assert.equal(process.getuid(), 1000);
assert(!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY);
assert.equal(fs.readFileSync('/workspace/fixture.txt', 'utf8'), 'preserved');
for (const attempt of [
  () => fs.writeFileSync('/workspace/new.txt', 'x'),
  () => fs.writeFileSync('/workspace/fixture.txt', 'x'),
  () => fs.renameSync('/workspace/fixture.txt', '/workspace/moved.txt'),
  () => fs.unlinkSync('/workspace/fixture.txt'),
  () => fs.writeFileSync('/root-write.txt', 'x')
]) assert.throws(attempt, e => ['EROFS','EACCES'].includes(e.code));
fs.writeFileSync('/tmp/scratch', 'temporary');
assert.equal(fs.readFileSync('/tmp/scratch', 'utf8'), 'temporary');
console.log('PASS: non-root; no keys; create/write/rename/delete blocked; tmp writable');
'''
    output = docker(['run', '--rm', '--pull=never', '--network=none', '--read-only',
                     '--user', '1000:1000', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                     '--pids-limit', '128', '--memory', '2g', '--cpus', '2',
                     '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777',
                     '--mount', f'type=bind,source={root},target=/workspace,readonly',
                     '--entrypoint', 'node', args.image, '-e', js])
    assert (root / 'fixture.txt').read_text() == 'preserved'
    assert len(list(root.iterdir())) == 1
    print(output)
    (root / 'allowed.txt').write_text('before', encoding='utf-8')
    scoped = r'''
const fs = require('fs'), assert = require('assert');
assert(!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY);
fs.writeFileSync('/workspace/allowed.txt', 'after');
assert.equal(fs.readFileSync('/workspace/allowed.txt', 'utf8'), 'after');
for (const attempt of [
  () => fs.writeFileSync('/workspace/fixture.txt', 'bad'),
  () => fs.writeFileSync('/workspace/unexpected.txt', 'bad'),
  () => fs.mkdirSync('/workspace/newdir'),
  () => fs.renameSync('/workspace/allowed.txt', '/workspace/moved.txt'),
  () => fs.unlinkSync('/workspace/allowed.txt')
]) assert.throws(attempt, e => ['EROFS','EACCES','EBUSY'].includes(e.code));
console.log('PASS: allowed file writable; other files/new paths/rename/delete blocked');
'''
    print(docker(['run', '--rm', '--pull=never', '--network=none', '--read-only',
                  '--user', '1000:1000', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                  '--mount', f'type=bind,source={root},target=/workspace,readonly',
                  '--mount', f'type=bind,source={root / "allowed.txt"},target=/workspace/allowed.txt',
                  '--entrypoint', 'node', args.image, '-e', scoped]))
    assert (root / 'allowed.txt').read_text() == 'after'
    assert (root / 'fixture.txt').read_text() == 'preserved'
