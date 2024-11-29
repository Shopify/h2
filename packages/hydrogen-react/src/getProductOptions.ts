import {validate} from 'graphql';
import {
  decodeEncodedVariant,
  isOptionValueCombinationInEncodedVariant,
} from './optionValueDecoder';
import type {
  Maybe,
  Product,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
  SelectedOption,
} from './storefront-api-types';
import {PartialDeep} from 'type-fest';

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};
type ProductOptionsMapping = Record<string, number>;
type ProductOptionValueState = {
  variant: ProductVariant;
  handle: string;
  variantUriQuery: string;
  selected: boolean;
  exists: boolean;
  available: boolean;
  isDifferentProduct: boolean;
};
type MappedProductOptionValue = ProductOptionValue & ProductOptionValueState;

/**
 * Creates a mapping of product options to their index for matching encoded values
 * For example, a product option of
 *  [
 *    {
 *      name: 'Color',
 *      optionValues: [{name: 'Red'}, {name: 'Blue'}]
 *    },
 *    {
 *      name: 'Size',
 *      optionValues: [{name: 'Small'}, {name: 'Medium'}, {name: 'Large'}]
 *    }
 *  ]
 * Would return
 *  [
 *    {Red: 0, Blue: 1},
 *    {Small: 0, Medium: 1, Large: 2}
 *  ]
 * @param options
 * @returns
 */
function mapProductOptions(options: ProductOption[]): ProductOptionsMapping[] {
  return options.map((option) => {
    return Object.assign(
      {},
      ...option?.optionValues.map((value, index) => {
        return {[value.name]: index};
      }),
    );
  });
}

/**
 * Converts the product option into an Object<key, value> for building query params
 * For example, a selected product option of
 *  [
 *    {
 *      name: 'Color',
 *      value: 'Red',
 *    },
 *    {
 *      name: 'Size',
 *      value: 'Medium',
 *    }
 *  ]
 * Would return
 *  {
 *    Color: 'Red',
 *    Size: 'Medium',
 *  }
 */
function mapSelectedProductOptionToObject(
  options: Pick<SelectedOption, 'name' | 'value'>[],
) {
  return Object.assign(
    {},
    ...options.map((key) => {
      return {[key.name]: key.value};
    }),
  );
}

/**
 *
 * @param options Returns selected options as a JSON string
 * @returns
 */
function mapSelectedProductOptionToObjectAsString(
  options: Pick<SelectedOption, 'name' | 'value'>[],
) {
  return JSON.stringify(mapSelectedProductOptionToObject(options));
}

/**
 * Encode the selected product option as a key for mapping to the encoded variants
 * For example, a selected product option of
 *  [
 *    {
 *      name: 'Color',
 *      value: 'Red',
 *    },
 *    {
 *      name: 'Size',
 *      value: 'Medium',
 *    }
 *  ]
 * Would return
 *  [0,1]
 *
 * Also works with the result of mapSelectedProductOption. For example:
 *  {
 *    Color: 'Red',
 *    Size: 'Medium',
 *  }
 * Would return
 *  [0,1]
 *
 * @param selectedOption - The selected product option
 * @param productOptionMappings - The result of product option mapping from mapProductOptions
 * @returns
 */
function encodeSelectedProductOptionAsKey(
  selectedOption:
    | Pick<SelectedOption, 'name' | 'value'>[]
    | Record<string, string>,
  productOptionMappings: ProductOptionsMapping[],
) {
  if (Array.isArray(selectedOption)) {
    return JSON.stringify(
      selectedOption.map((key, index) => {
        return productOptionMappings[index][key.value];
      }),
    );
  } else {
    return JSON.stringify(
      Object.keys(selectedOption).map((key, index) => {
        return productOptionMappings[index][selectedOption[key]];
      }),
    );
  }
}

/**
 * Takes an array of product variants and maps them to an object with the encoded selected option values as the key.
 * For example, a product variant of
 * [
 *  {
 *    id: 1,
 *    selectedOptions: [
 *      {name: 'Color', value: 'Red'},
 *      {name: 'Size', value: 'Small'},
 *    ],
 *  },
 *  {
 *    id: 2,
 *    selectedOptions: [
 *      {name: 'Color', value: 'Red'},
 *      {name: 'Size', value: 'Medium'},
 *    ],
 *  }
 * ]
 * Would return
 * {
 *    '[0,0]': {id: 1, selectedOptions: [{name: 'Color', value: 'Red'}, {name: 'Size', value: 'Small'}]},
 *    '[0,1]': {id: 2, selectedOptions: [{name: 'Color', value: 'Red'}, {name: 'Size', value: 'Medium'}]},
 * }
 * @param variants
 * @param productOptionMappings
 * @returns
 */
