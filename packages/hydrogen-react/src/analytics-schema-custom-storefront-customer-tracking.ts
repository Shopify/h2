import {
  ShopifyAnalyticsPayload,
  ShopifyPageViewPayload,
  ShopifyAddToCartPayload,
  ShopifyMonorailPayload,
  ShopifyAnalyticsProduct,
  ShopifyMonorailEvent,
} from './analytics-types.js';
import {AnalyticsPageType, ShopifySalesChannel} from './analytics-constants.js';
import {addDataIf, schemaWrapper, parseGid} from './analytics-utils.js';
import {buildUUID} from './cookies-utils.js';
import {version} from '../package.json';

const SCHEMA_ID = 'custom_storefront_customer_tracking/1.2';
const PAGE_RENDERED_EVENT_NAME = 'page_rendered';
const COLLECTION_PAGE_RENDERED_EVENT_NAME = 'collection_page_rendered';
const PRODUCT_PAGE_RENDERED_EVENT_NAME = 'product_page_rendered';
const PRODUCT_ADDED_TO_CART_EVENT_NAME = 'product_added_to_cart';
const SEARCH_SUBMITTED_EVENT_NAME = 'search_submitted';

function prepareAdditionalPayload(
  payload: ShopifyPageViewPayload,
): Pick<ShopifyMonorailPayload, 'canonical_url' | 'customer_id'> {
  return {
    canonical_url: payload.canonicalUrl || payload.url,
    customer_id: parseInt(parseGid(payload.customerId).id || '0'),
  };
}

// Send the page view event to the Monorail server.
// It also sends additional page view events based on the page type.
export function pageView(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent[] {
  const pageViewPayload = payload;
  const additionalPayload = prepareAdditionalPayload(pageViewPayload);

  const pageType = pageViewPayload.pageType;
  const pageViewEvents = [];

  pageViewEvents.push(
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: PAGE_RENDERED_EVENT_NAME,
          ...additionalPayload,
        },
        formatPayload(pageViewPayload),
      ),
    ),
  );

  switch (pageType) {
    case AnalyticsPageType.collection:
      pageViewEvents.push(
        schemaWrapper(
          SCHEMA_ID,
          addDataIf(
            {
              event_name: COLLECTION_PAGE_RENDERED_EVENT_NAME,
              ...additionalPayload,
              collection_name: pageViewPayload.collectionHandle,
              collection_id: parseInt(
                parseGid(pageViewPayload.collectionId).id,
              ),
            },
            formatPayload(pageViewPayload),
          ),
        ),
      );
      break;
    case AnalyticsPageType.product:
      pageViewEvents.push(
        schemaWrapper(
          SCHEMA_ID,
          addDataIf(
            {
              event_name: PRODUCT_PAGE_RENDERED_EVENT_NAME,
              ...additionalPayload,
              products: formatProductPayload(pageViewPayload.products),
              total_value: pageViewPayload.totalValue,
            },
            formatPayload(pageViewPayload),
          ),
        ),
      );
      break;
    case AnalyticsPageType.search:
      pageViewEvents.push(
        schemaWrapper(
          SCHEMA_ID,
          addDataIf(
            {
              event_name: SEARCH_SUBMITTED_EVENT_NAME,
              ...additionalPayload,
              search_string: pageViewPayload.searchString,
            },
            formatPayload(pageViewPayload),
          ),
        ),
      );
      break;
  }

  return pageViewEvents;
}

// Sends page view event to the Monorail server.
export function pageView2(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent[] {
  const pageViewPayload = payload;
  const additionalPayload = prepareAdditionalPayload(pageViewPayload);

  return [
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: PAGE_RENDERED_EVENT_NAME,
          ...additionalPayload,
        },
        formatPayload(pageViewPayload),
      ),
    ),
  ];
}

