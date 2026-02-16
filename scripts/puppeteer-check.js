const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const user = { id: 'dev-local-1', username: 'dev', full_name: 'Dev Local', is_admin: false };
  const outDir = path.join(__dirname, '..', 'tmp');
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Ensure localStorage contains a valid user before app JS runs
    await page.evaluateOnNewDocument((u) => {
      try { localStorage.setItem('rsq_user', u); } catch (e) { /* ignore */ }
    }, JSON.stringify(user));

    const url = 'http://localhost:3000/dashboard/filters';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for checkbox items to appear
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    console.log('Checkbox found, clicking first checkbox');
    await page.click('input[type="checkbox"]');

    // Wait for mobile toolbar to appear (it is hidden on md and up via md:hidden)
    // We just check for the fixed toolbar element
    await page.waitForSelector('.fixed.bottom-3', { timeout: 5000 });
    console.log('Bulk toolbar appeared');

    const screenshot = path.join(outDir, 'filters-selected.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log('Screenshot saved to', screenshot);

    // Click the Clear button to remove selection
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Clear');
      if (btn) btn.click();
    });

    // Wait for toolbar to disappear
    await page.waitForSelector('.fixed.bottom-3', { hidden: true, timeout: 5000 });
    console.log('Bulk toolbar dismissed after Clear');

    await browser.close();
    console.log('Puppeteer check completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Puppeteer check failed:', err);
    process.exit(2);
  }
})();
