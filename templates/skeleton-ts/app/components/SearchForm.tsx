import {useRef, useEffect} from 'react';
import {Form, type FormProps} from '@remix-run/react';

type SearchFormProps = Omit<FormProps, 'children'> & {
  children: (args: {
    inputRef: React.RefObject<HTMLInputElement>;
  }) => React.ReactNode;
};

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
 */
export function SearchForm({children, ...props}: SearchFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

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
 */
function useFocusOnCmdK(inputRef: React.RefObject<HTMLInputElement>) {
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
  }, [inputRef]);
}
