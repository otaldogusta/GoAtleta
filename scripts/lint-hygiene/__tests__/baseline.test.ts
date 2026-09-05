const { collectErrors, compareBaseline, buildEntries, canPassBaseline } = require('../baseline');
const rootDir = process.cwd();
const result = (source: string, line = 1) => [{
  filePath: `${rootDir}/src/screen.tsx`, source,
  messages: [{ severity: 2, ruleId: 'react-hooks/refs', message: 'Error: ref read', line, column: 1, endLine: line, endColumn: 12 }],
}];

describe('lint debt ratchet', () => {
  it('keeps a diagnostic stable when unrelated lines are inserted', () => {
    const errors = collectErrors(result('ref.current'), rootDir);
    const moved = collectErrors(result('// moved\nref.current', 2), rootDir);
    expect(compareBaseline(moved, { entries: buildEntries(errors) })).toEqual({ added: [], resolved: 0 });
  });
  it('does not allow a new error to replace a fixed error in the same file', () => {
    const errors = collectErrors(result('ref.current'), rootDir);
    const changed = collectErrors(result('bad.current'), rootDir);
    expect(compareBaseline(changed, { entries: buildEntries(errors) }).added).toHaveLength(1);
  });
  it('does not allow duplicating an existing failing expression', () => {
    const errors = collectErrors(result('ref.current'), rootDir);
    expect(compareBaseline([...errors, ...errors], { entries: buildEntries(errors) }).added).toHaveLength(1);
  });
  it('reports resolved debt and never accepts parser failures', () => {
    const errors = collectErrors(result('ref.current'), rootDir);
    expect(compareBaseline([], { entries: buildEntries(errors) }).resolved).toBe(1);
    expect(compareBaseline([{ ...errors[0], fatal: true }], { entries: buildEntries(errors) }).added).toHaveLength(1);
  });
  it('requires pruning fixed debt so a later change cannot reintroduce it', () => {
    const errors = collectErrors(result('ref.current'), rootDir);
    const delta = compareBaseline([], { entries: buildEntries(errors) });
    expect(canPassBaseline(delta)).toBe(false);
    expect(canPassBaseline(delta, true)).toBe(true);
    const regression = compareBaseline(errors, { entries: buildEntries([]) });
    expect(canPassBaseline(regression)).toBe(false);
    expect(canPassBaseline(regression, true)).toBe(false);
  });
});
