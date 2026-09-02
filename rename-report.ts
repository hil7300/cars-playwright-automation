import { existsSync, renameSync } from 'fs';
import { join } from 'path';
import { exit } from 'process';

function getFormattedDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function renameAllureReportFile(): void {
    const date = getFormattedDate();
    const reportDir = join(__dirname, 'playwright-report', 'allure-report');
    const oldFile = join(reportDir, 'index.html');
    const newFile = join(reportDir, `SMOKE TEST RESULTS ${date}.html`);

    if (!existsSync(oldFile)) {
        throw new Error(`❌ index.html not found at: ${oldFile}`);
    }

    renameSync(oldFile, newFile);
}

renameAllureReportFile();
