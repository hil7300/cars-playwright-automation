// ESLint 9 flat config — TypeScript + Playwright rules for this automation project.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import playwrightPlugin from 'eslint-plugin-playwright';
import prettierConfig from 'eslint-config-prettier';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'playwright-report/**',
            'allure-results/**',
            'test-results/**',
        ],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            playwright: playwrightPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...playwrightPlugin.configs['flat/recommended'].rules,

            // Unused imports / vars — warn so CI fails loudly
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],

            // Common Playwright pitfalls
            'playwright/no-wait-for-timeout': 'off', // project-wide decision: hard timeouts are intentional
            'playwright/expect-expect': 'warn',
            'playwright/no-focused-test': 'error',
            'playwright/no-skipped-test': 'warn',

            // Catch the exact pattern we just cleaned up: `await` on non-Promise values
            '@typescript-eslint/await-thenable': 'error',

            // Loosened during strict-mode rollout — tighten later
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    // Prettier config must be last so it overrides stylistic rules
    prettierConfig,
];
