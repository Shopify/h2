# Hydrogen example: Subscriptions / Selling Plans

This folder contains an example implementation of [subscriptions](https://shopify.dev/docs/apps/selling-strategies/subscriptions) for Hydrogen. It shows how to display selling plans on a product page.

![subscriptions-example](https://github.com/Shopify/hydrogen/assets/12080141/1cea5fbf-5a56-4562-95a7-4821facb3c6d)

## Requirements

This example is connected to the `hydrogen-preview` storefront which contains one example subscription product (`shopify-wax`).

To run this example on your own store, you'll need to:

- Install a [subscription app](https://apps.shopify.com/shopify-subscriptions).
- Use the subscription app to create a selling plan for a product.

## Install

Setup a new project with this example:

```bash
npm create @shopify/hydrogen@latest -- --template subscriptions
```

## Key files

This folder contains the minimal set of files needed to showcase the implementation.

| File                                                                                  | Description                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.env.example`](.env)                                                                | Environment variable file. This project is connected to the `hydrogen-preview` storefront which has one example subscription product (`shopify-wax`). |
| [`server.ts`](server.ts)                                                              | Application entry point modified to fetch selected selling plans from cart lines.                                                                     |
| 🆕 [`app/components/SellingPlanSelector.tsx`](app/components/SellingPlanSelector.tsx) | A component that simplifies selecting sellingPlans subscription options                                                                               |
| [`app/routes/product.$handle.tsx`](app/routes/product.$handle.tsx)                    | Product page modified to display subscription options.                                                                                                |
| [`app/components/Cart.tsx`](app/components/Cart.tsx)                                  | Cart component modified to display selected subscription.                                                                                             |

## Instructions

### 1. Copy over the new files

- In your Hydrogen app, create the new files from the file list above, copying in the code as you go.
- If you already have a `.env` file, ensure the key-value pairs from `.env.example` are present

### 2. Adjust the cart query in `server.ts`

Edit the CART_QUERY_FRAGMENT `CartLine` fragment and include [sellingPlanAllocation](https://shopify.dev/docs/api/storefront/2023-10/objects/sellingplanallocation)

```diff
const CART_QUERY_FRAGMENT = `#graphql
  # ...other code

  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
+   sellingPlanAllocation {
+     sellingPlan {
+        name
+     }
+    }
  }
  fragment CartApiQuery on Cart {
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
    }
    # ...other code
  }
` as const;
```

[View the complete component file](server.ts) to see these updates in context.

### 3. Adjust the `/app/routes/products.$handle.tsx` route to support `sellingPLans`

### 3.1 Import the `SellingPlanSelector` component and type

```diff
+ import { SellingPlanSelector, type SellingPlanGroup } from '~/components/SellingPlanSelector';
```

### 3.2 Update the product query to fetch subscriptions data

First, add the `SELLING_PLAN_FRAGMENT` and `SELLING_PLAN_GROUP_FRAGMENT` fragments

```diff
+ const SELLING_PLAN_FRAGMENT = `#graphql
+ fragment SellingPlanMoney on MoneyV2 {
+   amount
+   currencyCode
+ }
+
+ fragment SellingPlan on SellingPlan {
+   id
+   options {
+     name
+     value
+   }
+  priceAdjustments {
+    adjustmentValue {
+      ... on SellingPlanFixedAmountPriceAdjustment {
+        __typename
+        adjustmentAmount {
+          ... on MoneyV2 {
+             ...SellingPlanMoney
+          }
+        }
+      }
+      ... on SellingPlanFixedPriceAdjustment {
+        __typename
+        price {
+          ... on MoneyV2 {
+            ...SellingPlanMoney
+          }
+        }
+      }
+      ... on SellingPlanPercentagePriceAdjustment {
+        __typename
+        adjustmentPercentage
+      }
+    }
+    orderCount
+  }
+  recurringDeliveries
+  checkoutCharge {
+    type
+    value {
+      ... on MoneyV2 {
+        ...SellingPlanMoney
+      }
+      ... on SellingPlanCheckoutChargePercentageValue {
+        percentage
+      }
+    }
+  }
+ }
` as const;

+ const SELLING_PLAN_GROUP_FRAGMENT = `#graphql
+   ${SELLING_PLAN_FRAGMENT}
+   fragment SellingPlanGroup on SellingPlanGroup {
+     name
+     options {
+       name
+       values
+     }
+     sellingPlans(first:10) {
+       nodes {
+         ...SellingPlan
+       }
+     }
+   }
+ ` as const;
```

Next, update the `PRODUCT_FRAGMENT` to include `sellinPlanGroups` in the query

```diff
const PRODUCT_FRAGMENT = `#graphql
  ${PRODUCT_VARIANT_FRAGMENT}
+  ${SELLING_PLAN_GROUP_FRAGMENT}

  fragment Product on Product {
    # ...other code
+   sellingPlanGroups(first:10) {
+     nodes {
+       ...SellingPlanGroup
+     }
+   }
  }
` as const;
```

### 3.3 Update the `loader` logic

```ts
export async function loader({params, request, context}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;

  // 2. Get the selected selling plan id from the request url
  const selectedSellingPlanId =
    new URL(request.url).searchParams.get('selling_plan') ?? null;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // 3. Get the selected selling plan from the product
  const selectedSellingPlan =
    product.sellingPlanGroups.nodes?.[0]?.sellingPlans.nodes?.find(
      (sellingPlan) => sellingPlan.id === selectedSellingPlanId,
    ) ?? null;

  /**
    4. If the product includes selling plans but no selling plan is selected, we
    redirect to the first selling plan, so that's is selected by default
  **/
  if (product.sellingPlanGroups.nodes?.length && !selectedSellingPlan) {
    const firstSellingPlanId =
      product.sellingPlanGroups.nodes[0].sellingPlans.nodes[0].id;
    return redirect(
      `/products/${product.handle}?selling_plan=${firstSellingPlanId}`,
    );
  }

  const selectedVariant = product.variants.nodes[0];

  // 5. Pass the selectedSellingPlan to the client
  return {product, selectedVariant, selectedSellingPlan};
}
```

### 3.4 Update the default `<Product />` component

```diff
export default function Product() {
  const {
    product,
+   selectedSellingPlan,
    selectedVariant
  } = useLoaderData<typeof loader>();
  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <ProductMain
        selectedVariant={selectedVariant}
+       selectedSellingPlan={selectedSellingPlan}
        product={product}
      />
    </div>
  );
}
```

### 3.5 Add the `<SellingPlanGroup />` component to render the selling plan options

> [!NOTE]
> Update as you see fit to match your design and requirements

```ts
//
function SellingPlanGroup({
  sellingPlanGroup,
}: {
  sellingPlanGroup: SellingPlanGroup;
}) {
  return (
    <div key={sellingPlanGroup.name}>
      <p className="mb-2">
        <strong>{sellingPlanGroup.name}:</strong>
      </p>
      {sellingPlanGroup.sellingPlans.nodes.map((sellingPlan) => {
        return (
          <Link
            key={sellingPlan.id}
            prefetch="intent"
            to={sellingPlan.url}
            className={`border inline-block p-4 mr-2 leading-none py-1 border-b-[1.5px] hover:no-underline cursor-pointer transition-all duration-200
                  ${
                    sellingPlan.isSelected
                      ? 'border-gray-500'
                      : 'border-neutral-50'
                  }`}
            preventScrollReset
            replace
          >
            <p>
              {sellingPlan.options.map(
                (option) => `${option.name} ${option.value}`,
              )}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
```

### 3.6 Update the `ProductForm` component to support subscriptions selection

```ts
function ProductForm({
  selectedSellingPlan,
  selectedVariant,
  sellingPlanGroups,
}: {
  selectedSellingPlan: SellingPlanFragment | null;
  selectedVariant: ProductVariantFragment;
  sellingPlanGroups: ProductFragment['sellingPlanGroups'];
}) {
  return (
    <div className="product-form">
      {/* 4. Add the SellingPlanSelector component inside the ProductForm */}
      <SellingPlanSelector
        sellingPlanGroups={sellingPlanGroups}
        selectedSellingPlan={selectedSellingPlan}
      >
        {({sellingPlanGroup}) => (
          /* 5. Render the SellingPlanGroup component inside the SellingPlanSelector */
          <SellingPlanGroup
            key={sellingPlanGroup.name}
            sellingPlanGroup={sellingPlanGroup}
          />
        )}
      </SellingPlanSelector>
      <br />

      {/* 6. Update the AddToCart button text and pass in the sellingPlanId */}
      <AddToCartButton
        disabled={
          !selectedVariant ||
          !selectedVariant.availableForSale ||
          !selectedSellingPlan
        }
        onClick={() => {
          window.location.href = window.location.href + '#cart-aside';
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant?.id,
                  sellingPlanId: selectedSellingPlan?.id,
                  quantity: 1,
                },
              ]
            : []
        }
      >
        {sellingPlanGroups.nodes
          ? selectedSellingPlan
            ? 'Subscribe'
            : 'Select a subscription'
          : selectedVariant?.availableForSale
          ? 'Add to cart'
          : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}
```

### 3.7 Update `<ProductMain />`

Get the `selectedSellingPlan` and pass it to the `<ProductPrice />` component

```diff
function ProductMain({
  selectedVariant,
+ selectedSellingPlan,
  product,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['variants']['nodes'][0];
+ selectedSellingPlan: SellingPlanFragment | null;
}) {
  const {title, descriptionHtml, sellingPlanGroups} = product;

  return (
    <div className="product-main">
      <h1>{title}</h1>
      <ProductPrice
        selectedVariant={selectedVariant}
+       selectedSellingPlan={selectedSellingPlan}
      />
      <br />
      <ProductForm
        selectedVariant={selectedVariant}
+       selectedSellingPlan={selectedSellingPlan}
        sellingPlanGroups={sellingPlanGroups}
      />
      <br />
      <p>
        <strong>Description</strong>
      </p>
      <br />
      <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
      <br />
    </div>
  );
}
```

### 3.8 Update `<ProductPrice />` to support selling plans pricing

Split the pricing rendering logic for products containing selling plans `<SellingPlanPrice />` and regular products `<ProductVariantPrice />`

```ts
function ProductPrice({
  selectedVariant,
  selectedSellingPlan,
}: {
  selectedVariant: ProductVariantFragment;
  selectedSellingPlan: SellingPlanFragment | null;
}) {
  return (
    <div className="product-price">
      {selectedSellingPlan ? (
        <SellingPlanPrice
          selectedSellingPlan={selectedSellingPlan}
          selectedVariant={selectedVariant}
        />
      ) : (
        <ProductVariantPrice selectedVariant={selectedVariant} />
      )}
    </div>
  );
}

type SellingPlanPrice = {
  amount: number;
  currencyCode: CurrencyCode;
};

/*
  Render the selected selling plan price is available
*/
function SellingPlanPrice({
  selectedSellingPlan,
  selectedVariant,
}: {
  selectedSellingPlan: SellingPlanFragment;
  selectedVariant: ProductVariantFragment;
}) {
  const sellingPlanPriceAdjustments = selectedSellingPlan?.priceAdjustments;

  if (!sellingPlanPriceAdjustments?.length) {
    return <Money data={selectedVariant.price} />;
  }

  const selectedVariantPrice: SellingPlanPrice = {
    amount: parseFloat(selectedVariant.price.amount),
    currencyCode: selectedVariant.price.currencyCode,
  };

  const sellingPlanPrice: SellingPlanPrice = sellingPlanPriceAdjustments.reduce(
    (acc, adjustment) => {
      switch (adjustment.adjustmentValue.__typename) {
        case 'SellingPlanFixedAmountPriceAdjustment':
          return {
            amount:
              acc.amount +
              parseFloat(adjustment.adjustmentValue.adjustmentAmount.amount),
            currencyCode: acc.currencyCode,
          };
        case 'SellingPlanFixedPriceAdjustment':
          return {
            amount: parseFloat(adjustment.adjustmentValue.price.amount),
            currencyCode: acc.currencyCode,
          };
        case 'SellingPlanPercentagePriceAdjustment':
          return {
            amount:
              acc.amount *
              (1 - adjustment.adjustmentValue.adjustmentPercentage),
            currencyCode: acc.currencyCode,
          };
        default:
          return acc;
      }
    },
    selectedVariantPrice,
  );

  return (
    <div className="selling-plan-price">
      <Money
        data={{
          amount: `${sellingPlanPrice.amount}`,
          currencyCode: sellingPlanPrice.currencyCode,
        }}
      />
    </div>
  );
}

/**
  Render the price of a product that does not have selling plans
**/
function ProductVariantPrice({
  selectedVariant,
}: {
  selectedVariant: ProductVariantFragment;
}) {
  return selectedVariant?.compareAtPrice ? (
    <>
      <p>Sale</p>
      <br />
      <div className="product-price-on-sale">
        {selectedVariant ? <Money data={selectedVariant.price} /> : null}
        <s>
          <Money data={selectedVariant.compareAtPrice} />
        </s>
      </div>
    </>
  ) : (
    selectedVariant?.price && <Money data={selectedVariant?.price} />
  );
}
```

[View the complete product file](app/routes/product.$handle.tsx) to see these updates in context.
