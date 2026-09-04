import { defineConfig, devices } from '@playwright/test'

// The mobile profile is the freeze target: iPhone 13 geometry on Chromium.
// DPR 2 (not the device's 3) keeps goldens half the weight while still
// catching sub-pixel/hairline regressions.
const MOBILE = {
  ...devices['iPhone 13'],
  browserName: 'chromium',
  defaultBrowserType: undefined,
  deviceScaleFactor: 2,
}

export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // No {platform} token: goldens are rendered in the pinned Playwright Docker
  // image (see freeze:docker in package.json), which is also what CI runs, so
  // one set of Linux goldens serves both.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0, // mobile must be pixel-identical, so enforce exactly that
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'en-US',
    timezoneId: 'America/New_York', // todayIsoLocal() reads the device clock; pin it
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'mobile', testDir: './tests/e2e', testIgnore: '**/desktop/**', use: MOBILE },
    {
      name: 'desktop',
      testDir: './tests/e2e',
      grepInvert: /@mobileOnly/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    // Visual projects never retry: a flaky golden must surface, not be masked.
    {
      name: 'visual-light',
      testDir: './tests/visual',
      retries: 0,
      use: { ...MOBILE, colorScheme: 'light', reducedMotion: 'reduce' },
    },
    {
      name: 'visual-dark',
      testDir: './tests/visual',
      retries: 0,
      grep: /@dark/, // dark goldens are a subset: states where the palette does real work
      use: { ...MOBILE, colorScheme: 'dark', reducedMotion: 'reduce' },
    },
  ],
})
