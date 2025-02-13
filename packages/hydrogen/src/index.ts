export {
  Analytics,
  getShopAnalytics,
  type ShopAnalytics,
  useAnalytics,
} from './analytics-manager/AnalyticsProvider';
export {
  type CartLineUpdatePayload,
  type CartUpdatePayload,
  type CartViewPayload,
  type CollectionViewPayload,
  type PageViewPayload,
  type ProductViewPayload,
  type SearchViewPayload,
} from './analytics-manager/AnalyticsView';
export {AnalyticsEvent} from './analytics-manager/events';
export {createWithCache, type WithCache} from './cache/create-with-cache';
export {InMemoryCache} from './cache/in-memory';
export {type CacheKey} from './cache/run-with-cache';
export {
  CacheCustom,
  CacheLong,
  CacheNone,
  CacheShort,
  type CachingStrategy,
  generateCacheControlHeader,
  type NoStoreStrategy,
} from './cache/strategies';
export {
  type CartActionInput,
  CartForm,
  type OptimisticCartLineInput,
} from './cart/CartForm';
export {cartGetIdDefault} from './cart/cartGetIdDefault';
export {cartSetIdDefault, type CookieOptions} from './cart/cartSetIdDefault';
export {
  createCartHandler,
  type HydrogenCart,
  type HydrogenCartCustom,
} from './cart/createCartHandler';
export {
  type OptimisticCart,
  type OptimisticCartLine,
  useOptimisticCart,
} from './cart/optimistic/useOptimisticCart';
export type {
  CartQueryDataReturn,
  CartQueryOptions,
  CartQueryReturn,
  CartReturn,
  MetafieldWithoutOwnerId,
} from './cart/queries/cart-types';
export {cartAttributesUpdateDefault} from './cart/queries/cartAttributesUpdateDefault';
export {cartBuyerIdentityUpdateDefault} from './cart/queries/cartBuyerIdentityUpdateDefault';
export {cartCreateDefault} from './cart/queries/cartCreateDefault';
export {cartDiscountCodesUpdateDefault} from './cart/queries/cartDiscountCodesUpdateDefault';
export {cartGetDefault} from './cart/queries/cartGetDefault';
export {cartGiftCardCodesUpdateDefault} from './cart/queries/cartGiftCardCodeUpdateDefault';
export {cartLinesAddDefault} from './cart/queries/cartLinesAddDefault';
export {cartLinesRemoveDefault} from './cart/queries/cartLinesRemoveDefault';
export {cartLinesUpdateDefault} from './cart/queries/cartLinesUpdateDefault';
export {cartMetafieldDeleteDefault} from './cart/queries/cartMetafieldDeleteDefault';
export {cartMetafieldsSetDefault} from './cart/queries/cartMetafieldsSetDefault';
export {cartNoteUpdateDefault} from './cart/queries/cartNoteUpdateDefault';
export {cartSelectedDeliveryOptionsUpdateDefault} from './cart/queries/cartSelectedDeliveryOptionsUpdateDefault';
export {changelogHandler} from './changelogHandler';
export {
  createHydrogenContext,
  type HydrogenContext,
} from './createHydrogenContext';
export {createContentSecurityPolicy, useNonce} from './csp/csp';
export {Script} from './csp/Script';
export {createCustomerAccountClient} from './customer/customer';
export type {
  CustomerAccount,
  CustomerAccountMutations,
  CustomerAccountQueries,
} from './customer/types';
export {
  type ConsentStatus,
  type CustomerPrivacy,
  type CustomerPrivacyApiProps,
  type CustomerPrivacyConsentConfig,
  type CustomEventMap,
  type PrivacyBanner,
  type SetConsentHeadlessParams,
  useCustomerPrivacy,
  type VisitorConsent,
  type VisitorConsentCollected,
} from './customer-privacy/ShopifyCustomerPrivacy';
export {hydrogenRoutes} from './dev/hydrogen-routes';
export {
  OptimisticInput,
  useOptimisticData,
} from './optimistic-ui/optimistic-ui';
export {getPaginationVariables, Pagination} from './pagination/Pagination';
export {useOptimisticVariant} from './product/useOptimisticVariant';
export type {
  VariantOption,
  VariantOptionValue,
} from './product/VariantSelector';
export {
  getSelectedProductOptions,
  VariantSelector,
} from './product/VariantSelector';
export {RichText} from './RichText';
export {graphiqlLoader} from './routing/graphiql';
export {storefrontRedirect} from './routing/redirect';
export {type SeoConfig} from './seo/generate-seo-tags';
export {getSeoMeta} from './seo/getSeoMeta';
export type {SeoHandleFunction} from './seo/seo';
export {Seo} from './seo/seo';
export {ShopPayButton} from './shop/ShopPayButton';
export {getSitemap, getSitemapIndex} from './sitemap/sitemap';
export * from './storefront';
export type {HydrogenEnv, HydrogenSession, HydrogenSessionData} from './types';
export type {
  ClientBrowserParameters,
  MappedProductOptions,
  ParsedMetafields,
  // TODO: document this change
  ShopifyAnalytics as SendShopifyAnalyticsEvent,
  ShopifyAddToCart,
  ShopifyAddToCartPayload,
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
export {
  AnalyticsEventName,
  AnalyticsPageType,
  customerAccountApiCustomScalars,
  decodeEncodedVariant,
  ExternalVideo,
  flattenConnection,
  getAdjacentAndFirstAvailableVariants,
  getClientBrowserParameters,
  getProductOptions,
  getShopifyCookies,
  Image,
  IMAGE_FRAGMENT,
  isOptionValueCombinationInEncodedVariant,
  mapSelectedProductOptionToObject,
  MediaFile,
  ModelViewer,
  Money,
  parseGid,
  parseMetafield,
  sendShopifyAnalytics,
  ShopifySalesChannel,
  storefrontApiCustomScalars,
  useLoadScript,
  useMoney,
  useSelectedOptionInUrlParam,
  useShopifyCookies,
  Video,
} from '@shopify/hydrogen-react';
