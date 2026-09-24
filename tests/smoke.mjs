export default async function (page, h) {
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForFunction(() => window.__smoke, null, { timeout: 60000 });
  h.log(JSON.stringify(await page.evaluate(() => window.__smoke)));
  await h.shot('smoke');
}
