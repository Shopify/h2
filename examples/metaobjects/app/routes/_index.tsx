import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from '@remix-run/react';

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/

// 1. Add metaobject content imports
import {ROUTE_CONTENT_QUERY, RouteContent} from '~/sections/RouteContent';

export const meta: MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;

  // 2. Query the home route metaobject
  const {route} = await storefront.query(ROUTE_CONTENT_QUERY, {
    variables: {handle: 'route-home'},
    cache: storefront.CacheNone(),
  });

  return {route};
}

export default function Homepage() {
  const {route} = useLoaderData<typeof loader>();

  return (
    <div className="home">
      {/* 3. Render the route's content sections */}
      <RouteContent route={route} />
    </div>
  );
}

/**********   EXAMPLE UPDATE END   ************/
/***********************************************/
