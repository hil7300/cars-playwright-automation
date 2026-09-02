/**
 * Generates a business-friendly regression report from Playwright's JSON output.
 *
 * Reads:  playwright-report/report.json
 * Writes: playwright-report/regression-report.html
 *
 * Output is a single self-contained HTML file (CSS + JS + screenshots inlined as
 * base64) so it can be emailed as an attachment or opened from disk anywhere.
 *
 * Run via:
 *   npm run regression-report
 */
import fs from 'fs';
import path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────
const REPORT_JSON = path.resolve('playwright-report', 'report.json');
const OUTPUT_HTML = path.resolve('playwright-report', 'regression-report.html');

// ─── Types ────────────────────────────────────────────────────────────────
interface FlatStep {
    title: string;
    duration: number;
    failed: boolean;
    children: FlatStep[];
}

interface FlatTest {
    area: string;
    file: string;
    title: string;
    status: 'passed' | 'failed' | 'flaky' | 'skipped';
    duration: number;
    steps: FlatStep[];
    errorMessage?: string;
    screenshot?: string; // base64 data URI
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Strip ANSI color escape codes that Playwright leaves in error messages. */
const stripAnsi = (s: string = ''): string => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[\d+m/g, '');

/** Format milliseconds as a human-readable duration: "1m 23s", "5.2s", "850ms". */
function formatDuration(ms: number): string {
    if (!ms || ms < 1) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const rs = Math.round(s % 60);
    return `${m}m ${rs}s`;
}

/** HTML-escape user-controlled strings so they don't break the layout or inject markup. */
function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Extract a business-area display name from a spec file path.
 * Examples:
 *   FileTests/AccountingTests/Foo.spec.ts -> "Accounting"
 *   ReportsPage/Bar.spec.ts                -> "Reports"
 *   CompaniesPage/Baz.spec.ts              -> "Companies"
 *   SettingsPage/MessagesTab/Qux.spec.ts   -> "Settings"
 */
function getBusinessArea(file: string): string {
    const parts = file.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts[0] === 'FileTests' && parts[1]) {
        return parts[1]
            .replace(/Tests$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
    }
    return (parts[0] || 'Other')
        .replace(/Page$/, '')
        .replace(/Tab$/, '')
        .replace(/([A-Z])/g, ' $1')
        .trim();
}

/** Read a screenshot file from disk and return a base64 data URI. */
function readScreenshotAsBase64(filePath: string): string | undefined {
    try {
        const buf = fs.readFileSync(filePath);
        return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
        return undefined;
    }
}

/** Recursively flatten the Playwright step tree into our own structure. */
function flattenSteps(steps: any[] = []): FlatStep[] {
    return steps
        .filter((s) => s && s.title)
        .map((s) => ({
            title: s.title,
            duration: s.duration || 0,
            failed: !!s.error,
            children: flattenSteps(s.steps),
        }));
}

/** Walk Playwright's nested suite tree and return a flat list of tests. */
function walkSuites(suites: any[] = []): FlatTest[] {
    const out: FlatTest[] = [];
    for (const suite of suites) {
        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
                const result = test.results?.[test.results.length - 1];
                if (!result) continue;

                let status: FlatTest['status'] = 'passed';
                if (test.status === 'unexpected') status = 'failed';
                else if (test.status === 'flaky') status = 'flaky';
                else if (test.status === 'skipped' || result.status === 'skipped') status = 'skipped';

                let screenshot: string | undefined;
                if (status === 'failed') {
                    const shot = (result.attachments || []).find((a: any) => a.name === 'screenshot');
                    if (shot?.path) screenshot = readScreenshotAsBase64(shot.path);
                }

                out.push({
                    area: getBusinessArea(spec.file || suite.file || ''),
                    file: spec.file || suite.file || '',
                    title: spec.title,
                    status,
                    duration: result.duration || 0,
                    steps: flattenSteps(result.steps),
                    errorMessage: stripAnsi(result.error?.message || '').trim(),
                    screenshot,
                });
            }
        }
        if (suite.suites) {
            out.push(...walkSuites(suite.suites));
        }
    }
    return out;
}

// ─── Renderers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<FlatTest['status'], string> = {
    passed: 'Passed',
    failed: 'Failed',
    flaky: 'Flaky',
    skipped: 'Skipped',
};

const STATUS_ICON: Record<FlatTest['status'], string> = {
    passed: '✓',
    failed: '✕',
    flaky: '!',
    skipped: '∅',
};

