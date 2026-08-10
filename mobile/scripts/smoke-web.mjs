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
  await page.getByText('Results', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Previous result date', exact: true }).click();
  await page.getByRole('button', { name: 'Next result date', exact: true }).click();
  await page.screenshot({ path: artifactPath('results-mobile.png'), fullPage: true });

  await tab('Pick');
  await page.getByText('Saved picks', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add a game', exact: true }).waitFor();
  await page.screenshot({ path: artifactPath('pick-mobile.png'), fullPage: true });

  await tab('Analysis');
  await page.getByText('Latest 10 draws', { exact: true }).waitFor();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await page.getByRole('button', { name: /^Number frequency\./ }).waitFor();
  await page.screenshot({ path: artifactPath('analysis-mobile.png'), fullPage: true });

  await page.getByRole('button', { name: /^Number frequency\./ }).click();
  await page.getByText('Every number', { exact: true }).waitFor();
  await page.screenshot({ path: artifactPath('analysis-frequency-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to analysis', exact: true }).click();

  await page.getByRole('button', { name: /^Number chart\./ }).click();
  await page.getByText('Draws shown', { exact: true }).waitFor();
  await page.screenshot({ path: artifactPath('analysis-charts-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to analysis', exact: true }).click();

  await page.getByRole('button', { name: /^Last seen and gaps\./ }).click();
  await page.getByText('Every number', { exact: true }).waitFor();
  await page.screenshot({ path: artifactPath('analysis-gaps-mobile.png'), fullPage: true });

  const actionableErrors = browserErrors.filter(
    (message) => !message.includes('Access-Control-Allow-Origin') && !message.includes('Failed to fetch'),
  );
  if (actionableErrors.length) {
    throw new Error(`Browser console errors:\n${actionableErrors.join('\n')}`);
  }
  console.log('Results navigation, Pick screen, and fixed latest-10 Analysis findings passed.');
} finally {
  await browser.close();
}
