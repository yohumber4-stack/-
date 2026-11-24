// Harness self-check: proves a browser binary was found and can open a page. No game, no WebGL.
// usage: node tests/run.mjs tests/harness.mjs
export default async function (page, h) {
  await page.setContent('<title>harness ok</title><p>ok</p>');
  const title = await page.title();
  if (title !== 'harness ok') throw new Error(`unexpected title: ${title}`);
  h.log('browser opened a page');
}
