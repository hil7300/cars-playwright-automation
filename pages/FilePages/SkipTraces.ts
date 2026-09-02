import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';

export type SkipTraceType = 'POR' | 'POE' | 'Mobile (Phone)' | 'Work (Phone)' | 'Home (Phone)' | 'Other (Phone)';

export class SkipTraces extends FileHomePage {
    skip_trace_row_selector: string = '[data-cy="data-row"]';
    delete_skip_trace_icon_selector: string = '[class="w-4 ml-2 text-red-600 cursor-pointer"]';
    edit_skip_trace_icon_selector: string = '[class="w-4 ml-2 text-green-600 cursor-pointer"]';
    add_skip_trace_button: Locator;
    skip_trace_type_dropdown: Locator;
    skip_trace_party_dropdown: Locator;
    skip_trace_country_dropdown: Locator;
    skip_trace_province_dropdown: Locator;
    skip_trace_city_textbox: Locator;
    skip_trace_postal_code_textbox: Locator;
    skip_trace_street_textbox: Locator;
    skip_trace_phone_number_textbox: Locator;
    skip_trace_save_button: Locator;
    skip_trace_cancel_button: Locator;
    confirm_delete_button: Locator;
    change_status_dropdown: Locator;
    add_note_textbox: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.add_skip_trace_button = this.page.getByRole('button', { name: 'Add Skip Trace' });
        this.skip_trace_type_dropdown = this.page.locator('.select-type__indicator');
        this.skip_trace_party_dropdown = this.page.locator('.select-relatedPartyId__indicator');
        this.skip_trace_country_dropdown = this.page.locator('.select-country__indicator');
        this.skip_trace_province_dropdown = this.page.locator('.select-state__indicator');
        this.skip_trace_city_textbox = this.page.getByRole('textbox', { name: 'City' });
        this.skip_trace_postal_code_textbox = this.page.getByRole('textbox', { name: 'M1X 2N1' });
        this.skip_trace_street_textbox = this.page.getByRole('textbox', { name: 'Street name' });
        this.skip_trace_phone_number_textbox = this.page.getByRole('textbox', { name: 'Phone number' });
        this.skip_trace_save_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Save' });
        this.skip_trace_cancel_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Cancel' });
        this.confirm_delete_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Delete' });
        this.change_status_dropdown = this.page.locator('.select-status__indicator');
        this.add_note_textbox = this.page.getByRole('textbox', { name: 'Add Note' });
    }

    static async getInstance(page: Page) {
        const instance = new SkipTraces(page);
        await instance.initialize();
        return instance;
    }

    async createSkipTrace({
        type,
        phoneNumber = '4379726032',
        country = 'Canada',
        province = 'Ontario',
        city = 'Toronto',
        postalCode = 'M1X 2N1',
        street = '123 Skip Trace Ave',
    }: {
        type: SkipTraceType;
        phoneNumber?: string;
        country?: string;
        province?: string;
        city?: string;
        postalCode?: string;
        street?: string;
    }) {
        await expect(this.add_skip_trace_button).toBeVisible();
        await this.add_skip_trace_button.click();

        // 1. Select the Skip Trace Type
        await expect(this.skip_trace_type_dropdown).toBeVisible();
        await this.skip_trace_type_dropdown.click();
        const typeOption = this.page.getByRole('option', { name: type, exact: true });
        await expect(typeOption).toBeVisible();
        await typeOption.click();

        // 2. Select the Related Party (Always clicks the first available option)
        await expect(this.skip_trace_party_dropdown).toBeVisible();
        await this.skip_trace_party_dropdown.click();
        const firstPartyOption = this.page.getByRole('option').first();
        await expect(firstPartyOption).toBeVisible();
        await firstPartyOption.click();

        // 3. Conditional Data Entry
        const isPhoneType = type.includes('(Phone)');

        if (isPhoneType) {
            // Handle Phone fields
            await expect(this.skip_trace_phone_number_textbox).toBeVisible();
            await this.skip_trace_phone_number_textbox.fill(phoneNumber);
            await expect(this.skip_trace_country_dropdown).toBeHidden();
        } else {
            // Handle Address fields (POR, POE)
            await expect(this.skip_trace_country_dropdown).toBeVisible();
            await this.skip_trace_country_dropdown.click();
            await this.page.getByRole('option', { name: country, exact: true }).click();

            await expect(this.skip_trace_province_dropdown).toBeVisible();
            await this.skip_trace_province_dropdown.click();
            await this.page.getByRole('option', { name: province, exact: true }).click();

            await expect(this.skip_trace_city_textbox).toBeVisible();
            await this.skip_trace_city_textbox.fill(city);

            await expect(this.skip_trace_postal_code_textbox).toBeVisible();
            await this.skip_trace_postal_code_textbox.fill(postalCode);

            await expect(this.skip_trace_street_textbox).toBeVisible();
            await this.skip_trace_street_textbox.fill(street);
        }

        // 4. Save and verify modal closes
        await expect(this.skip_trace_save_button).toBeEnabled();
        await expect(this.skip_trace_cancel_button).toBeEnabled();
        await expect(this.skip_trace_save_button).toBeVisible();
        await expect(this.skip_trace_cancel_button).toBeVisible();
        await this.skip_trace_save_button.click();
        await expect(this.skip_trace_save_button).toBeHidden();
    }
}
