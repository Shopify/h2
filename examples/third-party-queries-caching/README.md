# Hydrogen example: Third-party Queries and Caching

This folder shows how to leverage Oxygen's sub-request caching when querying
third-party GraphQL API in Hydrogen. This example uses the public [Rick & Morty API](https://rickandmortyapi.com/documentation/#graphql)

<img width="981" alt="Screenshot 2023-11-13 at 3 51 32 PM" src="https://github.com/juanpprieto/hydrogen-third-party-api/assets/12080141/fe648c70-a979-4862-a173-4c0244543dec">

## Requirements

- Basic knowledge of GraphQL and the [Rick & Morty API](https://rickandmortyapi.com/documentation/#graphql)

## Install

Setup a new project with this example:

```bash
npm create @shopify/hydrogen@latest -- --template third-party-queries-caching
```

## Key files

This folder contains the minimal set of files needed to showcase the implementation.
Files that aren’t included by default with Hydrogen and that you’ll need to
create are labeled with 🆕.

| File                                                                                          | Description                                                      |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 🆕 [`app/lib/createRickAndMortyClient.server.ts`](app/lib/createRickAndMortyClient.server.ts) | Rick & Morty GraphQL client factory function with Oxygen caching |
| [`server.ts`](server.ts)                                                                      | Oxygen server worker                                             |
| [`remix.env.d.ts`](remix.env.d.ts)                                                            | (Optional) Oxygen/Hydrogen TypeScript types                      |
| [`app/routes/_index.tsx`](app/routes/_index.tsx)                                              | Hydrogen homepage route                                          |

## Instructions

### 1. Connect to your store to link the required environment variables

```bash
npx shopify hydrogen link
```

### 2. Copy over the new file `createRickAndMortyClient.server.ts` to `app/lib/`

### 3. Edit the worker file `server.ts`

import `createRickAndMortyClient`, create a client instance and pass it to the `getLoadedContext`.

```ts
import {createRickAndMortyClient} from './app/lib/createRickAndMortyClient.server';
// ...other imports

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      // ...other code

      /**
       * Create a Rick and Morty client.
       */
      const rickAndMorty = createRickAndMortyClient({ cache, waitUntil });

      /**
       * Create a Remix request handler and pass
       * Hydrogen's Storefront client to the loader context.
       */
      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => ({
          // ...other code
          rickAndMorty, //  Pass the Rick and Morty client to the action and loader context.
        }),
      });

      // ...other code
  } catch {}
};
```

[View the complete server.ts file](app/server.ts) to see these updates in context.

If using TypeScript you will also need to update `remix.en.d.ts`. Import `createRickAndMortyClient`
and add the `rickAndMorty` property to the `AppLoadContext` interface.

```ts
// ...other code
import {createRickAndMortyClient} from './app/lib/createRickAndMortyClient.server';

// ...other code

declare module '@shopify/remix-oxygen' {
  /**
   * Declare local additions to the Remix loader context.
   */
  export interface AppLoadContext {
    // ...other code
    rickAndMorty: ReturnType<typeof createRickAndMortyClient>;
  }
```

[View the complete remix.d.ts file](remix.d.ts) to see these updates in context.

## 4. Query the Rick & Morty API on the home route `/app/routes/_index.tsx`

Add the query to fetch Rick & Morty characters

```ts
const CHARACTERS_QUERY = `#graphql:rickAndMorty
  query {
    characters(page: 1) {
      results {
        name
        id
      }
    }
  }
`;
```

Query the Rick & Morty API inisde the `loader` function

```ts
export async function loader({context}: LoaderFunctionArgs) {
  const {characters} = await context.rickAndMorty.query(CHARACTERS_QUERY, {
    cache: CacheShort(),
  });
  return {characters};
}
```

Render the characters list in the homepage

```ts
type Character = {
  name: string;
  id: string;
};

export default function Homepage() {
  const {characters} = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Rick & Morty Characters</h1>
      {/* 2. Render data from the Rick & Morty GraphQL API: */}
      <ul>
        {(characters.results || []).map((character: Character) => (
          <li key={character.name}>{character.name}</li>
        ))}
      </ul>
    </div>
  );
}
```
