export * from './storefront';
export {type CacheKey} from './cache/run-with-cache';
export {createWithCache, type WithCache} from './cache/create-with-cache';
export {
  CacheCustom,
  CacheLong,
  CacheNone,
  CacheShort,
  generateCacheControlHeader,
  type CachingStrategy,
  type NoStoreStrategy,
} from './cache/strategies';
export {InMemoryCache} from './cache/in-memory';

export {storefrontRedirect} from './routing/redirect';
export {graphiqlLoader} from './routing/graphiql';
export {Seo} from './seo/seo';
export {getSeoMeta} from './seo/getSeoMeta';
export {type SeoConfig} from './seo/generate-seo-tags';
export type {SeoHandleFunction} from './seo/seo';
export {Pagination, getPaginationVariables} from './pagination/Pagination';
export {createCustomerAccountClient} from './customer/customer';
export type {
  CustomerAccount,
  CustomerAccountQueries,
  CustomerAccountMutations,
} from './customer/types';
export {changelogHandler} from './changelogHandler';

export {
  CartForm,
  type CartActionInput,
  type OptimisticCartLineInput,
} from './cart/CartForm';
export {cartCreateDefault} from './cart/queries/cartCreateDefault';
export {cartGetDefault} from './cart/queries/cartGetDefault';
export {cartLinesAddDefault} from './cart/queries/cartLinesAddDefault';
export {cartLinesUpdateDefault} from './cart/queries/cartLinesUpdateDefault';
export {cartLinesRemoveDefault} from './cart/queries/cartLinesRemoveDefault';
export {cartDiscountCodesUpdateDefault} from './cart/queries/cartDiscountCodesUpdateDefault';
export {cartGiftCardCodesUpdateDefault} from './cart/queries/cartGiftCardCodeUpdateDefault';
export {cartBuyerIdentityUpdateDefault} from './cart/queries/cartBuyerIdentityUpdateDefault';
export {cartNoteUpdateDefault} from './cart/queries/cartNoteUpdateDefault';
export {cartSelectedDeliveryOptionsUpdateDefault} from './cart/queries/cartSelectedDeliveryOptionsUpdateDefault';
export {cartAttributesUpdateDefault} from './cart/queries/cartAttributesUpdateDefault';
export {cartMetafieldsSetDefault} from './cart/queries/cartMetafieldsSetDefault';
export {cartMetafieldDeleteDefault} from './cart/queries/cartMetafieldDeleteDefault';
export {cartGetIdDefault} from './cart/cartGetIdDefault';
export {cartSetIdDefault, type CookieOptions} from './cart/cartSetIdDefault';
export {
  type HydrogenCartCustom,
  type HydrogenCart,
  createCartHandler,
} from './cart/createCartHandler';
export type {
  MetafieldWithoutOwnerId,
  CartReturn,
  CartQueryDataReturn,
  CartQueryOptions,
  CartQueryReturn,
} from './cart/queries/cart-types';

export {
  useOptimisticCart,
  type OptimisticCart,
  type OptimisticCartLine,
} from './cart/optimistic/useOptimisticCart';

export {
  VariantSelector,
  getSelectedProductOptions,
} from './product/VariantSelector';

export {useOptimisticVariant} from './product/useOptimisticVariant';

export type {
  VariantOption,
  VariantOptionValue,
} from './product/VariantSelector';

export {createContentSecurityPolicy, useNonce} from './csp/csp';
export {Script} from './csp/Script';

export {
  useOptimisticData,
  OptimisticInput,
} from './optimistic-ui/optimistic-ui';

export {ShopPayButton} from './shop/ShopPayButton';

export {
  Analytics,
  useAnalytics,
  getShopAnalytics,
  type ShopAnalytics,
} from './analytics-manager/AnalyticsProvider';
export {AnalyticsEvent} from './analytics-manager/events';
export {
  type PageViewPayload,
  type ProductViewPayload,
  type CollectionViewPayload,
  type CartViewPayload,
  type SearchViewPayload,
  type CartUpdatePayload,
  type CartLineUpdatePayload,
} from './analytics-manager/AnalyticsView';

export {
  type ConsentStatus,
  type VisitorConsent,
  type VisitorConsentCollected,
  type CustomerPrivacyConsentConfig,
  type SetConsentHeadlessParams,
  type CustomerPrivacy,
  type PrivacyBanner,
  type CustomEventMap,
  type CustomerPrivacyApiProps,
  useCustomerPrivacy,
} from './customer-privacy/ShopifyCustomerPrivacy';

export {
  AnalyticsEventName,
  AnalyticsPageType,
  ExternalVideo,
  flattenConnection,
  getClientBrowserParameters,
  getShopifyCookies,
  Image,
  IMAGE_FRAGMENT,
  MediaFile,
  ModelViewer,
  Money,
  parseGid,
  parseMetafield,
  sendShopifyAnalytics,
  ShopifySalesChannel,
  storefrontApiCustomScalars,
  customerAccountApiCustomScalars,
  useLoadScript,
  useMoney,
  useShopifyCookies,
  Video,
  isOptionValueCombinationInEncodedVariant,
  decodeEncodedVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  mapSelectedProductOptionToObject,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen-react';
export {RichText} from './RichText';

export type {
  ClientBrowserParameters,
  MappedProductOptions,
  ParsedMetafields,
  ShopifyAddToCart,
  ShopifyAddToCartPayload,
  // TODO: document this change
  ShopifyAnalytics as SendShopifyAnalyticsEvent,
  ShopifyAnalyticsPayload,
  ShopifyAnalyticsProduct,
  ShopifyCookies,
  ShopifyPageView,
  ShopifyPageViewPayload,
  StorefrontApiResponse,
  StorefrontApiResponseError,
  StorefrontApiResponseOk,
  StorefrontApiResponseOkPartial,
  StorefrontApiResponsePartial,
} from '@shopify/hydrogen-react';

export type {HydrogenSessionData, HydrogenSession, HydrogenEnv} from './types';

export {
  createHydrogenContext,
  type HydrogenContext,
} from './createHydrogenContext';

export {getSitemapIndex, getSitemap} from './sitemap/sitemap';

export {hydrogenRoutes} from './dev/hydrogen-routes';
