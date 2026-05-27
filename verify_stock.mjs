import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const shot = async (name) => {
  const p = `C:/Users/juanj/AppData/Local/Temp/${name}.png`;
  await page.screenshot({ path: p });
  return p;
};

try {
  // 1. Login - get the login form fields
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1500);
  
  const inputs = await page.locator('input').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log(`input type=${type} name=${name} placeholder=${placeholder}`);
  }
  await shot('01_login');

} catch(e) {
  console.error('ERROR:', e.message);
  await shot('error');
}

await browser.close();
