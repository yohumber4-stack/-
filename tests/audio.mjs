export default async function (page, h) {
  h.log('Building audio test...');
  
  // Build the test entry
  await page.evaluate(async () => {
    // Will be bundled and injected
  });

  h.log('Navigating to test page...');
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audio System Test</title>
  <script src="file:///tmp/audio_test.js"></script>
</head>
<body style="margin:0;background:#1a1a1a;color:#fff;font-family:monospace">
  <div style="padding:20px">
    <h2>Audio System Test Running...</h2>
    <pre id="log"></pre>
  </div>
  <script>
    const logEl = document.getElementById('log');
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      logEl.textContent += args.join(' ') + '\\n';
      logEl.scrollTop = logEl.scrollHeight;
    };
    window.addEventListener('load', () => {
      setTimeout(() => {
        const report = window.__audioReport || { status: 'pending' };
        console.log('Final report:', JSON.stringify(report, null, 2));
      }, 2000);
    });
  </script>
</body>
</html>
  `;

  const tmpFile = '/tmp/audio_test.html';
  const fs = require('fs');
  fs.writeFileSync(tmpFile, testHtml);

  await page.goto('file://' + tmpFile, { waitUntil: 'networkidle' });
  
  h.log('Waiting for tests to complete...');
  await h.wait(3000);

  h.log('Checking results...');
  const report = await page.evaluate(() => window.__audioReport || {});
  console.log('Test Report:', JSON.stringify(report, null, 2));
  
  if (report.status === 'pass' && report.passed > 0) {
    h.log(`✓ Audio tests passed: ${report.passed}/${report.total}`);
  } else if (report.failed > 0) {
    h.log(`✗ Audio tests failed: ${report.failed} failures`);
    throw new Error(`Audio tests failed: ${report.failed}`);
  } else {
    h.log('Audio tests incomplete or error');
  }

  await h.shot('audio_test_result');
}
