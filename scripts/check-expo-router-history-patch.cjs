const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Version-pinned companion to patches/expo-router+57.0.17.patch.
// --apply touches only the two verified local SDK files; it never runs a shell or network.
const mode = process.argv[2] ?? '--check';
assert.ok(['--check', '--inspect', '--apply'].includes(mode), 'Unknown mode');
assert.equal(process.argv.length <= 3, true, 'Unexpected arguments');
const workspace = fs.realpathSync(path.dirname(require.resolve('../package.json')));
const sdk = fs.realpathSync(path.join(workspace, 'node_modules', 'expo-router'));
const relativeSdk = path.relative(workspace, sdk);
assert.ok(relativeSdk && !relativeSdk.startsWith('..') && !path.isAbsolute(relativeSdk), 'SDK must belong to this worktree');
assert.equal(JSON.parse(fs.readFileSync(path.join(sdk, 'package.json'), 'utf8')).version, '57.0.17', 'Review this patch when Expo Router changes');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const specs = [
  {
    file: 'build/fork/createMemoryHistory.js',
    pristine: '6283ba26a72bea1424e1355d0c855e559b25c84d0ca6efbc1adf79143ca8ed49',
    patched: '812595b05488b2c439e50eb8f0fdda3cb120debdd964027eceff1159a6586c2f',
    before: '                listener();',
    after: '                index = history.index;\n                listener();',
  },
  {
    file: 'build/layouts/StackClient.js',
    pristine: '9c58e1107583639726bc3415319b9e17a1bb34ba9889f4469471e21b8ae011e1',
    patched: 'ad18c0d1e2cbc7301e871f86551faaadfff77c30c7040854c2824bd635a2c466',
    before: '    return ((0, jsx_runtime_1.jsx)(RNStack, { ...props, children: rnChildren, screenOptions: screenOptions, UNSTABLE_router: exports.stackRouterOverride }));',
    after: '    const routerOverride = (0, react_1.useMemo)(() => {\n        const override = props.UNSTABLE_router;\n        return override\n            ? (original) => {\n                const expoRouter = { ...original, ...(0, exports.stackRouterOverride)(original) };\n                return { ...expoRouter, ...override(expoRouter) };\n            }\n            : exports.stackRouterOverride;\n    }, [props.UNSTABLE_router]);\n    return ((0, jsx_runtime_1.jsx)(RNStack, { ...props, children: rnChildren, screenOptions: screenOptions, UNSTABLE_router: routerOverride }));',
  },
];
const files = specs.map(spec => {
  const target = fs.realpathSync(path.join(sdk, spec.file));
  assert.equal(path.relative(sdk, target), spec.file.replaceAll('/', path.sep), 'Unexpected SDK file target');
  const original = fs.readFileSync(target, 'utf8');
  const hash = sha(original);
  assert.ok(hash === spec.pristine || hash === spec.patched, `Unreviewed SDK content: ${spec.file}`);
  return { ...spec, target, original, state: hash === spec.patched ? 'patched' : 'pristine' };
});
assert.ok(files.every(file => file.state === files[0].state), 'Mixed patch state; inspect without overwriting');
if (mode === '--apply' && files[0].state === 'pristine') {
  const changes = files.map(file => {
    assert.equal(file.original.split(file.before).length, 2, `Unexpected match count: ${file.file}`);
    const changed = file.original.replace(file.before, file.after);
    assert.equal(sha(changed), file.patched, `Unexpected patch result: ${file.file}`);
    return { ...file, changed };
  });
  try {
    for (const file of changes) fs.writeFileSync(file.target, file.changed);
    for (const file of changes) assert.equal(sha(fs.readFileSync(file.target)), file.patched);
  } catch (error) {
    for (const file of changes) fs.writeFileSync(file.target, file.original);
    throw error;
  }
}
if (mode !== '--inspect') {
  for (const file of files) assert.equal(sha(fs.readFileSync(file.target)), file.patched, `Patch not applied: ${file.file}`);
}
console.log(`[expo-router] 57.0.17 web-history patch ${mode === '--inspect' ? files[0].state : 'verified'}; two local files checked.`);
