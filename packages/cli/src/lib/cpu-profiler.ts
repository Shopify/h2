import {readFile} from '@shopify/cli-kit/node/fs';
import {Session, type Profiler} from 'node:inspector';
import {SourceMapConsumer} from 'source-map';
import {handleMiniOxygenImportFail} from './mini-oxygen/common.js';
import {importLocal} from './import-utils.js';

export async function createCpuStartupProfiler(root: string) {
  type MiniOxygenType = typeof import('@shopify/mini-oxygen/node');
  const {createMiniOxygen} = await importLocal<MiniOxygenType>(
    '@shopify/mini-oxygen/node',
    root,
  ).catch(handleMiniOxygenImportFail);

  const miniOxygen = createMiniOxygen({
    script: 'export default {}',
    modules: true,
    log: () => {},
  });

  return {
    async run(scriptPath: string, sourceEntrypoint?: string) {
      const [script] = await Promise.all([
        readFile(scriptPath),
        miniOxygen.ready(),
      ]);

      const stopProfiler = await startProfiler();
      await miniOxygen.reload({script});
      const rawProfile = await stopProfiler();

      return enhanceProfileNodes(
        rawProfile,
        scriptPath + '.map',
        sourceEntrypoint,
      );
    },
    async close() {
      await miniOxygen.dispose();
    },
  };
}

function startProfiler(): Promise<
  (filepath?: string) => Promise<Profiler.Profile>
> {
  const session = new Session();
  session.connect();

  return new Promise((resolveStart) => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', () => {
        resolveStart(() => {
          return new Promise((resolveStop, rejectStop) => {
            session.post('Profiler.stop', (err, {profile}) => {
              session.disconnect();

              if (err) {
                return rejectStop(err);
              }

              resolveStop(profile);
            });
          });
        });
      });
    });
  });
}

async function enhanceProfileNodes(
  profile: Profiler.Profile,
  sourceMapPath: string,
  sourceEntrypoint?: string,
) {
  const sourceMap = JSON.parse(await readFile(sourceMapPath));
  const smc = await new SourceMapConsumer(sourceMap, 'file://' + sourceMapPath);

  const scriptDescendants = new Set<number>();
  let totalScriptTimeMicrosec = 0;
  const totalTimeMicrosec = profile.endTime - profile.startTime;
  const timePerSample = profile.samples?.length
    ? totalTimeMicrosec / profile.samples.length
    : 0;

  for (const node of profile.nodes) {
    if (node.callFrame.url === '<script>' || scriptDescendants.has(node.id)) {
      scriptDescendants.add(node.id);
      node.children?.forEach((id) => scriptDescendants.add(id));
    }

    if (scriptDescendants.has(node.id)) {
      // Enhance paths with sourcemaps of known files.
      augmentNode(node, smc);

      if (
        node.callFrame.url === '<script>' &&
        !node.callFrame.functionName &&
        !node.callFrame.lineNumber &&
        !node.callFrame.columnNumber
      ) {
        // If the node wasn't augmented, it's likely a top-level script
        // in one of the app files. We'll give it a more descriptive name.
        node.callFrame.url = sourceEntrypoint ?? '';
        node.callFrame.functionName = '(top-level app code)';
      }

      // Accrue total time spent by the script (app + deps).
      totalScriptTimeMicrosec +=
        Math.round((node.hitCount ?? 0) * timePerSample * 1000) / 1000;
    } else {
      // These nodes are not part of the script (app + deps), so we
      // silence them to remove visual noise from the profile.
      silenceNode(node);
    }
  }

  smc.destroy();

  return {
    profile,
    totalTimeMs: totalTimeMicrosec / 1000,
    totalScriptTimeMs: totalScriptTimeMicrosec / 1000,
  };
}

function augmentNode(node: Profiler.ProfileNode, smc: SourceMapConsumer) {
  const originalPosition = smc.originalPositionFor({
    line: node.callFrame.lineNumber + 1,
    column: node.callFrame.columnNumber + 1,
  });

  node.callFrame.url = originalPosition.source || node.callFrame.url;

  // Some helpers like `__toESM(...)` etc. might not have a name
  // after minification. These will show up as `(annonymous)`.
  node.callFrame.functionName =
    originalPosition.name || node.callFrame.functionName;

  node.callFrame.lineNumber = originalPosition.line
    ? originalPosition.line - 1
    : node.callFrame.lineNumber;

  node.callFrame.columnNumber =
    originalPosition.column ?? node.callFrame.columnNumber;
}

function silenceNode(node: Profiler.ProfileNode) {
  Object.assign(node, {
    children: [],
    callFrame: {
      functionName: '(profiler)',
      scriptId: '0',
      url: '',
      lineNumber: -1,
      columnNumber: -1,
    },
  });
}
