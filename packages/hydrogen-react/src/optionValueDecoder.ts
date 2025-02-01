/**
 * This file provides utility functions for determining whether or not an option value combination is present in an encoded option value string.
 *
 * In V1 of the encoding strategy, option value arrays are encoded as a trie with the following rules:
 *  - `:` `,` ` ` and `-` are control characters.
 *  - `:` indicates a new option. ex: 0:1 indicates value 0 for the option in position 1, value 1 for the option in position 2.
 *  - `,` indicates the end of a repeated prefix, mulitple consecutive commas indicate the end of multiple repeated prefixes.
 *  - ` ` indicates a gap in the sequence of option values. ex: `0 4` indicates option values in position 0 and 4 are present.
 *  - `-` indicates a continuous range of option values. ex: `0 1-3 4`. Ranges are only present encoded in the final option value position, so for example the trie for the set [[0,0,0],[0,0,1], ..., [0,2,2]] will be structured as `0:0:0-2,1:0-2,2:0-2`, not `0:0-2:0-2`.
 */

import {Product} from './storefront-api-types.js';

const OPTION_VALUE_SEPARATOR = ',';

const V1_CONTROL_CHARS = {
  OPTION: ':',
  END_OF_PREFIX: ',',
  SEQUENCE_GAP: ' ',
  RANGE: '-',
};

export type IsOptionValueCombinationInEncodedVariant = (
  targetOptionValueCombination: number[],
  encodedVariantField: string,
) => boolean;

/**
 * Determine whether an option value combination is present in an encoded option value string. Function is memoized by encodedVariantField.
 *
 * @param targetOptionValueCombination - Indices of option values to look up in the encoded option value string. A partial set of indices may be passed to determine whether a node or any children is present. For example, if a product has 3 options, passing [0] will return true if any option value combination for the first option's option value is present in the encoded string.
 * @param encodedVariantField - Encoded option value string from the Storefront API, e.g. [product.encodedVariantExistence](/docs/api/storefront/2025-01/objects/Product#field-encodedvariantexistence) or [product.encodedVariantAvailability](/docs/api/storefront/2025-01/objects/Product#field-encodedvariantavailability)
 * @returns - True if a full or partial targetOptionValueIndices is present in the encoded option value string, false otherwise.
 */
export const isOptionValueCombinationInEncodedVariant: IsOptionValueCombinationInEncodedVariant =
  ((): IsOptionValueCombinationInEncodedVariant => {
    const decodedOptionValues = new Map<string, Set<string>>();

    return function (
      targetOptionValueCombination: number[],
      encodedVariantField: string,
    ): boolean {
      if (targetOptionValueCombination.length === 0) {
        return false;
      }

      if (!decodedOptionValues.has(encodedVariantField)) {
        const decodedOptionValuesSet = new Set<string>();

        for (const optionValue of decodeEncodedVariant(encodedVariantField)) {
          // add the complete option value to the decoded option values set
          decodedOptionValuesSet.add(optionValue.join(OPTION_VALUE_SEPARATOR));

          // add all composite parts of the option value to the decoded option values set. e.g. if the option value is [0,1,2], add "0", "0,1", "0,1,2"
          for (let i = 0; i < optionValue.length; i++) {
            decodedOptionValuesSet.add(
              optionValue.slice(0, i + 1).join(OPTION_VALUE_SEPARATOR),
            );
          }
        }

        decodedOptionValues.set(encodedVariantField, decodedOptionValuesSet);
      }

      return Boolean(
        decodedOptionValues
          .get(encodedVariantField)
          ?.has(targetOptionValueCombination.join(OPTION_VALUE_SEPARATOR)),
      );
    };
  })();

type EncodedVariantField =
  | Product['encodedVariantAvailability']
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
  | Product['encodedVariantExistence'];
type DecodedOptionValues = number[][];

/**
 * For an encoded option value string, decode into option value combinations. Entries represent a valid combination formatted as an array of option value positions.
 * @param encodedVariantField - Encoded option value string from the Storefront API, e.g. [product.encodedVariantExistence](/docs/api/storefront/2025-01/objects/Product#field-encodedvariantexistence) or [product.encodedVariantAvailability](/docs/api/storefront/2025-01/objects/Product#field-encodedvariantavailability)
 * @returns Decoded option value combinations
 */
export function decodeEncodedVariant(
  encodedVariantField: EncodedVariantField,
): DecodedOptionValues {
  if (!encodedVariantField) return [];

  if (encodedVariantField.startsWith('v1_')) {
    return v1Decoder(stripVersion(encodedVariantField));
  }

  throw new Error('Unsupported option value encoding');
}

