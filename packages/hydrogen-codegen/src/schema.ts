// This comment is used during ESM build:
//! import {createRequire} from 'module'; const require = createRequire(import.meta.url);

type Api = 'storefront' | 'unstable-storefront' | 'customer-account';
type Options<T extends boolean> = {throwIfMissing?: T};

/**
 * Resolves a schema path for the provided API type. Only the API types currently
 * bundled in Hydrogen are allowed: "storefront" and "customer".
 * @param api
 * @returns
 */
export function getSchema(api: Api, options?: Options<true>): string;
export function getSchema(
  api: Api,
  options: Options<false>,
): string | undefined;
export function getSchema(api: Api, options?: Options<boolean>) {
  if (
    api !== 'storefront' &&
    api !== 'customer-account' &&
    api !== 'unstable-storefront'
  ) {
    throw new Error(
      `The provided API type "${api}" is unknown. Please use "storefront", "unstable-storefront" or "customer-account".`,
    );
  }

  try {
    return require.resolve(`@shopify/hydrogen/${api}.schema.json`);
  } catch {
    if (options?.throwIfMissing !== false) {
      throw new Error(
        `Could not find a schema for "${api}".\nPlease make sure a recent version of \`@shopify/hydrogen\` is installed.`,
      );
    }
  }
}
