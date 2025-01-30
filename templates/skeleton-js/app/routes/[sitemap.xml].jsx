import {getSitemapIndex} from '@shopify/hydrogen';

/**
 * @param {LoaderFunctionArgs}
 */
export async function loader({request, context: {storefront}}) {
  const response = await getSitemapIndex({
    storefront,
    request,
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}

/** @typedef {import('@shopify/remix-oxygen').LoaderFunctionArgs} LoaderFunctionArgs */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