const stripVersion: (encodedVariantField: string) => string = (
  encodedVariantField: string,
) => encodedVariantField.replace(/^v1_/, '');

/**
 * We encode an array of arrays representing variants, expressed in terms of options and option values, as a trie.
 *
 * This encoding strategy allows extremely large numbers of variants to be expressed in an extremely compact data structure.
 *
 * Integers represent option and values, so [0,0,0] represents option_value at array index 0 for the options at array indexes 0, 1 and 2
 *
 * `:`, `,`, ` ` and `-` are control characters.
 * `:` indicates a new option
 * `,` indicates the end of a repeated prefix, mulitple consecutive commas indicate the end of multiple repeated prefixes.
 * ` ` indicates a gap in the sequence of option values
 * `-` indicates a continuous range of option values
 *
 * Encoding process:
 *
 * example input array: [[0,0,0], [0,1,0], [0,1,1], [1,0,0], [1,0,1], [1,1,1], [2,0,1], [2,1,0]]
 *
 * step 1: encode as string: "0:0:0,0:1:0,0:1:1,1:0:0,1:0:1,1:1:1,2:0:1,2:1:0,"
 * step 2: combine nodes that share a prefix: "0:0:0,0:1:0 1,1:0:0 1,1:1:1,2:0:1,2:1:0,"
 * step 3: encode data as a trie so no prefixes need to be repeated: "0:0:0,1:0 1,,1:0:0 1,1:1,,2:0:1,1:0,,"
 * step 4: since the options are sorted, use a dash to express ranges: "0:0:0,1:0-1,,1:0:0-1,1:1,,2:0:1,1:0,,"
 */
function v1Decoder(encodedVariantField: string): number[][] {
  const tokenizer = /[ :,-]/g;
  let index = 0;
  let token: RegExpExecArray | null;
  const options: number[][] = [];
  const currentOptionValue: number[] = [];
  let depth = 0;
  let rangeStart: number | null = null;

  // iterate over control characters
  while ((token = tokenizer.exec(encodedVariantField))) {
    const operation = token[0];
    const optionValueIndex =
      Number.parseInt(encodedVariantField.slice(index, token.index)) || 0;

    if (rangeStart !== null) {
      // If a range has been started, iterate over the range and add each option value to the list of options
      // - `rangeStart` is set if the last control char was a dash, e.g. `0` for 0-2. It represents the numeric option value position for the start of the range.
      // - `optionValueIndex` is the numeric option value position for the end of the range
      for (; rangeStart < optionValueIndex; rangeStart++) {
        currentOptionValue[depth] = rangeStart;
        options.push([...currentOptionValue]);
      }
      // indicates the range has been processed
      rangeStart = null;
    }

    currentOptionValue[depth] = optionValueIndex;

    if (operation === V1_CONTROL_CHARS.RANGE) {
      // dash operation indicates we are in a range. e.g. 0-2 means option values 0, 1, 2
      rangeStart = optionValueIndex;
    } else if (operation === V1_CONTROL_CHARS.OPTION) {
      // colon operation indicates that we are moving down to the next layer of option values. e.g. 0:0:0-2 means we traverse down from option1 to option3 and represents [[0,0,0], [0,0,1], [0,0,2]]
      depth++;
    } else {
      if (
        operation === V1_CONTROL_CHARS.SEQUENCE_GAP ||
        (operation === V1_CONTROL_CHARS.END_OF_PREFIX &&
          encodedVariantField[token.index - 1] !==
            V1_CONTROL_CHARS.END_OF_PREFIX)
      ) {
        // add the current option value to the list of options if we hit a gap in our sequence or we are at the end of our depth and need to move back up
        options.push([...currentOptionValue]);
      }
      if (operation === V1_CONTROL_CHARS.END_OF_PREFIX) {
        // go up an option level, trash the last item in currentOptionValue
        currentOptionValue.pop();
        depth--;
      }
    }
    index = tokenizer.lastIndex;
  }

  // The while loop only iterates control characters, meaning if an encoded string ends with an index it will not be processed.
  const encodingEndsWithIndex = encodedVariantField.match(/\d+$/g);
  if (encodingEndsWithIndex) {
    const finalValueIndex = parseInt(encodingEndsWithIndex[0]);
    if (rangeStart != null) {
      // process final range
      for (; rangeStart <= finalValueIndex; rangeStart++) {
        currentOptionValue[depth] = rangeStart;
        options.push([...currentOptionValue]);
      }
    } else {
      // process final index
      options.push([finalValueIndex]);
    }
  }

  return options;
}
