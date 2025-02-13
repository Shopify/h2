import {symlink, cp as copyWithFilter} from 'node:fs/promises';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {
  inTemporaryDirectory,
  fileExists,
  readFile,
} from '@shopify/cli-kit/node/fs';
import {joinPath} from '@shopify/cli-kit/node/path';
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output';
import {runSetup} from './setup.js';
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui';
import {getRepoNodeModules, getSkeletonSourceDir} from '../../lib/build.js';

vi.mock('../../lib/shell.js');

vi.mock('@shopify/cli-kit/node/ui', async () => {
  const original = await vi.importActual<
    typeof import('@shopify/cli-kit/node/ui')
  >('@shopify/cli-kit/node/ui');

  return {
    ...original,
    renderConfirmationPrompt: vi.fn(),
    renderSelectPrompt: vi.fn(),
    renderTextPrompt: vi.fn(),
    renderInfo: vi.fn(),
  };
});

describe('setup', () => {
  const outputMock = mockAndCaptureOutput();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  beforeEach(() => {
    outputMock.clear();
  });

  it('sets up an i18n strategy and generates routes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await copyWithFilter(getSkeletonSourceDir(), tmpDir, {
        force: true,
        recursive: true,
        filter: (src) =>
          (!src.includes('node_modules') && !src.includes('routes')) ||
          src.endsWith('routes.ts'),
      });

      await expect(
        fileExists(joinPath(tmpDir, 'app/routes/_index.tsx')),
      ).resolves.toBeFalsy();

      await symlink(
        await getRepoNodeModules(),
        joinPath(tmpDir, 'node_modules'),
      );

      // For generating routes
      vi.mocked(renderConfirmationPrompt).mockResolvedValueOnce(true);

      await expect(
        runSetup({
          directory: tmpDir,
          markets: 'subfolders',
          installDeps: false,
        }),
      ).resolves.not.toThrow();

      // // Generates routes
      await expect(
        fileExists(joinPath(tmpDir, 'app/routes/($locale)._index.tsx')),
      ).resolves.toBeTruthy();

      const contextFile = await readFile(`${tmpDir}/app/lib/context.ts`);
      expect(contextFile).toMatch(/i18n: getLocaleFromRequest\(request\),/);

      const i18nFile = await readFile(`${tmpDir}/app/lib/i18n.ts`);
      expect(i18nFile).toMatch(/url.pathname/);

      const output = outputMock.info();
      expect(output).toMatch('success');
      expect(output).not.toMatch('warning');
      expect(output).toMatch(/Markets:\s*Subfolders/);
      expect(output).toMatch('Routes');
      expect(output).toMatch('Home (/ & /:catchAll)');
    });
  });
});
