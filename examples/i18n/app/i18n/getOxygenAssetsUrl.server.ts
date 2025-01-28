import {getOxygenEnv} from './getOxygenEnv.server';

type DevOxygenAssetsUrl = `http://localhost:${number}`;
type ProdOxygenAssetsUrl =
  `https://cdn.shopify.com/oxygen/${string}/${string}/${string}`;

/**
 * A utility function that builds the Oxygen assets url from
 * the request oxygen headers. During dev mode the url will be simply localhost
 * @example
 * ```js
 * const oxygeAssetsUrl = getOxygenAssetsUrl(request)
 * -> (prod) https://cdn.shopify.com/oxygen/55145660472/1000001971/evns5kqde
 * -> (dev) http://localhost:3000
 * ```
 */
export function getOxygenAssetsUrl(
  request: Request,
): ProdOxygenAssetsUrl | DevOxygenAssetsUrl {
  const {shopId, storefrontId, deploymentId} = getOxygenEnv(request);
  const isDev = deploymentId === 'local';

  if (isDev) {
    const url = new URL(request.url);
    return `${url.origin}` as DevOxygenAssetsUrl;
  }

  return `https://cdn.shopify.com/oxygen/${shopId}/${storefrontId}/${deploymentId}` as ProdOxygenAssetsUrl;
}
