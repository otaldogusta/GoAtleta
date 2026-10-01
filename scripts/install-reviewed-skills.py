#!/usr/bin/env python3
"""Install or verify pinned personal skills. Preserve any local drift."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def hashes(folder: Path) -> dict[str, str]:
    return {
        p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(folder.rglob("*"))
        if p.is_file() and "__pycache__" not in p.parts
    }


def child(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError(f"Path outside skill folder: {relative}")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify installed files; no writes or network")
    parser.add_argument("--dry-run", action="store_true", help="Show missing/drifted skills; no writes or network")
    args = parser.parse_args()
    if args.check and args.dry_run:
        parser.error("Choose --check or --dry-run")
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / "docs/operations/skills-package.lock.json").read_text(encoding="utf-8"))
    codex_dir = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    destination = codex_dir / "skills"
    installer = destination / ".system/skill-installer/scripts/install-skill-from-github.py"
    failed = False
    for item in manifest["skills"]:
        name = item["name"]
        if not re.fullmatch(r"[a-z0-9-]+", name) or not re.fullmatch(r"[0-9a-f]{40}", item["ref"]):
            raise ValueError("Invalid skill name or pinned commit")
        target = child(destination, name)
        if target.exists():
            valid = hashes(target) == item["installed_sha256"]
            print(f"{'OK' if valid else 'DRIFT - preserved'}: {name}")
            failed |= not valid
            continue
        if args.check or args.dry_run:
            print(f"MISSING: {name} ({item['repo']} @ {item['ref'][:12]})")
            failed |= args.check
            continue
        if not installer.is_file():
            raise FileNotFoundError("Codex skill-installer is required; no alternative installer executed")
        subprocess.run([
            sys.executable, str(installer), "--repo", item["repo"],
            "--ref", item["ref"], "--path", item["path"],
            "--name", name, "--dest", str(destination),
        ], check=True)
        if hashes(target) != item["upstream_sha256"]:
            raise RuntimeError(f"Downloaded content differs from reviewed source: {name}; files preserved")
        for patch in item["patches"]:
            file = child(target, patch["file"])
            content = file.read_text(encoding="utf-8")
            if content.count(patch["old"]) != patch["count"]:
                raise RuntimeError(f"Patch precondition failed: {name}/{patch['file']}; files preserved")
            file.write_text(content.replace(patch["old"], patch["new"]), encoding="utf-8", newline="\n")
        if hashes(target) != item["installed_sha256"]:
            raise RuntimeError(f"Installed verification failed: {name}; files preserved")
        print(f"INSTALLED + VERIFIED: {name}")
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