// Sends collection view event to the Monorail server.
export function collectionView(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent[] {
  const pageViewPayload = payload;
  const additionalPayload = prepareAdditionalPayload(pageViewPayload);

  return [
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: COLLECTION_PAGE_RENDERED_EVENT_NAME,
          ...additionalPayload,
          collection_name: pageViewPayload.collectionHandle,
          collection_id: parseInt(parseGid(pageViewPayload.collectionId).id),
        },
        formatPayload(pageViewPayload),
      ),
    ),
  ];
}

// Sends product view event to the Monorail server.
export function productView(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent[] {
  const pageViewPayload = payload;
  const additionalPayload = prepareAdditionalPayload(pageViewPayload);

  return [
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: PRODUCT_PAGE_RENDERED_EVENT_NAME,
          ...additionalPayload,
          products: formatProductPayload(pageViewPayload.products),
          total_value: pageViewPayload.totalValue,
        },
        formatPayload(pageViewPayload),
      ),
    ),
  ];
}

// Sends search view event to the Monorail server.
export function searchView(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent[] {
  const pageViewPayload = payload;
  const additionalPayload = prepareAdditionalPayload(pageViewPayload);

  return [
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: SEARCH_SUBMITTED_EVENT_NAME,
          ...additionalPayload,
          search_string: pageViewPayload.searchString,
        },
        formatPayload(pageViewPayload),
      ),
    ),
  ];
}

export function addToCart(
  payload: ShopifyAddToCartPayload,
): ShopifyMonorailEvent[] {
  const addToCartPayload = payload;
  const cartToken = parseGid(addToCartPayload.cartId);
  return [
    schemaWrapper(
      SCHEMA_ID,
      addDataIf(
        {
          event_name: PRODUCT_ADDED_TO_CART_EVENT_NAME,
          customerId: addToCartPayload.customerId,
          cart_token: cartToken?.id ? `${cartToken.id}` : null,
          total_value: addToCartPayload.totalValue,
          products: formatProductPayload(addToCartPayload.products),
          customer_id: parseInt(
            parseGid(addToCartPayload.customerId).id || '0',
          ),
        },
        formatPayload(addToCartPayload),
      ),
    ),
  ];
}

function formatPayload(
  payload: ShopifyAnalyticsPayload,
): ShopifyMonorailPayload {
  return {
    source: payload.shopifySalesChannel || ShopifySalesChannel.headless,
    asset_version_id: payload.assetVersionId || version,
    hydrogenSubchannelId:
      payload.storefrontId || payload.hydrogenSubchannelId || '0',

    is_persistent_cookie: payload.hasUserConsent,
    deprecated_visit_token: payload.visitToken,
    unique_token: payload.uniqueToken,
    event_time: Date.now(),
    event_id: buildUUID(),

    event_source_url: payload.url,
    referrer: payload.referrer,
    user_agent: payload.userAgent,
    navigation_type: payload.navigationType,
    navigation_api: payload.navigationApi,

    shop_id: parseInt(parseGid(payload.shopId).id),
    currency: payload.currency,

    ccpa_enforced: payload.ccpaEnforced || false,
    gdpr_enforced: payload.gdprEnforced || false,
    gdpr_enforced_as_string: payload.gdprEnforced ? 'true' : 'false',
    analytics_allowed: payload.analyticsAllowed || false,
    marketing_allowed: payload.marketingAllowed || false,
    sale_of_data_allowed: payload.saleOfDataAllowed || false,
  };
}

function formatProductPayload(products?: ShopifyAnalyticsProduct[]): string[] {
  return products
    ? products.map((p: ShopifyAnalyticsProduct) => {
        const product = addDataIf(
          {
            variant_gid: p.variantGid,
            category: p.category,
            sku: p.sku,
            product_id: parseInt(parseGid(p.productGid).id),
            variant_id: parseInt(parseGid(p.variantGid).id),
          },
          {
            product_gid: p.productGid,
            name: p.name,
            variant: p.variantName || '',
            brand: p.brand,
            price: parseFloat(p.price),
            quantity: Number(p.quantity || 0),
          },
        );
        return JSON.stringify(product);
      })
    : [];
}
