import {useParams, useFetcher, Form, type FormProps} from '@remix-run/react';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import React, {useRef, useEffect} from 'react';
import {useFetchers} from '@remix-run/react';
import type {
  PredictiveProductFragment,
  PredictiveCollectionFragment,
  PredictiveArticleFragment,
  SearchQuery,
} from 'storefrontapi.generated';
import {useTranslation, LocalizedLink} from '~/i18n';

type PredicticeSearchResultItemImage =
  | PredictiveCollectionFragment['image']
  | PredictiveArticleFragment['image']
  | PredictiveProductFragment['variants']['nodes'][0]['image'];

type PredictiveSearchResultItemPrice =
  | PredictiveProductFragment['variants']['nodes'][0]['price'];

export type NormalizedPredictiveSearchResultItem = {
  __typename: string | undefined;
  handle: string;
  id: string;
  image?: PredicticeSearchResultItemImage;
  price?: PredictiveSearchResultItemPrice;
  styledTitle?: string;
  title: string;
  url: string;
};

export type NormalizedPredictiveSearchResults = Array<
  | {type: 'queries'; items: Array<NormalizedPredictiveSearchResultItem>}
  | {type: 'products'; items: Array<NormalizedPredictiveSearchResultItem>}
  | {type: 'collections'; items: Array<NormalizedPredictiveSearchResultItem>}
  | {type: 'pages'; items: Array<NormalizedPredictiveSearchResultItem>}
  | {type: 'articles'; items: Array<NormalizedPredictiveSearchResultItem>}
>;

export type NormalizedPredictiveSearch = {
  results: NormalizedPredictiveSearchResults;
  totalResults: number;
};

type FetchSearchResultsReturn = {
  searchResults: {
    results: SearchQuery | null;
    totalResults: number;
  };
  searchTerm: string;
};

export const NO_PREDICTIVE_SEARCH_RESULTS: NormalizedPredictiveSearchResults = [
  {type: 'queries', items: []},
  {type: 'products', items: []},
  {type: 'collections', items: []},
  {type: 'pages', items: []},
  {type: 'articles', items: []},
];

export function SearchForm({searchTerm}: {searchTerm: string}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // focus the input when cmd+k is pressed
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && event.metaKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === 'Escape') {
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Form method="get">
      <input
        defaultValue={searchTerm}
        name="q"
        placeholder="Search…"
        ref={inputRef}
        type="search"
      />
      &nbsp;
      <button type="submit">Search</button>
    </Form>
  );
}

export function SearchResults({
  results,
}: Pick<FetchSearchResultsReturn['searchResults'], 'results'>) {
  if (!results) {
    return null;
  }
  const keys = Object.keys(results) as Array<keyof typeof results>;
  return (
    <div>
      {results &&
        keys.map((type) => {
          const resourceResults = results[type];

          if (resourceResults.nodes[0]?.__typename === 'Page') {
            const pageResults = resourceResults as SearchQuery['pages'];
            return resourceResults.nodes.length ? (
              <SearchResultPageGrid key="pages" pages={pageResults} />
            ) : null;
          }

          if (resourceResults.nodes[0]?.__typename === 'Product') {
            const productResults = resourceResults as SearchQuery['products'];
            return resourceResults.nodes.length ? (
              <SearchResultsProductsGrid
                key="products"
                products={productResults}
              />
            ) : null;
          }

          if (resourceResults.nodes[0]?.__typename === 'Article') {
            const articleResults = resourceResults as SearchQuery['articles'];
            return resourceResults.nodes.length ? (
              <SearchResultArticleGrid
                key="articles"
                articles={articleResults}
              />
            ) : null;
          }

          return null;
        })}
    </div>
  );
}

