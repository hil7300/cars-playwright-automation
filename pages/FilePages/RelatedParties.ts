import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { APIServices } from '../../services/apiServices';

export class RelatedParties extends FileHomePage {
    related_party_card_selector: string =
        '[id="related_parties"] > [class="p-4 border-b border-cc-gray-75"] > [class="flex flex-col space-y-4 py-4"] > [class="rounded-lg border border-cc-gray-75"]';
    toast_message_selector: string = '[class="chakra-toast"]';
    add_related_party_button: Locator;
    request_ppsa_search_button: Locator;
    edit_related_party_icon: Locator;
    delete_related_party_icon: Locator;
    edit_first_name_textbox: Locator;
    edit_last_name_textbox: Locator;
    edit_country_dropdown: Locator;
    edit_province_dropdown: Locator;
    edit_street_1_textbox: Locator;
    edit_city_textbox: Locator;
    edit_postal_code_textbox: Locator;
    save_changes_button: Locator;
    cancel_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.add_related_party_button = this.page.getByRole('button', { name: 'Add Related Party' });
        this.request_ppsa_search_button = this.page.getByRole('button', { name: 'Request PPSA Search' });
        this.edit_related_party_icon = this.page.locator('[class="btn-icon green"]');
        this.delete_related_party_icon = this.page.locator('[id="related_parties"]').locator('[class="btn-icon red"]');
        this.edit_first_name_textbox = this.page.getByRole('textbox', { name: 'First Name' });
        this.edit_last_name_textbox = this.page.getByRole('textbox', { name: 'Last Name' });
        this.edit_country_dropdown = this.page.locator('.select-country__indicator');
        this.edit_province_dropdown = this.page.locator('.select-state__indicator');
        this.edit_street_1_textbox = this.page.getByRole('textbox', { name: 'Street name' });
        this.edit_city_textbox = this.page.getByRole('textbox', { name: 'City' });
        this.edit_postal_code_textbox = this.page.getByRole('textbox', { name: 'M1X 2N1' });
        this.save_changes_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .filter({ hasText: 'Edit Related Party' })
            .getByRole('button', { name: 'Save' });
        this.cancel_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .filter({ hasText: 'Edit Related Party' })
            .getByRole('button', { name: 'Cancel' });
    }

    static async getInstance(page: Page) {
        const instance = new RelatedParties(page);
        await instance.initialize();
        return instance;
    }

    async confirmPPSASearchCompleted(apiService: APIServices) {
        const timeout = 45000; // 45 seconds
        const startTime = Date.now();
        await this.page.waitForTimeout(15000); // Initial wait before starting to poll
        let primaryDebtorCard = this.page.locator(this.related_party_card_selector).filter({ hasText: 'Primary' });
        while (Date.now() - startTime < timeout) {
            await apiService.triggerPpsaSearchForAsset();
            await this.page.reload();
            await this.page.waitForTimeout(500);
            await expect(primaryDebtorCard.locator(this.request_ppsa_search_button)).toBeVisible();

            // Check if the button text contains 'Complete'
            const buttonText = await primaryDebtorCard.locator(this.request_ppsa_search_button).textContent();
            if (buttonText?.includes('Complete')) {
                return; // PPSA search is complete, exit the loop
            }
        }

        // If we exhausted the loop, fail with a clear message
        throw new Error('PPSA search did not complete within 45 seconds');
    }
}
