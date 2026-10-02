// @ts-check
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.e2e\.js/,
  timeout: 60000,
  use: { launchOptions: { executablePath: process.env.PW_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) }, baseURL: process.env.B || 'http://127.0.0.1:8090', screenshot: 'only-on-failure' },
  outputDir: './test-results',
});
