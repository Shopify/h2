import {type LinksFunction} from '@remix-run/node';
import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useParams,
} from '@remix-run/react';
import stylesheet from '~/tailwind.css?url';
import {Fragment, useCallback, useState} from 'react';
import he from 'he';

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: stylesheet},
];

export async function loader() {
  const {default: data} = await import('virtual:docs.json');

  for (const doc of data) {
    for (const tab of doc.defaultExample.codeblock.tabs) {
      tab.code = he.decode(tab.code);
    }
  }

  return {data};
}

export default function App() {
  const {data} = useLoaderData<typeof loader>();
  // group the data by category
  const categories = data.reduce((acc: Record<string, any[]>, doc: any) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {});

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="w-full">
        <div className="flex p-4 w-full">
          <div className="flex flex-col w-1/4">
            {Object.keys(categories).map((category) => (
              <Category
                key={category}
                name={category}
                category={categories[category]}
              />
            ))}
          </div>
          <div>
            <Outlet />
          </div>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Category({name, category}: {name: string; category: any[]}) {
  const {doc} = useParams();
  const defaultExpanded = useCallback(() => {
    return category.find((categoryDoc) => categoryDoc.name === doc);
  }, [doc, category]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Fragment>
      <button
        className="text-left font-bold"
        onClick={() => setExpanded(!expanded)}
      >
        {name}
      </button>
      {expanded ? (
        <div className="flex flex-col pl-4">
          {category.map((doc: any) => (
            <NavLink
              key={doc.name}
              to={`/${doc.name}`}
              className={({isActive}) => (isActive ? 'underline' : '')}
            >
              {doc.name}
            </NavLink>
          ))}
        </div>
      ) : null}
    </Fragment>
  );
}
