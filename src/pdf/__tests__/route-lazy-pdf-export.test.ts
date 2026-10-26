import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { transformFromAstSync } from '@babel/core';
import * as t from '@babel/types';
import type { ReactElement } from 'react';

const routes = new Map<string, ReturnType<typeof parse>>();
function handler(file: string, name: string) {
  let ast = routes.get(file);
  if (!ast) {
    ast = parse(readFileSync(path.join(process.cwd(), file), 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    routes.set(file, ast);
  }
  let found: t.ArrowFunctionExpression | t.FunctionExpression | undefined;
  traverse(ast, { VariableDeclarator(value) {
    if (!t.isIdentifier(value.node.id, { name })) return;
    const init = value.node.init;
    const fn = t.isCallExpression(init) ? init.arguments[0] : init;
    if (t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) found = t.cloneNode(fn, true);
  } });
  if (!found) throw new Error(`Missing export handler ${name}`);
  return found;
}

// Execute actual route export code without mounting the authenticated route.
// Only dynamic import transport is substituted; guards, payloads and catches run.
function execute<T>(body: t.Expression | t.BlockStatement, bindings: Record<string, unknown>): () => Promise<T> {
  const ast = t.file(t.program([t.expressionStatement(t.assignmentExpression('=',
    t.memberExpression(t.identifier('module'), t.identifier('exports')),
    t.arrowFunctionExpression([], body, true),
  ))]));
  traverse(ast, { CallExpression(value) {
    if (value.node.callee.type === 'Import') value.node.callee = t.identifier('loadDocument');
  } });
  const code = transformFromAstSync(ast, undefined, { filename: 'pdf-export-contract.tsx', configFile: false, babelrc: false,
    presets: [['babel-preset-expo', { enableBabelRuntime: false }]],
    caller: { name: 'pdf-export-contract', platform: (bindings.Platform as { OS: string }).OS, isDev: false, supportsStaticESM: false, supportsReactCompiler: false },
  })!.code!;
  const module = { exports: undefined as unknown };
  const evaluate = new Function(...Object.keys(bindings), 'module', 'require', code);
  evaluate(...Object.values(bindings), module, (name: string) => jest.requireActual(name));
  return module.exports as () => Promise<T>;
}

function exportParts(file: string, name: string) {
  const fn = handler(file, name), ast = t.file(t.program([t.expressionStatement(fn)]));
  let document: t.Expression | undefined, guarded: t.TryStatement | undefined;
  traverse(ast, { VariableDeclarator(value) {
    if (!t.isIdentifier(value.node.id, { name: 'webDocument' }) || !t.isExpression(value.node.init)) return;
    document = t.cloneNode(value.node.init, true);
    const container = value.findParent(parent => parent.isTryStatement());
    if (container?.isTryStatement()) guarded = t.cloneNode(container.node, true);
  } });
  if (!document) throw new Error(`Missing web document for ${name}`);
  return { fn, document, guarded };
}

const cases = [
  ['app/class/[id].tsx', 'exportRosterPdf', 'ClassRosterDocument', 'data'],
  ['app/periodization/index.tsx', 'handleExportCycle', 'PeriodizationDocument', 'data'],
  ['app/periodization/index.tsx', 'handleExportWeek', 'MonthlyLessonPlanDocument', 'data'],
  ['app/class/[id]/session.tsx', 'handleExportPdf', 'SessionPlanDocument', 'pdfData'],
  ['app/class/[id]/session.tsx', 'handleExportReportPdf', 'SessionReportDocument', 'reportData'],
  ['app/class/[id]/planning/[month].tsx', 'handleExportDailyPdf', 'SessionPlanDocument', 'pdfData'],
  ['app/class/[id]/planning/[month].tsx', 'handleExportMonthPdf', 'MonthlyLessonPlanDocument', 'data'],
] as const;

test.each(cases)('%s %s preserves document props and skips PDF loading on native', async (file, name, component, payload) => {
  const { document } = exportParts(file, name), data = { title: 'Synthetic document' };
  const Document = () => null, loadDocument = jest.fn(async () => ({ [component]: Document }));
  const bindings = { [payload]: data, loadDocument };
  const web = await execute<ReactElement<{ data: unknown }>>(document, { ...bindings, Platform: { OS: 'web' } })();
  expect(web.type).toBe(Document); expect(web.props.data).toBe(data);
  expect(loadDocument).toHaveBeenCalledWith(expect.stringMatching(/\/pdf-runtime$/));
  loadDocument.mockClear();
  await expect(execute(document, { ...bindings, Platform: { OS: 'android' } })()).resolves.toBeUndefined();
  expect(loadDocument).not.toHaveBeenCalled();
});

test.each(cases.filter(([, name]) => ['handleExportCycle', 'handleExportWeek', 'handleExportDailyPdf'].includes(name)))(
  '%s %s reports a failed chunk without an unhandled rejection or export', async (file, name, _component, payload) => {
    const { guarded } = exportParts(file, name);
    if (!guarded) throw new Error('Export stage must handle load errors');
    const exportPdf = jest.fn(), showSaveToast = jest.fn();
    const action = execute(t.blockStatement([guarded]), { Platform: { OS: 'web' }, [payload]: {}, html: '<html/>', fileName: 'synthetic',
      exportPdf, showSaveToast, loadDocument: jest.fn(async () => { throw new Error('chunk failed'); }),
    });
    await expect(action()).resolves.toBeUndefined();
    expect(exportPdf).not.toHaveBeenCalled();
    expect(showSaveToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: expect.stringContaining('PDF') }));
  },
);

