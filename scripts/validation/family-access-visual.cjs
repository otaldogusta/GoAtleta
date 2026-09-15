// Visual fixtures only. All external requests are blocked; no accounts or requests are changed.
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const out = path.resolve('artifacts/design-qa/family-access');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost','127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    for (const [width,height] of [[390,844],[834,1194],[1440,1024]]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://localhost:8081/family-access-preview', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByText('PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM GRAVAÇÃO').waitFor({ timeout: 60000 }).catch(async error => {
        await page.screenshot({ path: path.join(out, 'preview-error.png'), fullPage: true });
        console.error((await page.locator('body').innerText()).slice(0,1200));
        throw error;
      });
      for (const theme of ['dark','light']) {
        const switchLabel = theme === 'dark' ? 'Tema escuro' : 'Tema claro';
        if (await page.getByRole('button', { name: switchLabel, exact: true }).count()) await page.getByRole('button', { name: switchLabel, exact: true }).click();
        for (const [label, filename] of [['Entrada','entry'],['Coordenação','coordination'],['Responsável','guardian']]) {
          await page.getByRole('button', { name: label, exact: true }).click();
          await page.screenshot({ path: path.join(out, `${filename}-${theme}-${width}x${height}.png`), fullPage: true });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          if (overflow) throw new Error(`Horizontal overflow: ${label} ${theme} ${width}`);
        }
      }
    }
    console.log(`18 localhost fixture screenshots saved in ${out}; no remote writes.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
