"""Host verification of a completed local UI infrastructure probe, not a UI review."""
import json
from pathlib import Path
import hashlib


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def readiness(run, root, image):
    blocked = {'state': 'BLOCKED_RUNTIME', 'missing': ['UI_RUNTIME_NOT_VALIDATED'], 'image': image}
    try:
        receipt = json.loads((run / 'ui-runtime-validation.json').read_text(encoding='utf8'))
        capture = json.loads((run / 'evidence/capture.json').read_text(encoding='utf8'))
        manifest = json.loads((run / 'manifest.json').read_text(encoding='utf8'))
        if (receipt.get('state') != 'UI_RUNTIME_READY' or receipt.get('image') != image
                or receipt.get('container_removed') is not True or receipt.get('network') != 'none'
                or receipt.get('exit_code') != 0
                or receipt.get('manifest_sha256') != digest(run / 'manifest.json')
                or receipt.get('capture_sha256') != digest(run / 'evidence/capture.json')
                or receipt.get('harness_sha256') != digest(root / 'scripts/engineer_ui_evidence.mjs')
                or capture.get('state') != 'CAPTURED'):
            return blocked
        from engineer_vnext import evidence_file, VIEWPORTS
        kinds = {(a['viewport'], a['kind'], a.get('reduced_motion', False)) for a in capture['artifacts']}
        if any((v, k, reduced) not in kinds for v in VIEWPORTS for k in ('screenshot','video','accessibility') for reduced in (False, True)):
            return blocked
        if any(digest(evidence_file(run,a['path'])) != a['sha256'] for a in capture['artifacts']): return blocked
        source = {p.removeprefix('workspace/'): h for p,h in manifest['files'].items()
                  if p.startswith('workspace/') and not p.startswith('workspace/runtime/')}
        if not source or capture.get('source_hashes') != source: return blocked
        return {'state': 'READY', 'ui_runtime_state': 'UI_RUNTIME_READY', 'image': image,
                'missing': [], 'manifest_sha256': digest(run/'manifest.json'),
                'evidence_scope': 'local_infrastructure_only_not_visual_approval',
                'receipt_sha256': digest(run/'ui-runtime-validation.json')}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return blocked
