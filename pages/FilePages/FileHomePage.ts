import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class FileHomePage {
    protected page: Page;

    assignmentOption: Locator;
    repoDetailsOption: Locator;
    assetDetailsOption: Locator;
    relatedPartiesOption: Locator;
    skipTracesOption: Locator;
    remarketingOption: Locator;
    otherRecoveriesOption: Locator;
    requestsOption: Locator;
    documentsOption: Locator;
    vendorInvoicesOption: Locator;
    formsOption: Locator;
    notesOption: Locator;
    accountingOption: Locator;
    fileSummarySection: Locator;
    fileNotesSection: Locator;
    fileAuditLogSection: Locator;
    file_stage_dropdown: Locator;
    file_status_dropdown: Locator;
    summary_details_heading: Locator;

    protected constructor(page: Page) {
        this.page = page;
    }

    protected async initialize() {
        this.assignmentOption = this.page.locator('[id="sidebar-left-assignments-button"]');
        this.repoDetailsOption = this.page.locator('[id="sidebar-left-repossession-button"]');
        this.assetDetailsOption = this.page.locator('[id="sidebar-left-asset-details-button"]');
        this.relatedPartiesOption = this.page.locator('[id="sidebar-left-related-parties-button"]');
        this.skipTracesOption = this.page.locator('[id="sidebar-left-skip-traces-button"]');
        this.remarketingOption = this.page.locator('[id="sidebar-left-remarketing-details-button"]');
        this.otherRecoveriesOption = this.page.locator('[id="sidebar-left-other-recoveries-button"]');
        this.requestsOption = this.page.locator('[id="sidebar-left-requests-button"]');
        this.documentsOption = this.page.locator('[id="sidebar-left-documents-button"]');
        this.vendorInvoicesOption = this.page.locator('[id="sidebar-left-vendor-invoices-button"]');
        this.formsOption = this.page.locator('[id="sidebar-left-forms-button"]');
        this.notesOption = this.page.locator('[id="sidebar-left-notes-button"]');
        this.accountingOption = this.page.locator('[id="sidebar-left-accounting-button"]');
        this.fileSummarySection = this.page.getByRole('button', { name: 'Summary', exact: true });
        this.fileNotesSection = this.page.getByRole('button', { name: 'Notes' }).nth(3);
        this.fileAuditLogSection = this.page.getByRole('button', { name: 'Audit Log' });
        this.file_stage_dropdown = this.page.locator('.select-stageId__indicator');
        this.file_status_dropdown = this.page.locator('.select-statusId__indicator');
        this.summary_details_heading = this.page.getByRole('heading', { name: 'Summary Details' });
    }

    static async getInstance(page: Page) {
        const instance = new FileHomePage(page);
        await instance.initialize();
        return instance;
    }
}
