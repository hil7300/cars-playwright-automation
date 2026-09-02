import fs from 'fs';
import path from 'path';

const reportPath = path.join(__dirname, 'playwright-report', 'report.json');
const outputPath = path.join(__dirname, 'playwright-report', 'summary.txt'); // path to save summary

type TestStatus = 'passed' | 'failed' | 'skipped';

interface Test {
    results: { status: TestStatus }[];
}

interface Spec {
    tests: Test[];
}

interface Suite {
    specs?: Spec[];
    suites?: Suite[];
}

function collectTests(suites: Suite[], counts: Record<TestStatus, number>) {
    for (const suite of suites) {
        if (suite.specs) {
            for (const spec of suite.specs) {
                for (const test of spec.tests) {
                    // Only count the last result of each test (final outcome)
                    const finalResult = test.results[test.results.length - 1];
                    if (finalResult && finalResult.status) {
                        counts[finalResult.status] = (counts[finalResult.status] || 0) + 1;
                    }
                }
            }
        }

        if (suite.suites) {
            collectTests(suite.suites, counts);
        }
    }
}

function main() {
    const raw = fs.readFileSync(reportPath, 'utf-8');
    const json = JSON.parse(raw);

    const counts: Record<TestStatus, number> = {
        passed: 0,
        failed: 0,
        skipped: 0,
    };

    collectTests(json.suites, counts);

    const total = counts.passed + counts.failed + counts.skipped;

    const summary = `
Test Summary:

Passed: ${counts.passed}
Failed: ${counts.failed}
Skipped: ${counts.skipped}
Total: ${total}
`.trim();

    console.log('\n' + summary);

    // ✅ Write to summary.txt
    fs.writeFileSync(outputPath, summary);
}

main();
