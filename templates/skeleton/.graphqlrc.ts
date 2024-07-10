import type {IGraphQLConfig} from 'graphql-config';
import {getSchema} from '@shopify/hydrogen-codegen';

// See information for GraphQL Config:
// https://the-guild.dev/graphql/config/docs/user/usage
export default {
  projects: {
    default: {
      schema: getSchema('storefront'),
      documents: [
        './*.{ts,tsx,js,jsx}',
        './app/**/*.{ts,tsx,js,jsx}',
        '!./app/graphql/**/*.{ts,tsx,js,jsx}',
      ],
    },

    customer: {
      schema: getSchema('customer-account'),
      documents: ['./app/graphql/customer-account/*.{ts,tsx,js,jsx}'],
    },

    // Add your own GraphQL projects here for CMS, Shopify Admin API, etc.
  },
} as IGraphQLConfig;
