"""Validate installed skill entrypoints with Codex's bundled schema validator."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import subprocess

def main():
    root = Path(__file__).resolve().parents[1]
    codex = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex')))
    validator = codex / 'skills/.system/skill-creator/scripts/quick_validate.py'
    spec = importlib.util.spec_from_file_location('codex_skill_validator', validator)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    manifest = json.loads((root / 'docs/operations/skills-package.lock.json').read_text(encoding='utf-8'))
    failures = []
    for item in manifest['skills']:
        try:
            ok, reason = module.validate_skill(codex / 'skills' / item['name'])
        except Exception as error:
            ok, reason = False, str(error)
        if not ok:
            failures.append((item['name'], reason))
    for name, reason in failures:
        print(f'INVALID: {name}: {reason}')
    print(f"Validated {len(manifest['skills'])} installed skills; failures: {len(failures)}")
    return bool(failures)

if __name__ == '__main__':
    if not sys.flags.utf8_mode:
        sys.exit(subprocess.call([sys.executable, '-X', 'utf8', str(Path(__file__).resolve())]))
    sys.exit(main())
