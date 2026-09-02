import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import * as path from 'path';
import * as fs from 'fs';

export interface ParsedEmail {
    id: string; // IMAP UID (stringified)
    from: string;
    to: string;
    subject: string;
    date: Date;
    textBody: string;
    htmlBody: string;
    snippet: string;
    links: string[];
}

interface GmailCredentials {
    user: string; // Full Gmail address
    appPassword: string; // 16-char App Password (NOT your real Gmail password)
}

export class GmailService {
    private user: string;
    private appPassword: string;

    private constructor(user: string, appPassword: string) {
        this.user = user;
        this.appPassword = appPassword;
    }

    // ─── Static Factory ───────────────────────────────────────────────────────

    /**
     * Creates a GmailService backed by Gmail IMAP + App Password.
     *
     * Prerequisites (one-time, takes ~2 minutes):
     *   1. Enable 2-Step Verification on the test Gmail account
     *      → https://myaccount.google.com/security
     *   2. Generate a 16-character App Password
     *      → https://myaccount.google.com/apppasswords
     *   3. Ensure IMAP is enabled in Gmail Settings → Forwarding and POP/IMAP
     *
     * @example
     * const gmail = await GmailService.create();
     */
    static async create(): Promise<GmailService> {
        const { user, appPassword } = GmailService.loadCredentials();
        return new GmailService(user, appPassword);
    }

    // ─── Private Credential Loader ────────────────────────────────────────────

    private static loadCredentials(): GmailCredentials {
        if (process.env.CI) {
            const required = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
            for (const key of required) {
                if (!process.env[key]) {
                    throw new Error(`Missing required env var: ${key}`);
                }
            }
            return {
                user: process.env.GMAIL_USER!,
                appPassword: process.env.GMAIL_APP_PASSWORD!,
            };
        }

        const credentialsPath = path.resolve(__dirname, '..', 'credentials.json');
        const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        if (!creds.gmail || !creds.gmail.user || !creds.gmail.appPassword) {
            throw new Error(
                'Gmail credentials missing in credentials.json — expected: ' +
                    '{ "gmail": { "user": "you@gmail.com", "appPassword": "xxxx xxxx xxxx xxxx" } }'
            );
        }
        return creds.gmail as GmailCredentials;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Generates a unique plus-addressed Gmail for parallel-safe testing.
     * All emails route to the same inbox but filter cleanly per test.
     *
     * @example
     * gmail.uniqueAddress('req') // → "yourtestaccount+req_ltz3k9a1@gmail.com"
     */
    uniqueAddress(tag: string = 'test'): string {
        const [local, domain] = this.user.split('@');
        const unique = `${tag}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        return `${local}+${unique}@${domain}`;
    }

    /**
     * Polls Gmail via IMAP until a message matching the filter arrives, or throws on timeout.
     * Use with a unique plus-addressed `to:` to isolate this test's email.
     */
    async waitForEmail({
        to,
        subject,
        from,
        timeoutMs = 120000,
        pollIntervalMs = 5000,
    }: {
        to: string;
        subject?: string;
        from?: string;
        timeoutMs?: number;
        pollIntervalMs?: number;
    }): Promise<ParsedEmail> {
        const start = Date.now();
        const since = new Date(Date.now() - 10 * 60 * 1000); // 10 min grace
        let attempts = 0;

        while (Date.now() - start < timeoutMs) {
            attempts++;
            const found = await this.searchOnce({ to, subject, from, since });
            if (found) {
                console.log(
                    `📧 Gmail: Found email after ${attempts} attempt(s) (${Math.round((Date.now() - start) / 1000)}s)`
                );
                return found;
            }
            await new Promise((r) => setTimeout(r, pollIntervalMs));
        }

        throw new Error(`Gmail: Timed out after ${timeoutMs}ms waiting for email to "${to}"`);
    }

    /**
     * Fetches all emails received within the given time window. Useful for debugging —
     * dumps the inbox so you can see what actually arrived vs. what the filter expected.
     */
    async listRecentEmails({
        sinceMinutes = 10,
        limit = 20,
    }: {
        sinceMinutes?: number;
        limit?: number;
    } = {}): Promise<ParsedEmail[]> {
        const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
        const client = this.newClient();
        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');
            try {
                const uids = await client.search({ since }, { uid: true });
                if (!uids || uids.length === 0) return [];

                const recent = uids.slice(-limit);
                const emails: ParsedEmail[] = [];
                for await (const msg of client.fetch(recent, { source: true }, { uid: true })) {
                    if (!msg.source) continue;
                    const parsed = await simpleParser(msg.source);
                    emails.push(GmailService.toParsedEmail(String(msg.uid), parsed));
                }
                return emails;
            } finally {
                lock.release();
            }
        } finally {
            try {
                await client.logout();
            } catch {
                /* ignore */
            }
        }
    }

    /**
     * Moves a message to Trash. Useful for afterEach cleanup.
     */
    async trashMessage(id: string): Promise<void> {
        const client = this.newClient();
        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');
            try {
                await client.messageMove(id, '[Gmail]/Trash', { uid: true });
            } finally {
                lock.release();
            }
        } catch (err) {
            console.warn(`Gmail: Failed to trash message ${id}`, err);
        } finally {
            try {
                await client.logout();
            } catch {
                /* ignore */
            }
        }
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private newClient(): ImapFlow {
        return new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: { user: this.user, pass: this.appPassword },
            logger: false,
        });
    }

    private async searchOnce({
        to,
        subject,
        from,
        since,
    }: {
        to: string;
        subject?: string;
        from?: string;
        since: Date;
    }): Promise<ParsedEmail | null> {
        const client = this.newClient();
        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');
            try {
                const criteria: Record<string, unknown> = { to, since };
                if (subject) criteria.subject = subject;
                if (from) criteria.from = from;

                const uids = await client.search(criteria, { uid: true });
                if (!uids || uids.length === 0) return null;

                const newestUid = uids[uids.length - 1];
                const msg = await client.fetchOne(String(newestUid), { source: true }, { uid: true });
                if (!msg || !msg.source) return null;

                const parsed = await simpleParser(msg.source);
                return GmailService.toParsedEmail(String(newestUid), parsed);
            } finally {
                lock.release();
            }
        } finally {
            try {
                await client.logout();
            } catch {
                /* ignore */
            }
        }
    }

    private static toParsedEmail(uid: string, parsed: ParsedMail): ParsedEmail {
        const textBody = parsed.text || '';
        const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';
        const linkRegex = /https?:\/\/[^\s"'<>)]+/g;
        const links = Array.from(new Set([...(textBody.match(linkRegex) || []), ...(htmlBody.match(linkRegex) || [])]));

        const toValue = Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(', ') : parsed.to?.text || '';

        return {
            id: uid,
            from: parsed.from?.text || '',
            to: toValue,
            subject: parsed.subject || '',
            date: parsed.date || new Date(),
            textBody,
            htmlBody,
            snippet: (textBody || htmlBody).slice(0, 200),
            links,
        };
    }
}
