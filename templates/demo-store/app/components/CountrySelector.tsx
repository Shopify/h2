import {Form, useFetchers, useLocation, useParams} from '@remix-run/react';
import {useCountries} from '~/hooks/useCountries';
import {Heading, Button, IconCheck} from '~/components';
import {useEffect, useRef} from 'react';

export function CountrySelector() {
  const countries = useCountries();

  const closeRef = useRef<HTMLDetailsElement>(null);
  const {pathname, search} = useLocation();
  const {lang} = useParams();

  const fetchers = useFetchers();
  useEffect(() => {
    closeRef.current?.removeAttribute('open');
  }, [fetchers]);

  if (!countries) return null;

  const selectedCountry = lang
    ? countries[`/${lang.toLowerCase()}`]
    : countries[''];
  const strippedPathname = lang ? pathname.replace(`/${lang}`, '') : pathname;

  return (
    <section className="grid gap-4 w-full md:max-w-[335px] md:ml-auto">
      <Heading size="lead" className="cursor-default" as="h3">
        Country
      </Heading>
      <div className="relative">
        <details
          className="border rounded border-contrast/30 dark:border-white open:round-b-none"
          ref={closeRef}
        >
          <summary className="flex items-center justify-between w-full py-3 px-4">
            {selectedCountry.label}
          </summary>
          <div className="overflow-auto border-t py-2 bg-contrast w-full max-h-36">
            {Object.keys(countries).map((countryPath) => {
              const locale = countries[countryPath];
              const isSelected =
                locale.language === selectedCountry.language &&
                locale.country === selectedCountry.country;
              const hreflang = `${locale.language}-${locale.country}`;
              return (
                <Form method="post" action="/locale" key={hreflang}>
                  <input
                    type="hidden"
                    name="language"
                    value={locale.language}
                  />
                  <input type="hidden" name="country" value={locale.country} />
                  <input
                    type="hidden"
                    name="path"
                    value={`${strippedPathname}${search}`}
                  />
                  <Button
                    className="text-contrast dark:text-primary text-contrast dark:text-primary
                      bg-primary dark:bg-contrast w-full p-2 transition rounded flex justify-start
                      items-center text-left cursor-pointer py-2 px-4"
                    type="submit"
                    variant="primary"
                  >
                    {locale.label}
                    {isSelected ? (
                      <span className="ml-2">
                        <IconCheck />
                      </span>
                    ) : null}
                  </Button>
                </Form>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}