function monthly(platform: string, loadDocument: jest.Mock) {
  const fn = handler('app/class/[id]/planning/[month].tsx', 'handleExportMonthPdf');
  const data = { title: 'Synthetic month' }, exportPdf = jest.fn(async () => undefined);
  const setIsExportingMonth = jest.fn(), showSaveToast = jest.fn();
  const action = execute(fn.body as t.BlockStatement, {
    Platform: { OS: platform }, selectedClass: { name: 'Turma' }, currentMonthSummary: { hasPlans: true }, isExportingMonth: false,
    setIsExportingMonth, showSaveToast, weeklyItems: [{ plan: { id: 'week' } }], calendarExceptions: [], monthKey: '2026-10',
    listDailyLessonPlansByWeekIds: jest.fn(async () => []), buildMonthlyPlanExportData: () => data,
    monthlyPlanHtml: () => '<html>synthetic month</html>', safeFileName: (value: string) => value.toLowerCase(),
    loadDocument, exportPdf, setTimeout: (complete: () => void) => { complete(); return 0; },
  });
  return { action, data, exportPdf, setIsExportingMonth, showSaveToast };
}

test.each(['web', 'android'])('monthly export keeps filename, HTML and busy cleanup on %s', async platform => {
  const Document = () => null, loadDocument = jest.fn(async () => ({ MonthlyLessonPlanDocument: Document }));
  const test = monthly(platform, loadDocument);
  await test.action();
  expect(test.exportPdf).toHaveBeenCalledWith({ html: '<html>synthetic month</html>', fileName: 'plano-mensal-turma-2026-10.pdf',
    webDocument: platform === 'web' ? expect.objectContaining({ type: Document, props: { data: test.data } }) : undefined,
  });
  expect(test.setIsExportingMonth.mock.calls).toEqual([[true], [false]]);
  if (platform === 'android') expect(loadDocument).not.toHaveBeenCalled();
});

test('a monthly chunk failure retains the existing error toast and always clears the busy flag', async () => {
  const test = monthly('web', jest.fn(async () => { throw new Error('chunk failed'); }));
  await expect(test.action()).resolves.toBeUndefined();
  expect(test.exportPdf).not.toHaveBeenCalled();
  expect(test.showSaveToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
  expect(test.setIsExportingMonth.mock.calls).toEqual([[true], [false]]);
});
