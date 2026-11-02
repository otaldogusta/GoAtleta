"""Read-only, origin-specific Chromium IDB snapshot; never opens the live DB.

Run while the browser remains open. A stable physical snapshot is a recovery
copy, not a substitute for an application export or a tested restore.
"""
import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

PREFIXES = ('http_localhost_8081.indexeddb.leveldb', 'http_localhost_8081.indexeddb.blob')


def inventory(root):
    result = {}
    for directory in (root / name for name in PREFIXES):
        if not directory.is_dir():
            continue
        if directory.is_symlink() or not directory.resolve().is_relative_to(root):
            raise ValueError('Refusing linked database directories.')
        for path in sorted(directory.rglob('*')):
            if not path.is_file() or path.name == 'LOCK':
                continue
            if path.is_symlink() or not path.resolve().is_relative_to(directory.resolve()):
                raise ValueError('Refusing linked database files.')
            digest = hashlib.sha256()
            size = 0
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
                    size += len(block)
            result[path.relative_to(root).as_posix()] = {
                'bytes': size, 'sha256': digest.hexdigest()}
    if not result:
        raise RuntimeError('No localhost:8081 IndexedDB files found.')
    return result


def snapshot(root, output):
    root = root.resolve(strict=True)
    output = output.resolve()
    if output.is_relative_to(root):
        raise ValueError('Backup destination must be outside the live database.')
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    for attempt in range(1, 4):
        before = inventory(root)
        archive = output / f'scouting-localhost-8081-{stamp}-{attempt}.zip'
        with ZipFile(archive, 'x', compression=ZIP_DEFLATED) as zipped:
            for name in before:
                zipped.write(root / name, name)
            zipped.writestr('manifest.json', json.dumps({
                'createdAt': stamp, 'origin': 'http://localhost:8081',
                'kind': 'physical-indexeddb-snapshot',
                'restoreTested': False,
                'scope': 'All IndexedDB databases for this origin; no video file or credentials from other storage.',
                'files': before,
            }, indent=2))
        after = inventory(root)
        with ZipFile(archive) as zipped:
            intact = zipped.testzip() is None and all(
                hashlib.sha256(zipped.read(name)).hexdigest() == item['sha256']
                for name, item in before.items())
        if before == after and intact:
            receipt = {
                'archive': str(archive), 'stableDuringCopy': True,
                'archiveIntegrityVerified': True, 'restoreTested': False,
                'sourceBytes': sum(item['bytes'] for item in before.values()),
                'archiveBytes': archive.stat().st_size, 'files': len(before),
            }
            archive.with_suffix('.receipt.json').write_text(
                json.dumps(receipt, indent=2), encoding='utf-8')
            return receipt
        archive.rename(archive.with_suffix('.unstable.zip'))
    raise RuntimeError('Database changed during all attempts; no stable snapshot claimed.')


def restore_isolated(archive, destination):
    """Restore only into a NEW recovery-* directory, never an existing profile."""
    destination = destination.resolve()
    if not destination.name.startswith('recovery-') or destination.exists():
        raise ValueError('Use a new recovery-* directory outside the browser profile.')
    if any(part.lower() in ('indexeddb', 'partitions') for part in destination.parts):
        raise ValueError('Never restore into a browser profile.')
    with ZipFile(archive) as zipped:
        manifest = json.loads(zipped.read('manifest.json'))
        if manifest.get('origin') != 'http://localhost:8081' or manifest.get('kind') != 'physical-indexeddb-snapshot':
            raise ValueError('Unexpected backup origin or format.')
        files = manifest['files']
        if not files or len(files) > 10000 or sum(x['bytes'] for x in files.values()) > 2 * 1024**3:
            raise ValueError('Invalid backup size.')
        if len(set(zipped.namelist())) != len(zipped.namelist()) or set(zipped.namelist()) != set(files) | {'manifest.json'}:
            raise ValueError('Unexpected archive members.')
        # Validate every name and checksum before creating the destination.
        for name, item in files.items():
            parts = name.split('/')
            if parts[0] not in PREFIXES or len(parts) < 2 or any(p in ('', '.', '..') or ':' in p or '\\' in p for p in parts):
                raise ValueError('Unsafe archive path.')
            if zipped.getinfo(name).file_size != item['bytes'] or hashlib.sha256(zipped.read(name)).hexdigest() != item['sha256']:
                raise ValueError('Corrupt backup.')
        destination.mkdir(parents=True, exist_ok=False)
        for name in files:
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with zipped.open(name) as source, target.open('xb') as output:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    output.write(block)
    if inventory(destination) != files:
        raise RuntimeError('Restored data differs from the manifest.')
    receipt = {'archive': str(archive), 'destination': str(destination),
               'physicalRestoreVerified': True, 'applicationRestoreTested': False,
               'files': len(files), 'sourceBytes': sum(x['bytes'] for x in files.values())}
    (destination / 'recovery-receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    return receipt


def watch(root, output, interval):
    """Low-priority, bounded polling. Never deletes snapshots or browser data."""
    if interval < 15:
        raise ValueError('Backup interval must be at least 15 seconds.')
    root, output = root.resolve(strict=True), output.resolve()
    if output.is_relative_to(root):
        raise ValueError('Backup destination must be outside the live database.')
    output.mkdir(parents=True, exist_ok=True)
    lock = output / 'backup-watcher.lock'
    # Exclusive lock: stale lock removal is explicit, not an automatic takeover.
    with lock.open('x', encoding='utf-8') as handle:
        handle.write(str(os.getpid()))
    previous = None
    last_backup = None
    status_file = output / 'backup-status.json'
    try:
        while not (output / 'STOP_BACKUP').exists():
            status = {'pid': os.getpid(), 'checkedAt': datetime.now(timezone.utc).isoformat(),
                      'intervalSeconds': interval, 'lastBackup': last_backup}
            try:
                current = inventory(root)
                if current != previous:
                    if sum(p.stat().st_size for p in output.glob('*.zip')) > 500 * 1024**2:
                        raise RuntimeError('Backup folder exceeded 500 MiB; archives preserved, free space required.')
                    last_backup = snapshot(root, output)
                    previous = current
                status.update(state='watching', lastBackup=last_backup)
            except Exception as error:
                status.update(state='error', error=str(error))
            temporary = status_file.with_suffix('.tmp')
            temporary.write_text(json.dumps(status, indent=2), encoding='utf-8')
            temporary.replace(status_file)
            # Poll stop once per second without hashing/reading the database.
            for _ in range(interval):
                if (output / 'STOP_BACKUP').exists():
                    break
                time.sleep(1)
    finally:
        lock.unlink(missing_ok=True)
        status_file.write_text(json.dumps({'state': 'stopped', 'lastBackup': last_backup}), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=30)
    parser.add_argument('--restore', type=Path)
    parser.add_argument('--restore-to', type=Path)
    args = parser.parse_args()
    if args.restore and args.restore_to and not args.watch:
        print(json.dumps(restore_isolated(args.restore, args.restore_to), indent=2))
    elif args.source and args.output:
        if args.watch:
            watch(args.source, args.output, args.interval)
        else:
            print(json.dumps(snapshot(args.source, args.output), indent=2))
    else:
        parser.error('Use --source/--output, or --restore/--restore-to.')
