import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';

export class Forms extends FileHomePage {
    form_preview_selector: string = '.border.border-solid';
    form_preview_signature_selector: string = 'img';
    generate_form_heading: Locator;
    open_form_options_dropdown: Locator;
    correct_form_checkbox: Locator;
    generate_form_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.generate_form_heading = this.page.getByRole('heading', { name: 'Generate form of type' });
        this.open_form_options_dropdown = this.page.locator('[id="forms"]').locator('.select__indicator');
        this.correct_form_checkbox = this.page.locator('[id="forms"]').locator('.chakra-checkbox__control');
        this.generate_form_button = this.page.locator('[id="forms"]').getByRole('button', { name: 'Generate PDF' });
    }

    static async getInstance(page: Page) {
        const instance = new Forms(page);
        await instance.initialize();
        return instance;
    }
}
