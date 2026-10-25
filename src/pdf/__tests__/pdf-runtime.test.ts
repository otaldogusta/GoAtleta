import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformFromAstSync } from '@babel/core';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

let mockPlatform = 'web';
let mockSdkLoads = 0;
const mockBlob = { size: 12, type: 'application/pdf' } as Blob;
const mockToBlob = jest.fn(async () => mockBlob);
const mockRootPdf = jest.fn(() => ({ toBlob: mockToBlob }));
const mockBrowserPdf = jest.fn(() => ({ toBlob: mockToBlob }));
jest.mock('react-native', () => ({
  Platform: { get OS() { return mockPlatform; } },
  Linking: { canOpenURL: jest.fn(), openURL: jest.fn() },
}));
jest.mock('expo-file-system/legacy', () => ({ EncodingType: { Base64: 'base64' } }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn() }));
jest.mock('@react-pdf/renderer', () => {
  mockSdkLoads++;
  return { __esModule: true, pdf: mockRootPdf };
});
jest.mock('@react-pdf/renderer/lib/react-pdf.browser', () => {
  mockSdkLoads++;
  return { __esModule: true, pdf: mockBrowserPdf };
});
function helpers() {
  // Jest's CJS VM cannot execute import(). Transform that transport only in the
  // actual helper source, resolving the same web runtime without changing CI flags.
  const filename = path.join(process.cwd(), 'src/pdf/export-pdf.ts');
  const ast = parse(readFileSync(filename, 'utf8'), { sourceType: 'module', plugins: ['typescript'] });
  traverse(ast, { CallExpression(value) {
    if (value.node.callee.type !== 'Import') return;
    const target = value.node.arguments[0];
    if (!t.isStringLiteral(target)) throw new Error('Expected a literal runtime module');
    value.replaceWith(t.callExpression(t.memberExpression(
      t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), []), t.identifier('then'),
    ), [t.arrowFunctionExpression([], t.callExpression(t.identifier('require'), [target]))]));
  } });
  const code = transformFromAstSync(ast, undefined, {
    filename, configFile: false, babelrc: false,
    presets: [['babel-preset-expo', { enableBabelRuntime: false }]],
    caller: { name: 'pdf-runtime-contract', platform: mockPlatform, isDev: false, supportsStaticESM: false, supportsReactCompiler: false },
  })!.code!;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, (name: string) => {
    if (name === './pdf-runtime') return jest.requireActual('../pdf-runtime.web');
    if (['react-native', 'expo-file-system/legacy', 'expo-print', 'expo-sharing'].includes(name)) return jest.requireMock(name);
    return jest.requireActual(name);
  });
  return module.exports as typeof import('../export-pdf');
}

beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  mockPlatform = 'web'; mockSdkLoads = 0;
  mockToBlob.mockResolvedValue(mockBlob);
});

test('ordinary export helpers do not initialize the PDF SDK until a web blob is requested', async () => {
  const exports = helpers();
  expect(exports.safeFileName('Relatório da turma')).toBe('relatorio-da-turma');
  expect(mockSdkLoads).toBe(0);
  const document = createElement('DOCUMENT');
  await expect(exports.createWebPdfBlob(document)).resolves.toBe(mockBlob);
  expect(mockBrowserPdf).toHaveBeenCalledWith(document);
  expect(mockSdkLoads).toBe(2);
  await expect(exports.createWebPdfBlob(document)).resolves.toBe(mockBlob);
  expect(mockSdkLoads).toBe(2);
});

test('the native runtime exports native document contracts without loading either web SDK entry', async () => {
  const native = jest.requireActual<typeof import('../pdf-runtime')>('../pdf-runtime');
  for (const name of ['AttendanceSummaryDocument', 'ClassRosterDocument', 'CoordinationAiDocument',
    'MonthlyLessonPlanDocument', 'PeriodizationDocument', 'SessionPlanDocument', 'SessionReportDocument'] as const) {
    expect(typeof native[name]).toBe('function');
  }
  expect(() => native.getWebPdfPrimitives()).toThrow('only available on web');
  await expect(native.renderWebPdfBlob(createElement('DOCUMENT'))).rejects.toThrow('only available on web');
  expect(mockSdkLoads).toBe(0);
});

test('native blob requests reject before resolving the web runtime', async () => {
  mockPlatform = 'android';
  const exports = helpers();
  await expect(exports.createWebPdfBlob(createElement('DOCUMENT'))).rejects.toThrow('only available on web');
  expect(mockSdkLoads).toBe(0);
});

test('court primitives and document blob rendering retain their existing SDK entries', async () => {
  const web = jest.requireActual<typeof import('../pdf-runtime.web')>('../pdf-runtime.web');
  expect(web.getWebPdfPrimitives().pdf).toBe(mockRootPdf);
  const document = createElement('DOCUMENT');
  await expect(web.renderWebPdfBlob(document)).resolves.toBe(mockBlob);
  expect(mockBrowserPdf).toHaveBeenCalledWith(document);
});

test('render failures remain rejected for the export handlers to show their existing error state', async () => {
  mockToBlob.mockRejectedValueOnce(new Error('render failed'));
  const exports = helpers();
  await expect(exports.createWebPdfBlob(createElement('DOCUMENT'))).rejects.toThrow('render failed');
});