function SearchResultsProductsGrid({products}: Pick<SearchQuery, 'products'>) {
  const {t} = useTranslation();
  return (
    <div className="search-result">
      <h2>{t('layout.search.results.products')}</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const itemsMarkup = nodes.map((product) => (
            <div className="search-results-item" key={product.id}>
              <LocalizedLink
                prefetch="intent"
                to={`/products/${product.handle}`}
              >
                <span>{product.title}</span>
              </LocalizedLink>
            </div>
          ));
          return (
            <div>
              <div>
                <PreviousLink>
                  {isLoading ? (
                    <span>{t('layout.pagination.loading')}</span>
                  ) : (
                    <span>{t('layout.pagination.previous')}</span>
                  )}
                </PreviousLink>
              </div>
              <div>
                {itemsMarkup}
                <br />
              </div>
              <div>
                <NextLink>
                  {isLoading ? (
                    <span>{t('layout.pagination.loading')}</span>
                  ) : (
                    <span>{t('layout.pagination.next')}</span>
                  )}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
      <br />
    </div>
  );
}

function SearchResultPageGrid({pages}: Pick<SearchQuery, 'pages'>) {
  const {t} = useTranslation();
  return (
    <div className="search-result">
      <h2>{t('layout.search.results.pages')}</h2>
      <div>
        {pages?.nodes?.map((page) => (
          <div className="search-results-item" key={page.id}>
            <LocalizedLink prefetch="intent" to={`/pages/${page.handle}`}>
              {page.title}
            </LocalizedLink>
          </div>
        ))}
      </div>
      <br />
    </div>
  );
}

function SearchResultArticleGrid({articles}: Pick<SearchQuery, 'articles'>) {
  const {t} = useTranslation();
  return (
    <div className="search-result">
      <h2>{t('layout.search.results.articles')}</h2>
      <div>
        {articles?.nodes?.map((article) => (
          <div className="search-results-item" key={article.id}>
            <LocalizedLink prefetch="intent" to={`/blog/${article.handle}`}>
              {article.title}
            </LocalizedLink>
          </div>
        ))}
      </div>
      <br />
    </div>
  );
}

export function NoSearchResults({searchTerm}: {searchTerm: string}) {
  const {t} = useTranslation();
  return <p>{t('layout.search.noResults', {query: searchTerm})}</p>;
}

type ChildrenRenderProps = {
  fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fetcher: ReturnType<typeof useFetcher<NormalizedPredictiveSearchResults>>;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
};

type SearchFromProps = {
  action?: FormProps['action'];
  method?: FormProps['method'];
  className?: string;
  children: (passedProps: ChildrenRenderProps) => React.ReactNode;
  [key: string]: unknown;
};

/**
 *  Search form component that posts search requests to the `/search` route
 **/
export function PredictiveSearchForm({
  action,
  children,
  className = 'predictive-search-form',
  method = 'POST',
  ...props
}: SearchFromProps) {
  const params = useParams();
  const fetcher = useFetcher<NormalizedPredictiveSearchResults>();
  const inputRef = useRef<HTMLInputElement | null>(null);

  function fetchResults(event: React.ChangeEvent<HTMLInputElement>) {
    const searchAction = action ?? '/api/predictive-search';
    const localizedAction = params.locale
      ? `/${params.locale}${searchAction}`
      : searchAction;
    const newSearchTerm = event.target.value || '';
    fetcher.submit(
      {q: newSearchTerm, limit: '6'},
      {method, action: localizedAction},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  return (
    <fetcher.Form
      {...props}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!inputRef?.current || inputRef.current.value === '') {
          return;
        }
        inputRef.current.blur();
      }}
    >
      {children({fetchResults, inputRef, fetcher})}
    </fetcher.Form>
  );
}

export function PredictiveSearchResults() {
  const {t} = useTranslation();
  const {results, totalResults, searchInputRef, searchTerm} =
    usePredictiveSearch();

  function goToSearchResult(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!searchInputRef.current) return;
    searchInputRef.current.blur();
    searchInputRef.current.value = '';
    // close the aside
    window.location.href = event.currentTarget.href;
  }

  if (!totalResults) {
    return <NoPredictiveSearchResults searchTerm={searchTerm} />;
  }
  return (
    <div className="predictive-search-results">
      <div>
        {results.map(({type, items}) => (
          <PredictiveSearchResult
            goToSearchResult={goToSearchResult}
            items={items}
            key={type}
            searchTerm={searchTerm}
            type={type}
          />
        ))}
      </div>
      {/* view all results /search?q=term */}
      {searchTerm.current && (
        <LocalizedLink
          onClick={goToSearchResult}
          to={`/search?q=${searchTerm.current}`}
        >
          <p>
            {t('layout.search.viewAll', {query: searchTerm.current})}
            &nbsp; →
          </p>
        </LocalizedLink>
      )}
    </div>
  );
}

