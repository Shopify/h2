import {useFetcher, useNavigate} from '@remix-run/react';
import React, {useRef, useEffect} from 'react';
import {useAside} from './Aside';

export const SEARCH_ENDPOINT = '/search';

/**
 *  Search form component that sends search requests to the `/search` route
 * @param {SearchFormPredictiveProps}
 */
export function SearchFormPredictive({
  children,
  className = 'predictive-search-form',
  ...props
}) {
  const fetcher = useFetcher({key: 'search'});
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const aside = useAside();

  /** Reset the input value and blur the input */
  function resetInput(event) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef?.current?.value) {
      inputRef.current.blur();
    }
  }

  /** Navigate to the search page with the current input value */
  function goToSearch() {
    const term = inputRef?.current?.value;
    navigate(SEARCH_ENDPOINT + (term ? `?q=${term}` : ''));
    aside.close();
  }

  /** Fetch search results based on the input value */
  function fetchResults(event) {
    fetcher.submit(
      {q: event.target.value || '', limit: 5, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form {...props} className={className} onSubmit={resetInput}>
      {children({inputRef, fetcher, fetchResults, goToSearch})}
    </fetcher.Form>
  );
}

/**
 * @typedef {(args: {
 *   fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
 *   goToSearch: () => void;
 *   inputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   fetcher: Fetcher<PredictiveSearchReturn>;
 * }) => React.ReactNode} SearchFormPredictiveChildren
 */
/**
 * @typedef {Omit<FormProps, 'children'> & {
 *   children: SearchFormPredictiveChildren | null;
 * }} SearchFormPredictiveProps
 */

/** @typedef {import('@remix-run/react').FormProps} FormProps */
/** @template T @typedef {import('@remix-run/react').Fetcher<T>} Fetcher */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