function renderStep(step: FlatStep, depth: number = 0): string {
    const cls = step.failed ? 'step failed' : 'step';
    const icon = step.failed ? '✕' : '✓';
    const indentPx = 56 + depth * 24;
    return `
        <div class="${cls}" style="padding-left:${indentPx}px">
            <span class="check">${icon}</span>
            <span class="desc">${escapeHtml(step.title)}</span>
            <span class="dur">${formatDuration(step.duration)}</span>
        </div>${(step.children || []).map((c) => renderStep(c, depth + 1)).join('')}`;
}

function renderTest(test: FlatTest): string {
    const isFailed = test.status === 'failed';
    const isFlaky = test.status === 'flaky';
    const openAttr = isFailed || isFlaky ? 'open' : '';

    let body = '';

    if (isFailed && test.errorMessage) {
        body += `<div class="error-block">${escapeHtml(test.errorMessage)}</div>`;
    }

    if (isFailed && test.screenshot) {
        body += `
            <div class="screenshot-wrap">
                <div class="screenshot-label">SCREENSHOT AT FAILURE</div>
                <img src="${test.screenshot}" alt="Failure screenshot" />
            </div>`;
    }

    body += test.steps.map((s) => renderStep(s)).join('');

    return `
        <details ${openAttr} data-status="${test.status}" data-test-name="${escapeHtml(test.title.toLowerCase())}">
            <summary>
                <span class="chevron">▶</span>
                <span class="status-icon ${test.status}">${STATUS_ICON[test.status]}</span>
                <span class="test-name">${escapeHtml(test.title)}</span>
                <span class="test-meta">
                    <span>${escapeHtml(path.basename(test.file).replace(/\.spec\.ts$/, ''))}</span>
                    <span>${formatDuration(test.duration)}</span>
                </span>
            </summary>
            <div class="steps">${body}</div>
        </details>`;
}

