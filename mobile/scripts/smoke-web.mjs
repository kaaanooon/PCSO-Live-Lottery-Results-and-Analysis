import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = process.env.LOTTO_APP_URL ?? 'http://127.0.0.1:8097';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifacts = new URL('../artifacts/', import.meta.url);
const artifactPath = (name) => fileURLToPath(new URL(name, artifacts));
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const browserErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('pageerror', (error) => browserErrors.push(error.message));

const tab = async (name) => {
  const byRole = page.getByRole('tab', { name, exact: true });
  if (await byRole.count()) return byRole.click();
  return page.getByText(name, { exact: true }).last().click();
};

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('Latest results', { exact: true }).waitFor();
  await page.getByText('Browse result history', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByText('Position 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText(/Bundled archive|Live refresh|Cached refresh/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: artifactPath('results-mobile.png'), fullPage: true });

  await tab('Pick');
  await page.getByText('Check a pick', { exact: true }).waitFor();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByLabel('Number 1').fill('0');
  await page.getByLabel('Number 2').fill('4');
  await page.getByLabel('Number 3').fill('6');
  await page.getByRole('button', { name: 'Save and cross-check', exact: true }).click();
  await page.getByText('3D Lotto', { exact: true }).last().waitFor();
  await page.getByText(/draws checked/i).last().waitFor();
  await page.getByText(/For ages 18 and older\. A match here/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: artifactPath('pick-mobile.png'), fullPage: true });

  await tab('Analysis');
  await page.getByText('Analysis', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze this sample', exact: true }).click();
  await page.getByText('What this sample says', { exact: true }).waitFor();
  await page.getByText('Best historical-profile fit', { exact: true }).waitFor();
  await page.getByText('Draw scatter', { exact: true }).waitFor();
  await page.getByText('Rolling frequency', { exact: true }).waitFor();
  await page.getByText('Absence and average gaps', { exact: true }).waitFor();
  const visibleCombination = page.locator('[aria-label^="Combination "]:visible').last();
  const firstCandidate = await visibleCombination.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Another', exact: true }).click();
  await page.waitForFunction(
    (previous) =>
      [...document.querySelectorAll('[aria-label^="Combination "]')]
        .filter((element) => element.getClientRects().length > 0)
        .some((element) => element.getAttribute('aria-label') !== previous),
    firstCandidate,
  );
  assert.notEqual(await visibleCombination.getAttribute('aria-label'), firstCandidate);

  await page.getByRole('tab', { name: 'Date range', exact: true }).click();
  const dates = page.getByPlaceholder('YYYY-MM-DD');
  await dates.nth(0).fill('2026-07-01');
  await dates.nth(1).fill('2026-08-05');
  await page.getByRole('button', { name: 'Analyze this sample', exact: true }).click();
  await page.getByText(/3D Lotto · \d+ draws?/).waitFor();
  await page.getByText(/For ages 18 and older\. Hot, cold/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: artifactPath('analysis-mobile.png'), fullPage: true });
  await page.getByText('Draw scatter', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: artifactPath('analysis-charts-mobile.png'), fullPage: true });
  await page.getByText('Absence and average gaps', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: artifactPath('analysis-gaps-mobile.png'), fullPage: true });

  const actionableErrors = browserErrors.filter(
    (message) => !message.includes('Access-Control-Allow-Origin') && !message.includes('Failed to fetch'),
  );
  if (actionableErrors.length) {
    throw new Error(`Browser console errors:\n${actionableErrors.join('\n')}`);
  }
  console.log('Results navigation, Pick cross-check, and latest/date Analysis flows passed.');
} finally {
  await browser.close();
}
