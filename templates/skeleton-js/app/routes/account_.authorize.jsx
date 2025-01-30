/**
 * @param {LoaderFunctionArgs}
 */
export async function loader({context}) {
  return context.customerAccount.authorize();
}

/** @typedef {import('@shopify/remix-oxygen').LoaderFunctionArgs} LoaderFunctionArgs */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
