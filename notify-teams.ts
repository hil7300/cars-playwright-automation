/**
 * Sends a Microsoft Teams notification with the results of the latest Playwright run.
 *
 * Reads:
 *   - playwright-report/report.json   (test stats)
 *
 * Posts:
 *   A JSON payload to the Workflow webhook URL.
 *   The webhook URL is sourced from (in order of priority):
 *     1. process.env.TEAMS_WEBHOOK_URL          (CI — GitHub Actions secret)
 *     2. credentials.json[<env>].TEAMS_WEBHOOK_URL   (local development)
 *
 *   The Power Automate flow on the other end posts the Adaptive Card to the Teams channel.
 *
 * Exits with code 0 on any failure so a broken notification never blocks the pipeline.
 */
import fs from 'fs';
import path from 'path';

// ─── Paths and env ───────────────────────────────────────────────────────
const REPORT_JSON = path.resolve('playwright-report', 'report.json');
const ENV = (process.env.ENV || 'dev').toLowerCase();
const ENV_LABEL = ENV.toUpperCase();
const GITHUB_RUN_URL = process.env.GITHUB_RUN_URL || '';

function softExit(message: string): never {
    console.warn(`⚠ ${message}`);
    process.exit(0);
}

/**
 * Resolves the Teams webhook URL. Lookup order (most specific wins):
 *   1. process.env.TEAMS_WEBHOOK_URL                  (CI / GitHub Secrets)
 *   2. credentials.json[<env>].TEAMS_WEBHOOK_URL      (per-env override, local)
 *   3. credentials.json.TEAMS_WEBHOOK_URL             (shared default, local)
 */
function resolveWebhookUrl(): string | undefined {
    if (process.env.TEAMS_WEBHOOK_URL) {
        return process.env.TEAMS_WEBHOOK_URL;
    }
    try {
        const credsPath = path.resolve('credentials.json');
        if (!fs.existsSync(credsPath)) return undefined;
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        return creds?.[ENV]?.TEAMS_WEBHOOK_URL ?? creds?.TEAMS_WEBHOOK_URL;
    } catch (err) {
        console.warn(`⚠ Could not read credentials.json: ${(err as Error).message}`);
        return undefined;
    }
}

const WEBHOOK_URL = resolveWebhookUrl();

if (!WEBHOOK_URL) {
    softExit(
        `TEAMS_WEBHOOK_URL not found in process.env, credentials.json["${ENV}"], or top-level credentials.json — skipping Teams notification.`,
    );
}
if (!fs.existsSync(REPORT_JSON)) {
    softExit(`${REPORT_JSON} not found — skipping Teams notification.`);
}

// ─── Types ───────────────────────────────────────────────────────────────
interface Stats {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
}

interface FailedTest {
    title: string;
    file: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
    if (!ms || ms < 1) return '0s';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
}

function walkSuitesForFailures(suites: any[]): FailedTest[] {
    const fails: FailedTest[] = [];
    for (const suite of suites || []) {
        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
                if (test.status === 'unexpected') {
                    fails.push({ title: spec.title, file: spec.file || suite.file || '' });
                }
            }
        }
        if (suite.suites) fails.push(...walkSuitesForFailures(suite.suites));
    }
    return fails;
}

// ─── Read run data ───────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));
const stats: Stats = raw.stats || ({} as Stats);

const passed = stats.expected || 0;
const failed = stats.unexpected || 0;
const flaky = stats.flaky || 0;
const skipped = stats.skipped || 0;
const total = passed + failed + flaky + skipped;

const fails = walkSuitesForFailures(raw.suites || []);
const topFails = fails.slice(0, 5);

const isHealthy = failed === 0 && flaky === 0;
const containerStyle = isHealthy ? 'good' : failed > 0 ? 'attention' : 'warning';
const banner = isHealthy
    ? `✅  ${ENV_LABEL} Regression — All Passed`
    : failed > 0
    ? `❌  ${ENV_LABEL} Regression — ${failed} Failure${failed === 1 ? '' : 's'}`
    : `⚠️  ${ENV_LABEL} Regression — ${flaky} Flaky`;

