import {useRef, useEffect} from 'react';
import {Form} from '@remix-run/react';

/**
 * Search form component that sends search requests to the `/search` route.
 * @example
 * ```tsx
 * <SearchForm>
 *  {({inputRef}) => (
 *    <>
 *      <input
 *        ref={inputRef}
 *        type="search"
 *        defaultValue={term}
 *        name="q"
 *        placeholder="Search…"
 *      />
 *      <button type="submit">Search</button>
 *   </>
 *  )}
 *  </SearchForm>
 * @param {SearchFormProps}
 */
export function SearchForm({children, ...props}) {
  const inputRef = useRef(null);

  useFocusOnCmdK(inputRef);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <Form method="get" {...props}>
      {children({inputRef})}
    </Form>
  );
}

/**
 * Focuses the input when cmd+k is pressed
 * @param {React.RefObject<HTMLInputElement>} inputRef
 */
function useFocusOnCmdK(inputRef) {
  // focus the input when cmd+k is pressed
  useEffect(() => {
    function handleKeyDown(event) {
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
  }, [inputRef]);
}

/**
 * @typedef {Omit<FormProps, 'children'> & {
 *   children: (args: {
 *     inputRef: React.RefObject<HTMLInputElement>;
 *   }) => React.ReactNode;
 * }} SearchFormProps
 */

/** @typedef {import('@remix-run/react').FormProps} FormProps */
