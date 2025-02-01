import {data} from '@shopify/remix-oxygen';
import {generateCacheControlHeader, CacheShort} from '@shopify/hydrogen';

export async function loader() {
  return data(
    {some: 'data'},
    {
      headers: {
        'cache-control': generateCacheControlHeader(CacheShort()),
      },
    },
  );
}
