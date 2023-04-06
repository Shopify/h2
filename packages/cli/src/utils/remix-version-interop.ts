import {createRequire} from 'module';
import {getRemixConfig} from './config.js';

export function isRemixV2() {
  try {
    const require = createRequire(import.meta.url);
    const version: string =
      require('@remix-run/server-runtime/package.json')?.version ?? '';

    return version.startsWith('2.');
  } catch (e) {
    return false;
  }
}

export async function getV2Flags(root: string) {
  const isV2 = isRemixV2();
  const futureFlags = {
    ...(!isV2 && (await getRemixConfig(root)).future),
  };

  return {
    isV2Meta: isV2 || !!futureFlags.v2_meta,
    isV2RouteConvention: isV2 || !!futureFlags.v2_routeConvention,
    isV2ErrorBoundary: isV2 || !!futureFlags.v2_errorBoundary,
  };
}

export type RemixV2Flags = Partial<Awaited<ReturnType<typeof getV2Flags>>>;

export function convertRouteToV2(route: string) {
  return route.replace(/\/index$/, '/_index').replace(/(?<!^)\//g, '.');
}

export function convertTemplateToRemixVersion(
  template: string,
  {isV2Meta, isV2ErrorBoundary}: RemixV2Flags,
) {
  template = isV2Meta ? convertToMetaV2(template) : convertToMetaV1(template);

  template = isV2ErrorBoundary
    ? convertToErrorBoundaryV2(template)
    : convertToErrorBoundaryV1(template);

  return template;
}

function convertToMetaV2(template: string) {
  return template
    .replace(/type MetaFunction\s*,?/, '')
    .replace(/export const metaV1:.+?\n};/s, '');
}

function convertToMetaV1(template: string) {
  return template
    .replace(/type V2_MetaFunction\s*,?/, '')
    .replace(/export const meta:.+?\n};/s, '')
    .replace(/const metaV1:/, 'const meta:');
}

function convertToErrorBoundaryV2(template: string) {
  return template
    .replace(/type ErrorBoundaryComponent\s*,?/s, '')
    .replace(/useCatch\s*,?/s, '')
    .replace(/export function CatchBoundary.+?\n}/s, '')
    .replace(/export const ErrorBoundaryV1.+?\n};/s, '')
    .replace(/const metaV2:/, 'const meta:')
    .replace(/import \{\s*\} from '@shopify\/remix-oxygen';/, '');
}

function convertToErrorBoundaryV1(template: string) {
  return template
    .replace(/useRouteError\s*,?/s, '')
    .replace(/isRouteErrorResponse\s*,?/s, '')
    .replace(/export function ErrorBoundary.+?\n}/s, '')
    .replace(/const ErrorBoundaryV1:/, 'const ErrorBoundary:');
}