function NoPredictiveSearchResults({
  searchTerm,
}: {
  searchTerm: React.MutableRefObject<string>;
}) {
  const {t} = useTranslation();
  if (!searchTerm.current) {
    return null;
  }
  return <p>{t('layout.search.noResults', {query: searchTerm.current})}</p>;
}

type SearchResultTypeProps = {
  goToSearchResult: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  items: NormalizedPredictiveSearchResultItem[];
  searchTerm: UseSearchReturn['searchTerm'];
  type: NormalizedPredictiveSearchResults[number]['type'];
};

function PredictiveSearchResult({
  goToSearchResult,
  items,
  searchTerm,
  type,
}: SearchResultTypeProps) {
  const {t} = useTranslation();
  const isSuggestions = type === 'queries';
  const categoryUrl = `/search?q=${
    searchTerm.current
  }&type=${pluralToSingularSearchType(type)}`;

  return (
    <div className="predictive-search-result" key={type}>
      <LocalizedLink
        prefetch="intent"
        to={categoryUrl}
        onClick={goToSearchResult}
      >
        <h5>
          {isSuggestions
            ? t('layout.search.results.suggestions')
            : t(`layout.search.results.${type}`)}
        </h5>
      </LocalizedLink>
      <ul>
        {items.map((item: NormalizedPredictiveSearchResultItem) => (
          <SearchResultItem
            goToSearchResult={goToSearchResult}
            item={item}
            key={item.id}
          />
        ))}
      </ul>
    </div>
  );
}

type SearchResultItemProps = Pick<SearchResultTypeProps, 'goToSearchResult'> & {
  item: NormalizedPredictiveSearchResultItem;
};

function SearchResultItem({goToSearchResult, item}: SearchResultItemProps) {
  return (
    <li className="predictive-search-result-item" key={item.id}>
      <LocalizedLink onClick={goToSearchResult} to={item.url}>
        {item.image?.url && (
          <Image
            alt={item.image.altText ?? ''}
            src={item.image.url}
            width={50}
            height={50}
          />
        )}
        <div>
          {item.styledTitle ? (
            <div
              dangerouslySetInnerHTML={{
                __html: item.styledTitle,
              }}
            />
          ) : (
            <span>{item.title}</span>
          )}
          {item?.price && (
            <small>
              <Money data={item.price} />
            </small>
          )}
        </div>
      </LocalizedLink>
    </li>
  );
}

type UseSearchReturn = NormalizedPredictiveSearch & {
  searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
  searchTerm: React.MutableRefObject<string>;
};

function usePredictiveSearch(): UseSearchReturn {
  const fetchers = useFetchers();
  const searchTerm = useRef<string>('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchFetcher = fetchers.find((fetcher) => fetcher.data?.searchResults);

  if (searchFetcher?.state === 'loading') {
    searchTerm.current = (searchFetcher.formData?.get('q') || '') as string;
  }

  const search = (searchFetcher?.data?.searchResults || {
    results: NO_PREDICTIVE_SEARCH_RESULTS,
    totalResults: 0,
  }) as NormalizedPredictiveSearch;

  // capture the search input element as a ref
  useEffect(() => {
    if (searchInputRef.current) return;
    searchInputRef.current = document.querySelector('input[type="search"]');
  }, []);

  return {...search, searchInputRef, searchTerm};
}

/**
 * Converts a plural search type to a singular search type
 * @param type - The plural search type
 * @returns The singular search type
 *
 * @example
 * ```ts
 * pluralToSingularSearchType('articles') // => 'ARTICLE'
 * pluralToSingularSearchType(['articles', 'products']) // => 'ARTICLE,PRODUCT'
 * ```
 */
function pluralToSingularSearchType(
  type:
    | NormalizedPredictiveSearchResults[number]['type']
    | Array<NormalizedPredictiveSearchResults[number]['type']>,
) {
  const plural = {
    articles: 'ARTICLE',
    collections: 'COLLECTION',
    pages: 'PAGE',
    products: 'PRODUCT',
    queries: 'QUERY',
  };

  if (typeof type === 'string') {
    return plural[type];
  }

  return type.map((t) => plural[t]).join(',');
}
