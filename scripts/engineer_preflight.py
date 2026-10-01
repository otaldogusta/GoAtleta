"""Run inside a credential-free, network-free container before creating an API session."""
import json
from pathlib import Path
import shutil
import subprocess
import sys


def inspect(requirements, workspace=Path('/workspace'), capabilities=Path('/capabilities')):
    missing, versions = [], {}
    for command in requirements['required_commands']:
        if not shutil.which(command):
            missing.append('command:' + command)
    for runtime, minimum in requirements['runtime_requirements'].items():
        if runtime == 'python':
            actual = sys.version_info[:3]
        elif runtime == 'node' and shutil.which('node'):
            value = subprocess.check_output(['node', '--version'], text=True).strip().lstrip('v')
            actual = tuple(int(n) for n in value.split('.'))
        else:
            missing.append('runtime:' + runtime)
            continue
        versions[runtime] = '.'.join(map(str, actual))
        if actual < tuple(int(n) for n in minimum.removeprefix('>=').split('.')):
            missing.append(runtime + minimum)
    for relative in requirements['required_files']:
        if not (workspace / relative).is_file():
            missing.append('file:' + relative)
    for name in requirements['required_skills']:
        if not (capabilities / name / 'SKILL.md').is_file():
            missing.append('skill:' + name)
    return {'state': 'BLOCKED_RUNTIME' if missing else 'READY', 'missing': missing, 'versions': versions}


if __name__ == '__main__':
    requirements = json.loads(Path('/workspace/runtime/task-requirements.json').read_text(encoding='utf-8'))
    result = inspect(requirements)
    result['validation'] = []
    if result['state'] == 'READY':
        for argv in requirements['validation_commands']:
            try:
                check = subprocess.run(argv, cwd='/workspace', capture_output=True, text=True, timeout=20)
                result['validation'].append({'command': argv, 'exit_code': check.returncode,
                                             'output': (check.stdout + check.stderr)[-12000:]})
                if check.returncode:
                    result['state'] = 'BLOCKED_RUNTIME'
            except (OSError, subprocess.TimeoutExpired):
                result['state'] = 'BLOCKED_RUNTIME'
                result['missing'].append('validation:' + argv[0])
    print(json.dumps(result))
    # JSON carries the failure, so a missing dependency isn't confused with a Docker failure.