function mapVariants(
  variants: ProductVariant[],
  productOptionMappings: ProductOptionsMapping[],
) {
  return Object.assign(
    {},
    ...variants.map((variant) => {
      const variantKey = encodeSelectedProductOptionAsKey(
        variant.selectedOptions || [],
        productOptionMappings,
      );
      return {[variantKey]: variant};
    }),
  );
}

export type MappedProductOptions = Omit<ProductOption, 'optionValues'> & {
  optionValues: MappedProductOptionValue[];
};

const PRODUCT_INPUTS = [
  'options',
  'selectedOrFirstAvailableVariant',
  'adjacentVariants',
];

const PRODUCT_INPUTS_EXTRA = [
  'handle',
  'encodedVariantExistence',
  'encodedVariantAvailability',
];

function logError(key: string) {
  console.error(
    `[h2:error:getProductOptions] product.${key} is missing. Make sure you query for this field from the Storefront API.`,
  );
  return false;
}

export function checkProductParam(
  product: RecursivePartial<Product>,
  checkAll = false,
): Product {
  let validParam = true;
  const productKeys = Object.keys(product);

  // Check product input
  (checkAll
    ? [...PRODUCT_INPUTS, ...PRODUCT_INPUTS_EXTRA]
    : PRODUCT_INPUTS
  ).forEach((key) => {
    if (!productKeys.includes(key)) {
      validParam = logError(key);
    }
  });

  // Check for nested options requirements
  if (product.options) {
    // Check for options.optionValues
    if (product?.options[0]?.optionValues) {
      const firstOptionValues = product.options[0].optionValues[0];

      // Check for options.optionValues.name
      if (checkAll && !firstOptionValues?.name) {
        validParam = logError('options.optionValues.name');
      }

      // Check for options.optionValues.firstSelectableVariant
      if (firstOptionValues?.firstSelectableVariant) {
        // check product variant
        validParam = checkProductVariantParam(
          firstOptionValues.firstSelectableVariant,
          'options.optionValues.firstSelectableVariant',
          validParam,
          checkAll,
        );
      } else {
        validParam = logError('options.optionValues.firstSelectableVariant');
      }
    } else {
      validParam = logError('options.optionValues');
    }
  }

  // Check for nested selectedOrFirstAvailableVariant requirements
  if (product.selectedOrFirstAvailableVariant) {
    validParam = checkProductVariantParam(
      product.selectedOrFirstAvailableVariant,
      'selectedOrFirstAvailableVariant',
      validParam,
      checkAll,
    );
  }

  // Check for nested adjacentVariants requirements
  if (!!product.adjacentVariants && product.adjacentVariants[0]) {
    validParam = checkProductVariantParam(
      product.adjacentVariants[0],
      'adjacentVariants',
      validParam,
      checkAll,
    );
  }

  return (validParam ? product : {}) as Product;
}

function checkProductVariantParam(
  variant: RecursivePartial<ProductVariant>,
  key: string,
  currentValidParamState: boolean,
  checkAll: boolean,
): boolean {
  let validParam = currentValidParamState;

  if (checkAll && !variant.product?.handle) {
    validParam = logError(`${key}.product.handle`);
  }
  if (variant.selectedOptions) {
    const firstSelectedOption = variant.selectedOptions[0];
    if (!firstSelectedOption?.name) {
      validParam = logError(`${key}.selectedOptions.name`);
    }
    if (!firstSelectedOption?.value) {
      validParam = logError(`${key}.selectedOptions.value`);
    }
  } else {
    validParam = logError(`${key}.selectedOptions`);
  }

  return validParam;
}

/**
 * Finds all the variants provided by adjacentVariants, options.optionValues.firstAvailableVariant,
 * and selectedOrFirstAvailableVariant and return them in a single array
 * @param product
 * @returns
 */
