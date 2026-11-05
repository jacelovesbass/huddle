import { chromium } from 'playwright';
const URL = 'https://jacelovesbass.github.io/huddle/#3YH91';
const b = await chromium.launch();

const variants = {
  'opt-a-narrow.png': ':root { --column: 520px; }',
  'opt-b-flat.png': `
    :root { --column: 620px; }
    .row.mine { justify-content: flex-start; }
    .row.mine .bubble { background: var(--theirs); color: var(--text); }
    .row.mine .who { display: block; }
    .bubble { max-width: 100%; border-radius: 12px; }
    .chat main { gap: 2px; }
  `,
};

for (const [file, css] of Object.entries(variants)) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 500 } })).newPage();
  await p.goto(URL);
  await p.waitForSelector('.gate, .chat');
  if (await p.getByPlaceholder('Your name').isVisible().catch(() => false)) {
    await p.getByPlaceholder('Your name').fill('Jason');
    await p.getByRole('button', { name: 'Continue' }).click();
  }
  await p.waitForSelector('.chat main');
  await p.addStyleTag({ content: css });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: file });
  console.log(file);
}
await b.close();