const runtimeText = formatDuration(stats.duration);
const startDate = stats.startTime
    ? new Date(stats.startTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
      })
    : new Date().toLocaleString();

// Plain-text snippet shown in Teams notification previews, activity feed, and mobile
const previewText = isHealthy
    ? `✅ ${ENV_LABEL} Regression: all ${total} tests passed`
    : failed > 0
    ? `❌ ${ENV_LABEL} Regression: ${failed} failed of ${total} (${passed} passed, ${flaky} flaky, ${skipped} skipped)`
    : `⚠️ ${ENV_LABEL} Regression: ${flaky} flaky of ${total} (${passed} passed)`;

// ─── Build Adaptive Card ─────────────────────────────────────────────────
function statColumn(label: string, num: number, color: string) {
    return {
        type: 'Column',
        width: 'stretch',
        items: [
            {
                type: 'TextBlock',
                text: label,
                size: 'small',
                isSubtle: true,
                weight: 'bolder',
                horizontalAlignment: 'center',
                wrap: true,
            },
            {
                type: 'TextBlock',
                text: String(num),
                size: 'extraLarge',
                weight: 'bolder',
                color,
                horizontalAlignment: 'center',
                spacing: 'small',
            },
        ],
    };
}

const body: any[] = [
    {
        type: 'Container',
        style: containerStyle,
        bleed: true,
        items: [
            {
                type: 'TextBlock',
                text: banner,
                weight: 'bolder',
                size: 'large',
                wrap: true,
            },
            {
                type: 'TextBlock',
                text: `${startDate}  ·  runtime ${runtimeText}`,
                isSubtle: true,
                spacing: 'none',
                wrap: true,
            },
        ],
    },
    {
        type: 'ColumnSet',
        spacing: 'Medium',
        columns: [
            statColumn('TOTAL', total, 'default'),
            statColumn('PASSED', passed, 'good'),
            statColumn('FAILED', failed, 'attention'),
            statColumn('FLAKY', flaky, 'warning'),
            statColumn('SKIPPED', skipped, 'default'),
        ],
    },
];

if (topFails.length > 0) {
    body.push({
        type: 'TextBlock',
        text: '**Failed tests**',
        wrap: true,
        spacing: 'Medium',
    });
    body.push({
        type: 'TextBlock',
        text: topFails.map((f) => `• ${f.title}`).join('\n\n'),
        wrap: true,
    });
    if (fails.length > topFails.length) {
        body.push({
            type: 'TextBlock',
            text: `… and ${fails.length - topFails.length} more — see the regression report for the full list.`,
            isSubtle: true,
            wrap: true,
        });
    }
}

const actions: any[] = [];
if (GITHUB_RUN_URL) {
    actions.push({
        type: 'Action.OpenUrl',
        title: 'View Run on GitHub',
        url: GITHUB_RUN_URL,
    });
}

const payload = {
    type: 'message',
    // `summary` and `text` give Teams a notification preview snippet so it doesn't
    // fall back to "Message has no preview" when only an Adaptive Card is attached.
    summary: previewText,
    text: previewText,
    attachments: [
        {
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body,
                actions,
            },
        },
    ],
};

// ─── POST to Teams Workflow ──────────────────────────────────────────────
async function send() {
    try {
        const res = await fetch(WEBHOOK_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '<no body>');
            console.error(`✕ Teams webhook returned ${res.status}: ${txt}`);
            process.exit(0);
        }
        console.log(`✓ Teams notification sent to ${ENV_LABEL} channel`);
        console.log(`  ${total} tests · ${passed} passed · ${failed} failed · ${flaky} flaky · ${skipped} skipped`);
    } catch (err) {
        console.error('✕ Teams notification failed:', err);
        process.exit(0);
    }
}

send();