export function getAdjacentAndFirstAvailableVariants(
  product: RecursivePartial<Product>,
) {
  // Checks for valid product input
  const checkedProduct = checkProductParam(product);

  if (!checkedProduct.options) return [];

  const availableVariants: Record<string, ProductVariant> = {};
  checkedProduct.options.map((option) => {
    option.optionValues?.map((value) => {
      if (!!value.firstSelectableVariant) {
        const variantKey = mapSelectedProductOptionToObjectAsString(
          value.firstSelectableVariant.selectedOptions,
        );
        availableVariants[variantKey] = value.firstSelectableVariant;
      }
    });
  });

  checkedProduct.adjacentVariants.map((variant) => {
    const variantKey = mapSelectedProductOptionToObjectAsString(
      variant.selectedOptions,
    );
    availableVariants[variantKey] = variant;
  });

  const selectedVariant = checkedProduct.selectedOrFirstAvailableVariant;
  if (!!selectedVariant) {
    const variantKey = mapSelectedProductOptionToObjectAsString(
      selectedVariant.selectedOptions,
    );
    availableVariants[variantKey] = selectedVariant;
  }

  return Object.values(availableVariants);
}

export function getProductOptions(
  product: RecursivePartial<Product>,
): MappedProductOptions[] {
  // Checks for valid product input
  const checkedProduct = checkProductParam(product, true);

  if (!checkedProduct.options) return [];

  const {
    options,
    selectedOrFirstAvailableVariant: selectedVariant,
    adjacentVariants,
    encodedVariantExistence,
    encodedVariantAvailability,
    handle: productHandle,
  } = checkedProduct;
  // Get a mapping of product option names to their index for matching encoded values
  const productOptionMappings = mapProductOptions(options);

  // Get the adjacent variants mapped to the encoded selected option values
  const variants = mapVariants(
    selectedVariant ? [selectedVariant, ...adjacentVariants] : adjacentVariants,
    productOptionMappings,
  );

  // Get the key:value version of selected options for building url query params
  const selectedOptions = mapSelectedProductOptionToObject(
    selectedVariant ? selectedVariant.selectedOptions : [],
  );

  const productOptions = options.map((option, optionIndex) => {
    return {
      ...option,
      optionValues: option.optionValues.map((value) => {
        const targetOptionParams = {...selectedOptions}; // Clones the selected options

        // Modify the selected option value to the current option value
        targetOptionParams[option.name] = value.name;

        // Encode the new selected option values as a key for mapping to the product variants
        const targetKey = encodeSelectedProductOptionAsKey(
          targetOptionParams || [],
          productOptionMappings,
        );

        // Top-down option check for existence and availability
        const topDownKey = JSON.parse(targetKey).slice(0, optionIndex + 1);
        const exists = isOptionValueCombinationInEncodedVariant(
          topDownKey,
          encodedVariantExistence || '',
        );
        let available = isOptionValueCombinationInEncodedVariant(
          topDownKey,
          encodedVariantAvailability || '',
        );

        // Get the variant for the current option value if exists, else use the first selectable variant
        const variant: ProductVariant =
          variants[targetKey] || value.firstSelectableVariant;

        // Build the query params for this option value
        const variantOptionParam = mapSelectedProductOptionToObject(
          variant.selectedOptions || [],
        );
        const searchParams = new URLSearchParams(variantOptionParam);
        const handle = variant?.product?.handle;

        return {
          ...value,
          variant,
          handle,
          variantUriQuery: searchParams.toString(),
          selected: selectedOptions[option.name] === value.name,
          exists,
          available,
          isDifferentProduct: handle !== productHandle,
        };
      }),
    };
  });

  // Workaround for bug in encodedVariantAvailability
  // Remove once https://github.com/Shopify/combined-listings-app/issues/2377 is resolved
  const optionsAvailable: boolean[] = [];
  productOptions.reverse().map((option, optionIndex) => {
    let optionAvailable = false;
    if (optionIndex === 0) {
      // Make sure leaf option values always reflect the variant's availableForSale attribute
      option.optionValues.map((value, valueIndex) => {
        if (!value.isDifferentProduct) {
          const available = value.variant.availableForSale;
          productOptions[optionIndex].optionValues[valueIndex].available =
            available;
          if (available) optionAvailable = true;
        }
      });
    } else {
      // If not the last option, for selected optionValue, check for previous option for availability
      const selectedValue = option.optionValues.filter(
        (value) => value.selected,
      );
      const previousOptionAvailable = optionsAvailable[optionIndex - 1];
      if (
        selectedValue &&
        selectedValue.length === 1 &&
        !selectedValue[0].isDifferentProduct
      ) {
        selectedValue[0].available = previousOptionAvailable;
        if (previousOptionAvailable) optionAvailable = true;
      }
    }

    // Keep track of availability of the current option
    optionsAvailable.push(optionAvailable);
  });

  return productOptions.reverse();
}
