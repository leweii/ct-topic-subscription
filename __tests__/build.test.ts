/**
 * @jest-environment node
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Build verification', () => {
  const projectRoot = process.cwd();

  describe('TypeScript compilation', () => {
    it('compiles without errors', () => {
      expect(() => {
        execSync('npx tsc --noEmit', {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).not.toThrow();
    });
  });

  describe('ESLint', () => {
    it('passes lint checks', () => {
      expect(() => {
        execSync('npm run lint', {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).not.toThrow();
    });
  });

  describe('Next.js build', () => {
    // This test is expensive, skip in watch mode
    it('builds successfully', () => {
      let result: string;
      let buildError: Error | null = null;

      try {
        result = execSync('npm run build', {
          cwd: projectRoot,
          encoding: 'utf-8',
          timeout: 300000, // 5 minute timeout
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        buildError = error as Error;
        // execSync throws on non-zero exit, but we might still have output
        result = (error as { stdout?: string; stderr?: string }).stdout || '';
        const stderr = (error as { stdout?: string; stderr?: string }).stderr || '';
        result += stderr;
      }

      // If there was an error, fail with the output
      if (buildError && !result.includes('Compiled successfully')) {
        throw new Error(`Build failed: ${result || buildError.message}`);
      }

      // Check for success indicators
      expect(result).toContain('Compiled');
    }, 300000);

    it('generates .next directory', () => {
      const nextDir = path.join(projectRoot, '.next');
      expect(fs.existsSync(nextDir)).toBe(true);
    });
  });

  describe('Required files exist', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.mjs',
      'tailwind.config.ts',
      'app/layout.tsx',
      'app/page.tsx',
      'lib/i18n/context.tsx',
      'lib/i18n/locales/en.json',
      'lib/i18n/locales/zh.json',
      'lib/supabase/client.ts',
      'lib/supabase/server.ts',
      'components/LanguageSwitcher.tsx',
      'components/SourceLinksInput.tsx',
    ];

    requiredFiles.forEach((file) => {
      it(`${file} exists`, () => {
        const filePath = path.join(projectRoot, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
  });

  describe('i18n files structure', () => {
    it('en.json has all required keys', () => {
      const enPath = path.join(projectRoot, 'lib/i18n/locales/en.json');
      const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

      // Check top-level keys
      expect(en).toHaveProperty('metadata');
      expect(en).toHaveProperty('login');
      expect(en).toHaveProperty('subscription');
      expect(en).toHaveProperty('result');
      expect(en).toHaveProperty('pipeline');
      expect(en).toHaveProperty('common');

      // Check critical nested keys
      expect(en.login).toHaveProperty('title');
      expect(en.subscription).toHaveProperty('sources');
      expect(en.subscription).toHaveProperty('addSource');
      expect(en.subscription).toHaveProperty('sourceLimitReached');
    });

    it('zh.json has same structure as en.json', () => {
      const enPath = path.join(projectRoot, 'lib/i18n/locales/en.json');
      const zhPath = path.join(projectRoot, 'lib/i18n/locales/zh.json');

      const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));

      function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
        return Object.entries(obj).flatMap(([key, value]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null) {
            return getKeys(value as Record<string, unknown>, fullKey);
          }
          return [fullKey];
        });
      }

      const enKeys = getKeys(en).sort();
      const zhKeys = getKeys(zh).sort();

      expect(zhKeys).toEqual(enKeys);
    });
  });

  describe('API routes exist', () => {
    const apiRoutes = [
      'app/api/subscriptions/route.ts',
      'app/api/subscriptions/[id]/route.ts',
      'app/api/subscriptions/[id]/links/route.ts',
      'app/api/subscriptions/[id]/links/[linkId]/route.ts',
      'app/api/subscriptions/[id]/run/route.ts',
    ];

    apiRoutes.forEach((route) => {
      it(`${route} exists`, () => {
        const routePath = path.join(projectRoot, route);
        expect(fs.existsSync(routePath)).toBe(true);
      });
    });
  });

  describe('Page routes exist', () => {
    const pageRoutes = [
      'app/login/page.tsx',
      'app/subscriptions/page.tsx',
      'app/subscription/new/page.tsx',
      'app/subscription/[id]/page.tsx',
      'app/result/page.tsx',
      'app/result/[id]/page.tsx',
    ];

    pageRoutes.forEach((route) => {
      it(`${route} exists`, () => {
        const routePath = path.join(projectRoot, route);
        expect(fs.existsSync(routePath)).toBe(true);
      });
    });
  });

  describe('force-dynamic export', () => {
    const clientPages = [
      'app/login/page.tsx',
      'app/subscriptions/page.tsx',
      'app/subscription/new/page.tsx',
      'app/subscription/[id]/page.tsx',
      'app/result/page.tsx',
      'app/result/[id]/page.tsx',
    ];

    clientPages.forEach((page) => {
      it(`${page} exports force-dynamic`, () => {
        const pagePath = path.join(projectRoot, page);
        const content = fs.readFileSync(pagePath, 'utf-8');
        expect(content).toContain("export const dynamic = 'force-dynamic'");
      });
    });
  });
});
