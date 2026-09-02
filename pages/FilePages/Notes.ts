import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';

export class Notes extends FileHomePage {
    note_modal_selector: string = '[id*="headlessui-dialog-panel"]';
    notes_row_selector: string = '[class*="py-4 border-b border-cc-gray-100 last:border-b-0"]';
    post_to_client_icon_selector: string = '.css-1baulvz';
    pin_note_icon_selector: string = '.text-slate-300 > path';
    delete_note_icon_selector: string = '.ml-2.text-red-500 > path';
    reply_to_note_icon_selector: string = '[viewBox="0 0 16 16"] > path';
    template_row_selector: string = 'li [class*="p-4 cursor-pointer"]';
    add_note_button: Locator;
    send_to_dropdown: Locator;
    subject_textbox: Locator;
    content_textbox: Locator;
    pin_note_checkbox: Locator;
    mark_as_urgent_checkbox: Locator;
    send_email_checkbox: Locator;
    template_search_by_subject_textbox: Locator;
    send_note_button: Locator;
    reply_note_button: Locator;
    cancel_note_button: Locator;
    clear_note_button: Locator;

    summarize_notes_via_ai_button: Locator;

    note_template_search_textbox: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.add_note_button = this.page.getByRole('button', { name: 'Add Note' });
        this.subject_textbox = this.page.getByPlaceholder('Subject', { exact: true });
        this.send_to_dropdown = this.page
            .locator('[id="toUserIds"]')
            .locator('[class*="select__indicator select__dropdown-indicator"]');
        this.content_textbox = this.page.getByPlaceholder('Content');
        this.pin_note_checkbox = this.page
            .locator('[role="group"]')
            .filter({ hasText: 'Pin This Note' })
            .locator('[class*="chakra-checkbox border"]');
        this.mark_as_urgent_checkbox = this.page
            .locator('[role="group"]')
            .filter({ hasText: 'Mark as Urgent' })
            .locator('[class*="chakra-checkbox border"]');
        this.send_email_checkbox = this.page
            .locator('[role="group"]')
            .filter({ hasText: 'Send Email' })
            .locator('[class*="chakra-checkbox border"]');
        this.template_search_by_subject_textbox = this.page.getByPlaceholder('Search by subject');
        this.send_note_button = this.page.getByRole('button', { name: 'Send', exact: true });
        this.reply_note_button = this.page.getByRole('button', { name: 'Reply' });
        this.cancel_note_button = this.page.locator(this.note_modal_selector).getByRole('button', { name: 'Cancel' });
        this.clear_note_button = this.page.getByRole('button', { name: '[Clear Note]' });

        this.summarize_notes_via_ai_button = this.page.getByRole('button', { name: 'Summarize Notes with AI' });

        this.note_template_search_textbox = this.page.getByPlaceholder('Search by subject');
    }

    static async getInstance(page: Page) {
        const instance = new Notes(page);
        await instance.initialize();
        return instance;
    }

    async sendNote(
        sendTo: string | string[],
        subject: string = 'CARS Automation Note Subject',
        content: string = 'This is the content for the note made through automation',
        sendEmail: boolean = false
    ) {
        const sendNoteModal = this.page.locator(this.note_modal_selector);
        await expect(sendNoteModal).toBeVisible();

        await expect(this.send_to_dropdown).toBeVisible();

        const sendToList = Array.isArray(sendTo) ? sendTo : [sendTo];
        for (const recipient of sendToList) {
            await this.send_to_dropdown.click();
            const options = this.page.getByRole('option', { name: recipient });
            const count = await options.count();
            if (count === 0) {
                throw new Error(`No option found matching: "${recipient}"`);
            }
            for (let i = 0; i < count; i++) {
                if (i > 0) {
                    await this.send_to_dropdown.click();
                }
                await options.nth(i).click();
            }
        }

        await this.subject_textbox.fill(subject);
        await this.content_textbox.fill(content);
        if (sendEmail) {
            await expect(this.send_email_checkbox).toBeVisible();
            await this.send_email_checkbox.click();
        }

        await this.send_note_button.click();
        await expect(sendNoteModal).toBeHidden();
    }

    async getNumberOfNotes(): Promise<number> {
        let fileHomePage = await FileHomePage.getInstance(this.page);
        await expect(fileHomePage.notesOption).toBeVisible();
        const notesCountText = await fileHomePage.notesOption.innerText();
        if (!notesCountText) return 0;
        const match = notesCountText.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }
}
