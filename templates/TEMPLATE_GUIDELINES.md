# Hydrogen Skeleton Template Guidelines

This initial document provides guidelines and opinionated best practices for developing in Remix and Hydrogen with the goal of building consistent and well structured code. This may evolve into more official recommendations, such as ESLint presets and other tooling to guide users to the outcomes defined below.

Topics covered:

- [Error Handling](#error-handling)
- [Template Dependencies](#template-dependencies)
- [Remix Route APIs](#remix-route-apis)
- [TypeScript](#typescript)
- [Remix Loader Return Values](#remix-loader-return-values)
- [GraphQL Query Definitions](#graphql-query-definitions)
- [Comment Styles](#comment-styles)

## Error Handling

Always demonstrate realistic error-handling. Skeleton templates should be a shining example of handling any sort of error that can occur. This will also help teach developers what kinds of errors could occur, where they occur, and how to handle them correctly.

### Do

- **Have an `ErrorBoundary` in every route template.** `ErrorBoundary` is used when an Error is thrown in a “loader”, and is generally meant for unexpected errors, like 500, 503, etc. Any Storefront query or mutation error will be handled by the `ErrorBoundary`. Type the error as “unknown” since _anything_ in JS can be thrown 🙂
- **Use the “errorElement” prop on every `<Await>` component.** When using “defer”, some promises may be rejected at a later time. The only way to handle this is to use the “errorElement” on the associated <Await> component, otherwise the error is swallowed.
- **Use try/catch** – except in “loader”, “action”, and the Component. Those three “Route Module APIs” are handled automatically by `ErrorBoundary` and CatchBoundary, but the rest – such as “meta”, “links”, “handle”, etc. – will crash the server if an error is thrown.

### Don’t

- **Use try/catch in “loader”, “action”, and the Component.** For templates it’s easier to let the error be thrown and get handled by the `ErrorBoundary` than to handle it manually.

### Examples

PR: <https://github.com/Shopify/hydrogen/pull/716>

Code:

```tsx
export async function loader() {
  /* failed Storefront API requests will throw to the ErrorBoundary */
  const data = storefront.query()


  /* If no page data is returned purposely throw to the CatchBoundary */
  if (!data?.page) {
    throw new Response('Page not found', { status: 404 })
  }

  //...
  return data
}

export function meta() {
  try {
    //
  catch(error) {
    //
  }
}

export function ErrorBoundary({error}) {
  return (<div>{error.message}</div>)
}

export default function TheUIComponents() {
  return (
    <Await resolve={} errorElement={<div>An error occurred</div>}>
      //
    </Await>
  )
}
```

## Template Dependencies

Minimalize dependencies and shared code between templates; template files are meant to stand alone in a given Hydrogen storefront.

### Do

- Keep all code associated with a template in a single template file, even if that means some duplication in templates

### Don't

- Share code between templates in a separate file. There is no guarantee that any given project will need both those templates, and we also want to avoid issues associated with generating multiple files (such as file organization).
- Use `npm` packages or dependencies in templates that aren't directly associated with Hydrogen or Remix. A package like `tiny-invariant` could be 1) confusing to developers unfamiliar with it, 2) abstract away things that we want to teach, such as correct error handling, and 3) require us to figure out how to correctly give direction on installation and updating the `package.json` upon template creation.

<!-- ## Code Organization

Maintain consistency in the styling of the code and the order that things are done within them. This helps developers jump between our templates and know where to look for certain things like `loaders`, etc. -->

<!-- ### Module and Type Imports

Route module imports should follow this proposed order (sorted alphabetically where applicable)

#### Example

```tsx
/* node_modules first */
import invariant from "tiny-invariant";
import { useState } from "react";

/* aliased second */
import { MyComponent } from "~/components";
import { atob, btoa, parser } from "~/lib";

/* local imports third */
import { myFunction } from "./myFunction";

/* type imports last */
import type { Shop } from "@shopify/hydrogen-react/storefront-api-types";
``` -->

## Remix Route APIs

Remix-specific route API functions should be ordered and consistent in style, to help developers quickly scan and find what they're looking for.

### Do

- Order these APIs following a top-down order of concerns:
  1. Http header tweaks (`shouldRevalidate`, `headers`, `meta`, `links`)
  1. Data manipulation (`loader`, `action`)
  1. UI (`Component`)
  1. Error handling (`ErrorBoundary`)
  1. Storefront API GraphQL query strings
- Use function declarations when possible
- Use the most specific type available for Remix Route APIs.

### Example

```tsx
/* module imports... */
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from '@shopify/remix-oxygen';

/* local type defintions */

export async function handle() {}

export async function shouldRevalidate() {}

export async function headers() {}

export async function meta() {}

export async function links() {}

export async function loader({}: LoaderFunctionArgs) {}

export async function action({}: ActionFunctionArgs) {}

export default function Component() {}

export function ErrorBoundary() {}

/* storefront Queries/Mutations, see more specific recommendations below  */
```

## TypeScript

Use the types generated automatically for the Storefront API. This not only demonstrates to devs what these types are and where they can be used, but also helps our repo automatically stay up-to-date with Storefront API changes. It also preserves the human-readable documentation that the Storefront API has on each Storefront object and property.

### Do

- Use the types from `'@shopify/hydrogen/storefront-api-types'`
- Use TypeScript utilities, such as `Pick`, `Omit`, etc. to format the type into the shape you need
- Use `type` over `interface` when possible
- Use `type` when importing types from packages

### Example

```ts
import type {Product} from '@shopify/hydrogen/storefront-api-types';
type MyCustomProduct = Pick<Product, 'name' | 'description'>;
```

## Remix Loader Return Values

Use the correct return type in `loader()`, `action()`, etc.

### Do

- Return raw json object by default
- Use `await` if you want the data to be streamed in later
- Use `redirect()` from the `@shopify/remix-oxygen` package to redirect
- Use `data()` for errors (like 404s)
- Use `new Response()` for unique document responses like `.xml` and `.txt`
- Use capitalized and kebab-cased headers in responses, like `Cache-Control`

### Example

```tsx
export async function loader() {
  return {foo: 'bar'};
}
```

```tsx
import {redirect} from ''@shopify/remix-oxygen';';
export async function loader() {
  return redirect('/');
}
```

```tsx
export async function loader() {
  return data(
    {foo: 'bar'},
    {
      headers: {
        'Cache-Control': 'none',
      },
    },
  );
}
```

## Graphql Query Definitions

Be consistent in the query's variable name, in addition to the query's name in the query string. This helps the variables to be easily found, and ensure that tooling (like GraphQL Codegen) doesn't have conflicts in query types and results.

### Do

- Declare query and mutation constant names in SCREAMING_SNAKE_CASE
- Ensure that the query name itself is a (globally-unique) name based on the filename and the query contents
- Place the query at the bottom of the route template. See the [Remix Route APIs](#remix-route-apis) for more details

### Example

```tsx
// in '/product.tsx'
const QUERY_SHOP = `#graphql
  query product_shop {
    shop {
      ...
    }
  }
`;
```

```tsx
// in '/collection.tsx'
const MUTATION_ADD_TO_CART = `#graphql
  mutation collection_add_to_cart {
    ...
  }
`;
```

## Comment Styles

Use `//` for single-line comments, and `/** */` for multi-line comments. Consider adding a header section for additional context or extremely long comment blocks.

### Example

```tsx
// this is fine for single lines
function test() {}

/**
 * If you're providing substantial context, links, example code and other stuff,
 * then you should switch to something that really visually differentiates.
 */
function thing() {}

/**
 * myStuff
 * -----------------
 * Renders a login page for customer accounts.
 * And does other really cool stuff
 */
function myStuff() {}
```
