import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class MessagesPage {
    private page: Page;
    client_cell_selector: string = '[data-cy="Client"]';
    sender_cell_selector: string = '[data-cy="Sender"]';
    recipients_cell_selector: string = '[data-cy="Recipient(s)"]';
    new_message_counter_selector: string = '[data-cy="message-counter"]';
    messages_subject_cell_selector: string = '[data-cy="Subject"]';
    file_ref_id_cell_selector: string = '[data-cy="Ref #"]';
    messages_rows_selector: string = '[data-cy="data-row"]';
    actions_menu_option_dropdown: string = '[data-cy="Actions"]';
    note_modal_selector: string = '[id*="headlessui-dialog-panel"]';
    new_messages: Locator;
    my_archive: Locator;
    all_messages: Locator;
    companies_filter_option: Locator;
    sender_filter_option: Locator;
    recipients_filter_option: Locator;
    clear_all_filters: Locator;
    mark_as_read_for_all: Locator;
    mark_as_read: Locator;
    mark_as_unread_for_all: Locator;
    mark_as_unread: Locator;
    select_all_checkbox: Locator;
    next_page_button: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.new_messages = this.page.locator('[data-cy="filter-new-messages"]');
        this.my_archive = this.page.locator('[data-cy="filter-archive"]');
        this.all_messages = this.page.locator('[data-cy="filter-all-messages"]');
        this.companies_filter_option = this.page.getByRole('button', { name: 'Company' });
        this.sender_filter_option = this.page.getByRole('button', { name: 'Sender' });
        this.recipients_filter_option = this.page.getByRole('button', { name: 'Recipients' });
        this.clear_all_filters = this.page.getByRole('button', { name: 'Clear all' });
        this.mark_as_read_for_all = this.page.getByRole('button', { name: 'Mark as read for all' });
        this.mark_as_read = this.page.getByRole('button', { name: 'Mark as read', exact: true });
        this.mark_as_unread = this.page.getByRole('button', { name: 'Mark as unread', exact: true });
        this.mark_as_unread_for_all = this.page.getByRole('button', { name: 'Mark as unread for all', exact: true });
        this.select_all_checkbox = this.page.locator('[type="checkbox"][name="all"][id="all"]');
        this.next_page_button = this.page.locator('[aria-label="next page"]');
    }

    static async getInstance(page: Page) {
        const instance = new MessagesPage(page);
        await instance.initialize();
        return instance;
    }

    async selectOptionFromActionsMenu(
        messageRow: Locator,
        option: 'Reply message' | 'Mark as read' | 'Mark as read for all' | 'Mark as unread' | 'Mark as unread for all'
    ) {
        const menuOptionDropdown = messageRow.locator(this.actions_menu_option_dropdown);
        await expect(menuOptionDropdown).toBeVisible();
        await menuOptionDropdown.click();

        const targetOption = menuOptionDropdown.getByRole('menuitemradio', {
            name: option,
            exact: true,
        });
        await expect(targetOption).toBeVisible();
        await this.page.waitForTimeout(500); // Wait for any potential UI updates before clicking the option
        await targetOption.click();
    }
}