function renderAreaGroup(area: string, tests: FlatTest[]): string {
    const passed = tests.filter((t) => t.status === 'passed').length;
    const total = tests.length;
    const allPass = passed === total;
    const subtitle = allPass
        ? `${passed} / ${total} PASSED`
        : `${passed} / ${total} PASSED · ${total - passed} ATTENTION`;

    return `
        <div class="area-group" data-area="${escapeHtml(area.toLowerCase())}">
            <div class="group-header">${escapeHtml(area)} · ${subtitle}</div>
            ${tests.map(renderTest).join('')}
        </div>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function generate(): void {
    if (!fs.existsSync(REPORT_JSON)) {
        console.error(`✕ Report JSON not found at ${REPORT_JSON}`);
        console.error(`  Run \`npx playwright test\` first.`);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));
    const tests = walkSuites(raw.suites || []);

    // Counts
    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed').length;
    const flaky = tests.filter((t) => t.status === 'flaky').length;
    const skipped = tests.filter((t) => t.status === 'skipped').length;
    const total = tests.length;

    // Group by business area, sort areas with failures first
    const areaMap = new Map<string, FlatTest[]>();
    for (const t of tests) {
        const list = areaMap.get(t.area) || [];
        list.push(t);
        areaMap.set(t.area, list);
    }
    const sortedAreas = [...areaMap.entries()].sort(([, a], [, b]) => {
        const aFails = a.filter((t) => t.status !== 'passed').length;
        const bFails = b.filter((t) => t.status !== 'passed').length;
        return bFails - aFails || a[0].title.localeCompare(b[0].title);
    });

    // Run metadata
    const startTime = new Date(raw.stats?.startTime || Date.now());
    const totalDuration = raw.stats?.duration || 0;
    const env = process.env.ENV || 'dev';
    const runDate = startTime.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    // ─── HTML ──────────────────────────────────────────────────────────
    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>CARS Regression Report — ${escapeHtml(runDate)}</title>
    <style>
        * { box-sizing: border-box; }
        :root {
            --bg: #0D1117;
            --card-bg: #161B22;
            --row-hover: #1C2128;
            --row-open: #1C2128;
            --border: #30363D;
            --border-soft: #21262D;
            --text: #E6EDF3;
            --text-muted: #8B949E;
            --code-bg: #1C2128;
            --pass: #3FB950;
            --pass-bg: #0D2416;
            --fail: #F85149;
            --fail-bg: #2A0D0D;
            --fail-border: #5C1A1A;
            --flaky: #D29922;
            --flaky-bg: #2A1F00;
            --skip: #8B949E;
            --skip-bg: #1C2128;
        }
        body {
            margin: 0; background: var(--bg); color: var(--text);
            font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
            line-height: 1.5; font-size: 14px;
        }
        .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }

        header {
            background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;
            padding: 20px 24px; margin-bottom: 16px;
        }
        header .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        header h1 { margin: 0; font-size: 20px; font-weight: 600; color: var(--text); }
        header .meta { color: var(--text-muted); font-size: 13px; }
        header .meta code { background: var(--code-bg); color: var(--text); padding: 1px 6px; border-radius: 3px; font-size: 12px; border: 1px solid var(--border); }

        .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
        .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px 18px; }
        .card .label { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .card .num { font-size: 28px; font-weight: 700; line-height: 1; color: var(--text); }
        .card.passed .num { color: var(--pass); }
        .card.failed .num { color: var(--fail); }
        .card.flaky .num { color: var(--flaky); }
        .card.skipped .num { color: var(--skip); }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .dot.passed { background: var(--pass); }
        .dot.failed { background: var(--fail); }
        .dot.flaky { background: var(--flaky); }
        .dot.skipped { background: var(--skip); }

        .filter-bar {
            background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;
            padding: 10px 16px; display: flex; gap: 8px; margin-bottom: 16px; align-items: center; flex-wrap: wrap;
        }
        .filter-bar .label { font-size: 12px; color: var(--text-muted); margin-right: 4px; }
        .pill {
            font-size: 12px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border);
            background: var(--card-bg); color: var(--text); cursor: pointer; font-weight: 500; user-select: none;
        }
        .pill:hover { background: var(--row-hover); }
        .pill.active { background: var(--text); color: var(--bg); border-color: var(--text); }
        .pill .count { color: var(--text-muted); margin-left: 4px; }
        .pill.active .count { color: rgba(13,17,23,0.6); }
        .search {
            margin-left: auto; padding: 6px 12px; font-size: 13px; border: 1px solid var(--border);
            border-radius: 6px; min-width: 220px; outline: none;
            background: var(--bg); color: var(--text);
        }
        .search::placeholder { color: var(--text-muted); }
        .search:focus { border-color: var(--text); }

        .test-list { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .group-header {
            background: var(--bg); border-bottom: 1px solid var(--border);
            padding: 10px 20px; font-size: 12px; font-weight: 600; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        details { border-bottom: 1px solid var(--border-soft); }
        details:last-child { border-bottom: none; }
        details > summary {
            list-style: none; cursor: pointer; padding: 12px 20px;
            display: flex; align-items: center; gap: 12px; user-select: none;
        }
        details > summary::-webkit-details-marker { display: none; }
        details > summary:hover { background: var(--row-hover); }
        details[open] > summary { background: var(--row-open); border-bottom: 1px solid var(--border-soft); }

        .chevron { width: 12px; color: var(--text-muted); font-size: 10px; transition: transform 0.15s; }
        details[open] > summary .chevron { transform: rotate(90deg); }

        .status-icon {
            width: 16px; height: 16px; border-radius: 50%; display: inline-flex;
            align-items: center; justify-content: center; font-size: 10px;
            color: #FFFFFF; font-weight: 700; flex-shrink: 0;
        }
        .status-icon.passed { background: var(--pass); }
        .status-icon.failed { background: var(--fail); }
        .status-icon.flaky { background: var(--flaky); color: #1F2328; }
        .status-icon.skipped { background: var(--skip); }

        .test-name { flex: 1; font-size: 14px; font-weight: 500; color: var(--text); }
        .test-meta { display: flex; align-items: center; gap: 16px; color: var(--text-muted); font-size: 12px; }

        .steps { padding: 8px 0; background: var(--bg); }
        .step {
            display: flex; align-items: flex-start; gap: 10px; padding: 6px 24px 6px 56px;
            font-size: 13px; position: relative;
        }
        .step:hover { background: var(--row-hover); }
        .step .check { color: var(--pass); font-weight: 700; flex-shrink: 0; width: 14px; }
        .step.failed .check { color: var(--fail); }
        .step .desc { flex: 1; color: var(--text); }
        .step .dur { color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }

        .error-block {
            margin: 10px 24px 10px 56px; padding: 12px 16px;
            background: var(--fail-bg); border: 1px solid var(--fail-border); border-left: 3px solid var(--fail);
            border-radius: 6px; font-family: 'SF Mono', Consolas, monospace;
            font-size: 12px; color: var(--fail); white-space: pre-wrap; line-height: 1.5;
        }

        .screenshot-wrap {
            margin: 10px 24px 14px 56px;
            padding: 12px;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
        }
        .screenshot-label {
            font-size: 10px; letter-spacing: 1px; color: var(--text-muted);
            font-weight: 600; margin-bottom: 8px;
        }
        .screenshot-wrap img {
            max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 4px; display: block;
        }

        .area-group.hidden, details.hidden { display: none; }

        footer { text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px 0; }
        footer a { color: #58A6FF; text-decoration: none; }

        .empty-state {
            padding: 48px 24px; text-align: center; color: var(--text-muted); font-size: 14px;
        }
    </style>
</head>
<body>
<div class="wrap">

    <header>
        <div class="top">
            <h1>CARS Regression Report</h1>
            <div class="meta" style="font-size:12px;">Generated ${escapeHtml(new Date().toLocaleString())}</div>
        </div>
        <div class="meta">
            ${escapeHtml(runDate)} · <code>${escapeHtml(env)}</code> · runtime ${formatDuration(totalDuration)}
        </div>
    </header>

    <div class="cards">
        <div class="card"><div class="label">Total</div><div class="num">${total}</div></div>
        <div class="card passed"><div class="label"><span class="dot passed"></span>Passed</div><div class="num">${passed}</div></div>
        <div class="card failed"><div class="label"><span class="dot failed"></span>Failed</div><div class="num">${failed}</div></div>
        <div class="card flaky"><div class="label"><span class="dot flaky"></span>Flaky</div><div class="num">${flaky}</div></div>
        <div class="card skipped"><div class="label"><span class="dot skipped"></span>Skipped</div><div class="num">${skipped}</div></div>
    </div>

    <div class="filter-bar">
        <span class="label">Show:</span>
        <span class="pill active" data-filter="all">All <span class="count">${total}</span></span>
        <span class="pill" data-filter="failed">Failed <span class="count">${failed}</span></span>
        <span class="pill" data-filter="passed">Passed <span class="count">${passed}</span></span>
        <span class="pill" data-filter="flaky">Flaky <span class="count">${flaky}</span></span>
        <span class="pill" data-filter="skipped">Skipped <span class="count">${skipped}</span></span>
        <input type="text" class="search" placeholder="Search test name…" id="searchInput" />
    </div>

    <div class="test-list" id="testList">
        ${sortedAreas.map(([area, areaTests]) => renderAreaGroup(area, areaTests)).join('')}
    </div>

    <div class="empty-state" id="emptyState" style="display:none;">No tests match the current filter.</div>

    <footer>
        Generated automatically after the regression run · For full traces, see the Allure report.
    </footer>

</div>

<script>
(function () {
    var pills = document.querySelectorAll('.pill[data-filter]');
    var search = document.getElementById('searchInput');
    var testList = document.getElementById('testList');
    var emptyState = document.getElementById('emptyState');
    var activeFilter = 'all';

    function applyFilters() {
        var query = (search.value || '').trim().toLowerCase();
        var visibleAny = false;

        var groups = testList.querySelectorAll('.area-group');
        groups.forEach(function (group) {
            var tests = group.querySelectorAll('details');
            var visibleInGroup = 0;

            tests.forEach(function (det) {
                var status = det.getAttribute('data-status');
                var name = det.getAttribute('data-test-name') || '';
                var matchesFilter = activeFilter === 'all' || status === activeFilter;
                var matchesSearch = !query || name.indexOf(query) !== -1;
                var visible = matchesFilter && matchesSearch;

                if (visible) {
                    det.classList.remove('hidden');
                    visibleInGroup++;
                } else {
                    det.classList.add('hidden');
                }
            });

            if (visibleInGroup === 0) {
                group.classList.add('hidden');
            } else {
                group.classList.remove('hidden');
                visibleAny = true;
            }
        });

        emptyState.style.display = visibleAny ? 'none' : 'block';
        testList.style.display = visibleAny ? 'block' : 'none';
    }

    pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            pills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');
            activeFilter = pill.getAttribute('data-filter');
            applyFilters();
        });
    });

    search.addEventListener('input', applyFilters);
})();
</script>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');

    const sizeMb = (fs.statSync(OUTPUT_HTML).size / 1024 / 1024).toFixed(2);
    console.log(`✓ Regression report written: ${OUTPUT_HTML}`);
    console.log(`  ${total} tests · ${passed} passed · ${failed} failed · ${flaky} flaky · ${skipped} skipped`);
    console.log(`  File size: ${sizeMb} MB`);
}

generate();
