/**
 * Tags Auth0 users with `app_metadata.test_account = true` so the "MAF rules"
 * post-login Action skips MFA for them.
 *
 * Reads emails from `automation-accounts.txt` at the repo root.
 *
 * Required env vars:
 *   AUTH0_DOMAIN          e.g. cancap-dev.us.auth0.com
 *   AUTH0_M2M_CLIENT_ID   Client ID of the M2M app authorized for Auth0 Management API
 *   AUTH0_M2M_CLIENT_SECRET
 *
 * Required M2M scopes: read:users, update:users
 *
 * Usage (PowerShell):
 *   $env:AUTH0_DOMAIN="cancap-dev.us.auth0.com"
 *   $env:AUTH0_M2M_CLIENT_ID="..."
 *   $env:AUTH0_M2M_CLIENT_SECRET="..."
 *   npx ts-node scripts/tag-auth0-test-accounts.ts
 *
 * To untag (run with UNTAG=1), the script will set test_account=false instead.
 */
import fs from 'fs';
import path from 'path';

const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const UNTAG = process.env.UNTAG === '1';
const ACCOUNTS_FILE = path.resolve('automation-accounts.txt');

if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('✕ AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET must be set');
    process.exit(1);
}

async function getToken(): Promise<string> {
    const res = await fetch(`https://${DOMAIN}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            audience: `https://${DOMAIN}/api/v2/`,
            grant_type: 'client_credentials',
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Token request failed: ${res.status} ${body}`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
}

async function findUserIdsByEmail(token: string, email: string): Promise<string[]> {
    const url = `https://${DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Lookup failed: ${res.status} ${body}`);
    }
    const users = (await res.json()) as Array<{ user_id: string }>;
    return users.map((u) => u.user_id);
}

async function setTestAccount(token: string, userId: string, value: boolean): Promise<void> {
    const url = `https://${DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app_metadata: { test_account: value } }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Update failed: ${res.status} ${body}`);
    }
}

async function main() {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        console.error(`✕ ${ACCOUNTS_FILE} not found`);
        process.exit(1);
    }

    const emails = fs
        .readFileSync(ACCOUNTS_FILE, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

    const action = UNTAG ? 'Un-tagging' : 'Tagging';
    console.log(`${action} ${emails.length} account(s) on ${DOMAIN}…\n`);

    const token = await getToken();

    let ok = 0;
    let missing = 0;
    let failed = 0;

    for (const email of emails) {
        try {
            const userIds = await findUserIdsByEmail(token, email);
            if (userIds.length === 0) {
                console.warn(`⚠ Not found:  ${email}`);
                missing++;
                continue;
            }
            // Auth0 can return multiple user records per email if the user exists in
            // multiple connections. Tag all of them.
            for (const userId of userIds) {
                await setTestAccount(token, userId, !UNTAG);
            }
            console.log(`✓ ${UNTAG ? 'Untagged' : 'Tagged'}:   ${email}${userIds.length > 1 ? ` (${userIds.length} records)` : ''}`);
            ok++;
        } catch (err) {
            console.error(`✕ ${email}: ${(err as Error).message}`);
            failed++;
        }
    }

    console.log(`\nDone. ${UNTAG ? 'Untagged' : 'Tagged'}: ${ok}  ·  Missing: ${missing}  ·  Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

main();
