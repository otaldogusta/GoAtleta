"""Availability checks remain deterministic and never invoke the model."""
import sys
sys.dont_write_bytecode = True
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import engineer_preflight as preflight


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'router.json').write_text('{}')
        (self.root / 'goatleta-testing').mkdir()
        (self.root / 'goatleta-testing/SKILL.md').write_text('fixture')
        self.requirements = {'runtime_requirements': {'python': '>=3.12', 'node': '>=22'},
                             'required_commands': ['python', 'node', 'git'],
                             'required_files': ['router.json'], 'required_skills': ['goatleta-testing']}

    def inspect(self):
        with patch.object(preflight.shutil, 'which', return_value='/fixture'), \
             patch.object(preflight.subprocess, 'check_output', return_value='v22.23.3'):
            return preflight.inspect(self.requirements, self.root, self.root)

    def test_ready_with_all_requirements(self):
        self.assertEqual(self.inspect()['state'], 'READY')

    def test_missing_config_is_reported(self):
        (self.root / 'router.json').unlink()
        self.assertIn('file:router.json', self.inspect()['missing'])

    def test_missing_selected_skill_is_reported(self):
        (self.root / 'goatleta-testing/SKILL.md').unlink()
        self.assertIn('skill:goatleta-testing', self.inspect()['missing'])

    def test_wrong_version_blocks(self):
        self.requirements['runtime_requirements']['python'] = '>=999'
        result = self.inspect()
        self.assertEqual(result['state'], 'BLOCKED_RUNTIME')
        self.assertIn('python>=999', result['missing'])


if __name__ == '__main__':
    unittest.main()
