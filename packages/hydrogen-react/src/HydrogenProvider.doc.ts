import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs';

const data: ReferenceEntityTemplateSchema = {
  name: 'HydrogenProvider',
  category: 'components',
  isVisualComponent: false,
  related: [
    {
      name: 'useShop',
      type: 'hook',
      url: '/api/hydrogen-react/hooks/useshop',
    },
  ],
  description:
    "The `HydrogenProvider` component wraps your entire Hydrogen app and provides localization data for the app. You should place it in your app's entry point component.",
  type: 'component',
  defaultExample: {
    description: 'I am the default example',
    codeblock: {
      tabs: [
        {
          title: 'JavaScript',
          code: './HydrogenProvider.example.jsx',
          language: 'jsx',
        },
        {
          title: 'TypeScript',
          code: './HydrogenProvider.example.tsx',
          language: 'tsx',
        },
      ],
      title: 'Example code',
    },
  },
  definitions: [
    {
      title: 'Props',
      type: 'HydrogenContextProps',
      description: '',
    },
  ],
};

export default data;
