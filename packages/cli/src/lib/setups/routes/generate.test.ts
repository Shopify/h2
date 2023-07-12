import {describe, it, expect, vi, beforeEach} from 'vitest';
import {temporaryDirectoryTask} from 'tempy';
import {generateProjectFile, generateRoutes, ROUTE_MAP} from './generate.js';
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui';
import {readFile, writeFile, mkdir, fileExists} from '@shopify/cli-kit/node/fs';
import {joinPath, dirname} from '@shopify/cli-kit/node/path';
import {getTemplateAppFile} from '../../../lib/build.js';
import {getRemixConfig} from '../../../lib/config.js';
import {readdir} from 'fs-extra';

const readProjectFile = (
  dirs: {appDirectory: string},
  fileBasename: string,
  ext = 'tsx',
) => readFile(joinPath(dirs.appDirectory, `${fileBasename}.${ext}`));

describe('generate/route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mock('@shopify/cli-kit/node/output');
    vi.mock('@shopify/cli-kit/node/ui');
    vi.mock('../../config.js', async () => ({getRemixConfig: vi.fn()}));
  });

  describe('generateRoutes', () => {
    it('generates all routes with correct configuration', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        const directories = await createHydrogenFixture(tmpDir, {
          files: [
            ['jsconfig.json', JSON.stringify({compilerOptions: {test: 'js'}})],
            ['.prettierrc.json', JSON.stringify({singleQuote: false})],
          ],
          templates: Object.values(ROUTE_MAP).flatMap((item) => {
            const files = Array.isArray(item) ? item : [item];
            return files.map(
              (filepath) =>
                ['routes/' + filepath + '.tsx', ''] as [string, string],
            );
          }),
        });

        vi.mocked(getRemixConfig).mockResolvedValue(directories as any);

        const result = await generateRoutes({
          routeName: 'all',
          directory: directories.rootDirectory,
          templatesRoot: directories.templatesRoot,
        });

        expect(result).toMatchObject(
          expect.objectContaining({
            isTypescript: false,
            transpilerOptions: {test: 'js'},
            formatOptions: {singleQuote: false},
            routes: expect.any(Array),
          }),
        );

        expect(result.routes).toHaveLength(
          Object.values(ROUTE_MAP).flat().length,
        );
      });
    });

    it('figures out the locale if a home route already exists', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        const route = 'routes/pages/$pageHandle';

        const directories = await createHydrogenFixture(tmpDir, {
          files: [
            ['tsconfig.json', JSON.stringify({compilerOptions: {test: 'ts'}})],
            ['app/routes/($locale)._index.tsx', 'export const test = true;'],
          ],
          templates: [[route + '.tsx', `const str = "hello world"`]],
        });

        vi.mocked(getRemixConfig).mockResolvedValue({
          ...directories,
          tsconfigPath: 'somewhere',
          future: {
            v2_routeConvention: true,
          },
        } as any);

        const result = await generateRoutes({
          routeName: ['page'],
          directory: directories.rootDirectory,
          templatesRoot: directories.templatesRoot,
        });

        expect(result).toMatchObject(
          expect.objectContaining({
            isTypescript: true,
            transpilerOptions: undefined,
            routes: expect.any(Array),
            formatOptions: expect.any(Object),
          }),
        );

        expect(result.routes).toHaveLength(1);
        expect(result.routes[0]).toMatchObject({
          destinationRoute: expect.stringContaining(
            '($locale).pages.$pageHandle',
          ),
        });
      });
    });
  });

  describe('generateProjectFile', () => {
    it('generates a route file', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        // Given
        const route = 'routes/pages/$pageHandle';
        const directories = await createHydrogenFixture(tmpDir, {
          files: [],
          templates: [[route + '.tsx', `const str = "hello world"`]],
        });

        // When
        await generateProjectFile(route, directories);

        // Then
        expect(await readProjectFile(directories, route, 'jsx')).toContain(
          `const str = 'hello world'`,
        );
      });
    });

    it('generates a route file for Remix v2', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        // Given
        const route = 'routes/custom/path/$handle/index';
        const directories = await createHydrogenFixture(tmpDir, {
          files: [],
          templates: [[route + '.tsx', `const str = "hello world"`]],
        });

        // When
        await generateProjectFile(route, {
          ...directories,
          v2Flags: {isV2RouteConvention: true},
        });

        // Then
        expect(
          await readProjectFile(
            directories,
            'routes/custom.path.$handle._index',
            'jsx',
          ),
        ).toContain(`const str = 'hello world'`);
      });
    });

    it('generates route files with locale prefix', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        const routeCode = `const str = 'hello world'`;
        // Given
        const directories = await createHydrogenFixture(tmpDir, {
          files: [],
          templates: [
            ['routes/index.tsx', routeCode],
            ['routes/pages/$pageHandle.tsx', routeCode],
            ['routes/[robots.txt].tsx', routeCode],
            ['routes/[sitemap.xml].tsx', routeCode],
          ],
        });

        const localePrefix = 'locale';

        // When
        await generateProjectFile('routes/index', {
          ...directories,
          v2Flags: {isV2RouteConvention: true},
          localePrefix,
          typescript: true,
        });
        await generateProjectFile('routes/pages/$pageHandle', {
          ...directories,
          v2Flags: {isV2RouteConvention: false},
          localePrefix,
          typescript: true,
        });

        await generateProjectFile('routes/[sitemap.xml]', {
          ...directories,
          localePrefix,
          typescript: true,
        });

        await generateProjectFile('routes/[robots.txt]', {
          ...directories,
          localePrefix,
          typescript: true,
        });

        // Then

        // v2 locale:
        await expect(
          readProjectFile(directories, `routes/($locale)._index`),
        ).resolves.toContain(routeCode);

        // v1 locale:
        await expect(
          readProjectFile(directories, `routes/($locale)/pages/$pageHandle`),
        ).resolves.toContain(routeCode);

        // No locale added for assets:
        await expect(
          readProjectFile(directories, `routes/[sitemap.xml]`),
        ).resolves.toContain(routeCode);
        await expect(
          readProjectFile(directories, `routes/[robots.txt]`),
        ).resolves.toContain(routeCode);
      });
    });

    it('produces a typescript file when typescript argument is true', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        // Given
        const route = 'routes/pages/$pageHandle';
        const directories = await createHydrogenFixture(tmpDir, {
          files: [],
          templates: [[route + '.tsx', 'const str = "hello typescript"']],
        });

        // When
        await generateProjectFile(route, {
          ...directories,
          typescript: true,
        });

        // Then
        expect(await readProjectFile(directories, route)).toContain(
          `const str = 'hello typescript'`,
        );
      });
    });

    it('prompts the user if there the file already exists', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        // Given
        vi.mocked(renderConfirmationPrompt).mockImplementationOnce(
          async () => true,
        );

        const route = 'routes/page/$pageHandle';
        const directories = await createHydrogenFixture(tmpDir, {
          files: [[`app/${route}.jsx`, 'const str = "I exist"']],
          templates: [[route + '.tsx', 'const str = "hello world"']],
        });

        // When
        await generateProjectFile(route, directories);

        // Then
        expect(renderConfirmationPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('already exists'),
          }),
        );
      });
    });

    it('does not prompt the user if the force property is true', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        // Given
        vi.mocked(renderConfirmationPrompt).mockImplementationOnce(
          async () => true,
        );

        const route = 'routes/page/$pageHandle';
        const directories = await createHydrogenFixture(tmpDir, {
          files: [[`app/${route}.jsx`, 'const str = "I exist"']],
          templates: [[route + '.tsx', 'const str = "hello world"']],
        });

        // When
        await generateProjectFile(route, {
          ...directories,
          force: true,
        });

        // Then
        expect(renderConfirmationPrompt).not.toHaveBeenCalled();
      });
    });

    it('generates all the route dependencies', async () => {
      await temporaryDirectoryTask(async (tmpDir) => {
        const templates: [string, string][] = [
          [
            'routes/pages/$pageHandle.tsx',
            `import Dep from 'some-node-dep';\n` + // <= Non-relative files are ignored
              `import AnotherRoute from './AnotherRoute';\n` + // <= Routes are ignored
              `import Form from '~/components/Form';\n` + // <= Transpiled
              `import {\n\n\nButton} from '../../components/Button';\n` + // <= Transpiled
              `import {stuff} from '../../utils';\n` + // <= Copied as is
              `import styles from '../../styles/app.css';\n` + // <= Copied as is
              'export {Dep, AnotherRoute, Form, Button, stuff, styles};\n',
          ],
          [
            'components/Form.tsx',
            `import {Button} from './Button';\n` +
              `import {Text} from './Text';\n` +
              'export {Button, Text};\n',
          ],
          ['components/Button.tsx', `export const Button = '';\n`],
          ['components/Text.tsx', `export const Text = '';\n`],
          ['utils/index.ts', `export {stuff} from './stuff';\n`],
          ['utils/stuff.ts', `export const stuff = '';\n`],
          ['styles/app.css', `.red{color:red;}`],
        ];

        const directories = await createHydrogenFixture(tmpDir, {templates});

        vi.mocked(getRemixConfig).mockResolvedValue(directories as any);

        await generateProjectFile('routes/pages/$pageHandle', {
          ...directories,
          force: true,
        });

        await Promise.all(
          templates.map(async ([file, content]) => {
            const actualFile = joinPath(
              directories.appDirectory,
              file.replace('.ts', '.js'),
            );

            await expect(fileExists(actualFile)).resolves.toBeTruthy();
            await expect(readFile(actualFile)).resolves.toEqual(
              content.replace(/\{\n+/, '{'),
            );
          }),
        );
      });
    });
  });
});

async function createHydrogenFixture(
  directory: string,
  {
    files = [],
    templates = [],
  }: {files?: [string, string][]; templates?: [string, string][]},
) {
  const projectDir = 'project';

  for (const item of files) {
    const [filePath, fileContent] = item;
    const fullFilePath = joinPath(directory, projectDir, filePath);
    await mkdir(dirname(fullFilePath));
    await writeFile(fullFilePath, fileContent);
  }

  for (const item of templates) {
    const [filePath, fileContent] = item;
    const fullFilePath = getTemplateAppFile(filePath, directory);
    await mkdir(dirname(fullFilePath));
    await writeFile(fullFilePath, fileContent);
  }

  return {
    rootDirectory: joinPath(directory, projectDir),
    appDirectory: joinPath(directory, projectDir, 'app'),
    templatesRoot: directory,
  };
}
