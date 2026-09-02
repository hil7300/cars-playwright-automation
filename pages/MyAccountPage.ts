import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class MyAccountPage {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {}

    static async getInstance(page: Page) {
        const instance = new MyAccountPage(page);
        await instance.initialize();
        return instance;
    }
}
