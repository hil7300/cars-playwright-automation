import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { get } from 'http';
import { getTodaysDate } from '../../helpers';

export class Documents extends FileHomePage {
    documents_table_selector: string = '[id="documents"]';
    document_row_selector: string = '[data-cy="data-row"]';
    upload_document_modal_selector: string = '[role="dialog"]';
    preview_document_icon_selector: string = '[clip-rule="evenodd"]';
    edit_document_icon_selector: string = '[name="Pencil"]';
    post_to_client_icon_selector: string = '[fill="currentColor"][class="w-4 cursor-pointer text-gray-400"]';
    delete_document_icon_selector: string = '[class="w-4 text-red-600 cursor-pointer"]';
    upload_document_button: Locator;

    document_type_dropdown: Locator;
    description_textbox: Locator;
    tracking_number_textbox: Locator;
    tracking_number_date_textbox: Locator;
    upload_button: Locator;
    cancel_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.upload_document_button = this.page.locator('[id="documents"]').locator('[role="presentation"]');
        this.document_type_dropdown = this.page.locator('.select-type__indicator');
        this.description_textbox = this.page.getByRole('textbox', { name: 'Description' });
        this.tracking_number_textbox = this.page.getByRole('textbox', { name: 'Tracking Number', exact: true });
        this.tracking_number_date_textbox = this.page.getByRole('textbox', {
            name: 'Tracking Number Date',
            exact: true,
        });
        this.upload_button = this.page.getByRole('button', { name: 'Upload' });
        this.cancel_button = this.page.locator('[role="dialog"]').getByRole('button', { name: 'Cancel' });
    }

    static async getInstance(page: Page) {
        const instance = new Documents(page);
        await instance.initialize();
        return instance;
    }

    async uploadDocument(fileType?: string | string[], description?: string, trackingNumber?: string) {
        let trackingDate = await getTodaysDate();
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.upload_document_button.click();

        const fileChooser = await fileChooserPromise;
        let filePath = path.join(__dirname, '../..', 'test-resources', 'test_invoice_1MB.pdf');

        if (!fs.existsSync(filePath)) {
            throw new Error(`Test file not found at: ${filePath}`);
        }
        await fileChooser.setFiles(filePath);

        let documentModal = this.page.locator(this.upload_document_modal_selector);
        await expect(documentModal).toBeVisible();

        const types = Array.isArray(fileType) ? fileType : [fileType || 'Other / Miscellaneous'];
        await this.document_type_dropdown.click();

        for (let i = 0; i < types.length; i++) {
            if (i > 0) {
                await this.document_type_dropdown.click();
            }

            const option = this.page.getByRole('option', { name: types[i], exact: true });
            await expect(option).toBeVisible();
            await option.click();
        }

        if (description) {
            await this.description_textbox.fill(description);
        }

        if (trackingNumber) {
            await this.tracking_number_textbox.fill(trackingNumber);
            await this.tracking_number_date_textbox.fill(trackingDate);
            await this.tracking_number_date_textbox.press('Tab');
        }

        await this.upload_button.click();
        await expect(documentModal).toBeHidden();
    }

    async getNumberofDocuments(): Promise<number> {
        let fileHomePage = await FileHomePage.getInstance(this.page);
        await expect(fileHomePage.documentsOption).toBeVisible();
        const documentsCountText = await fileHomePage.documentsOption.innerText();
        if (!documentsCountText) return 0;
        const match = documentsCountText.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }
}
