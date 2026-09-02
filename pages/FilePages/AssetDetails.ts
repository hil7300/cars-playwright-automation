import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { APIServices } from '../../services/apiServices';

export class AssetDetails extends FileHomePage {
    toast_message_selector: string = '[class="chakra-toast"]';
    lien_holder_table_selector: string = '.table-container:has-text("Lien Holders")';
    lien_status_cell_selector: string = '[data-cy="Status"]';
    lien_release_statement_selector: string = '[data-cy="Release Statement"]';
    modal_selector: string = '[role="dialog"]';
    general_details_heading: Locator;
    request_VIN_search_button: Locator;
    request_BBV_at_assignment_button: Locator;
    request_CARFAX_report_button: Locator;
    asset_VIN_textbox: Locator;
    asset_year_dropdown: Locator;
    asset_car_make_dropdown: Locator;
    asset_car_model_dropdown: Locator;
    asset_car_trim_dropdown: Locator;
    asset_car_style_dropdown: Locator;
    asset_license_plate_textbox: Locator;
    asset_colour_textbox: Locator;
    asset_mileage_when_loan_was_funded_textbox: Locator;
    asset_black_book_value_at_assignment_textbox: Locator;
    asset_current_mileage_textbox: Locator;
    asset_details_save_button: Locator;
    asset_recalculate_Black_book_value_icon: Locator;

    request_lien_discharge_button: Locator;
    save_lien_discharge_button: Locator;

    lien_discharge_type_dropdown: Locator;
    lien_discharge_description_textbox: Locator;
    lien_discharge_upload_button: Locator;
    lien_discharge_cancel_button: Locator;
    choose_lien_file_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.general_details_heading = this.page.getByRole('heading', { name: 'General Details' });
        this.request_VIN_search_button = this.page.getByRole('button', { name: 'Request VIN Search' });
        this.request_BBV_at_assignment_button = this.page.getByRole('button', { name: 'Request BBV at Assignment' });
        this.request_CARFAX_report_button = this.page.getByRole('button', { name: 'Request CARFAX Report' });
        this.asset_VIN_textbox = this.page.getByRole('textbox', { name: 'VIN' });
        this.asset_year_dropdown = this.page.locator('.select-year__input-container');
        this.asset_car_make_dropdown = this.page.locator('.select-auMake__input-container');
        this.asset_car_model_dropdown = this.page.locator('.select-auModel__input-container');
        this.asset_car_trim_dropdown = this.page.locator('.select-auTrim__input-container');
        this.asset_car_style_dropdown = this.page.locator('.select-auStyle__input-container');
        this.asset_license_plate_textbox = this.page.getByRole('textbox', { name: 'License Plate' });
        this.asset_colour_textbox = this.page.getByRole('textbox', { name: 'Colour' });
        this.asset_mileage_when_loan_was_funded_textbox = this.page.getByRole('textbox', {
            name: 'Mileage when loan was funded',
        });
        this.asset_black_book_value_at_assignment_textbox = this.page.getByRole('textbox', {
            name: 'Black Book Value at Assignment',
        });
        this.asset_current_mileage_textbox = this.page.getByRole('textbox', { name: 'Current Mileage' });
        this.asset_details_save_button = this.page
            .locator('[id="asset_details"]')
            .getByRole('button', { name: 'Save' })
            .nth(1);
        this.asset_recalculate_Black_book_value_icon = this.page
            .locator('[id="asset_details"]')
            .locator('[class="ml-3 cursor-pointer"] > svg');

        this.request_lien_discharge_button = this.page.getByRole('button', { name: 'Request Lien Discharge' });
        this.save_lien_discharge_button = this.page
            .locator('[id="asset_details"]').locator('[class="flex gap-3 pl-4"]').filter({ hasText: 'Request Lien Discharge' })
            .getByRole('button', { name: 'Save' })

        this.lien_discharge_type_dropdown = this.page
            .locator(this.modal_selector)
            .filter({ hasText: 'Upload Release Statement' })
            .locator('.select-type__indicator');
        this.lien_discharge_description_textbox = this.page
            .locator(this.modal_selector)
            .filter({ hasText: 'Upload Release Statement' })
            .getByRole('textbox', { name: 'Description' });
        this.lien_discharge_upload_button = this.page
            .locator(this.modal_selector)
            .filter({ hasText: 'Upload Release Statement' })
            .getByRole('button', { name: 'Upload' });
        this.lien_discharge_cancel_button = this.page
            .locator(this.modal_selector)
            .filter({ hasText: 'Upload Release Statement' })
            .getByRole('button', { name: 'Cancel' });
        this.choose_lien_file_button = this.page
            .locator(this.modal_selector)
            .filter({ hasText: 'Upload Release Statement' })
            .getByRole('button', { name: 'Choose File' });
    }

    static async getInstance(page: Page) {
        const instance = new AssetDetails(page);
        await instance.initialize();
        return instance;
    }
    async confirmVinSearchCompleted(apiService: APIServices) {
        const timeout = 50000; // 50 seconds
        const startTime = Date.now();
        await this.page.waitForTimeout(20000); // Initial wait before starting to poll
        while (Date.now() - startTime < timeout) {
            await apiService.triggerVinSearchForAssetViaAPI();
            await this.page.reload();
            await this.page.waitForTimeout(1500); // Wait for 1.5 seconds before checking the button status
            await expect(this.request_VIN_search_button).toBeVisible();

            // Check if the button text contains 'Complete'
            const buttonText = await this.request_VIN_search_button.textContent();
            if (buttonText?.includes('Complete')) {
                return; // VIN search is complete, exit the loop
            }
        }

        // If we exhausted the loop, fail with a clear message
        throw new Error('VIN search did not complete within 50 seconds');
    }
}
