import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/* Local runs the full stack (api + web + mongo) on one machine — give everything more headroom. */
const isLocal = process.env.ENV === 'local';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests',
    timeout: isLocal ? 90 * 1000 : 45 * 1000,

    /* Maximum time expect() should wait for the condition to be met. */
    expect: {
        timeout: isLocal ? 15000 : 5000,
    },
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 1,
    /* Run in parallel on CI — matches the 3 worker-keyed credential sets provisioned per role. */
    workers: process.env.CI ? 3 : 1,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [['html'], ['allure-playwright'], ['json', { outputFile: 'playwright-report/report.json' }]],
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        launchOptions: {
            // slowMo: 2000
        },
        /* Base URL to use in actions like `await page.goto('/')`. */
        // baseURL: 'http://127.0.0.1:3000',

        /* Slower local stack: widen action/navigation waits (0 = Playwright default elsewhere). */
        actionTimeout: isLocal ? 30000 : 0,
        navigationTimeout: isLocal ? 60000 : 0,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                deviceScaleFactor: undefined,
                headless: process.env.HEADLESS === 'true' ? true : false,
                viewport: { width: 1920, height: 1080 }, // Explicit Full HD size
                acceptDownloads: true,
                video: 'off',
                permissions: ['clipboard-read', 'clipboard-write'],
                launchOptions: {
                    args: [
                        '--start-maximized',
                        '--disable-infobars', // optional: hides "Chrome is being controlled" bar
                        '--disable-pdf-extension-viewer=false',
                        '--disable-features=PdfViewerUpdate,PDFViewer',
                    ],
                },
            },
        },

        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },

        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },

        /* Test against mobile viewports. */
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] },
        // },
        // {
        //   name: 'Mobile Safari',
        //   use: { ...devices['iPhone 12'] },
        // },

        /* Test against branded browsers. */
        // {
        //   name: 'Microsoft Edge',
        //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
        // },
        // {
        //   name: 'Google Chrome',
        //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        // },
    ],

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://127.0.0.1:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
