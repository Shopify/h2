/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as React from 'react';
import type {PartialDeep} from 'type-fest';
import type {Image as ImageType} from './storefront-api-types.js';

/*
 * An optional prop you can use to change the
 * default srcSet generation behaviour
 */
type SrcSetOptions = {
  /** The number of sizes to generate */
  intervals: number;
  /** The smallest image size */
  startingWidth: number;
  /** The increment by which to increase for each size, in pixels */
  incrementSize: number;
  /** The size used for placeholder fallback images */
  placeholderWidth: number;
};

type NormalizedProps = {
  alt: string;
  aspectRatio: string | undefined;
  height: string;
  src: string | undefined;
  width: string;
};

export type LoaderParams = {
  /** The base URL of the image */
  src?: ImageType['url'];
  /** The URL param that controls width */
  width?: number;
  /** The URL param that controls height */
  height?: number;
  /** The URL param that controls the cropping region */
  crop?: Crop;
};

export type Loader = (params: LoaderParams) => string;

/*
 * @TODO: Expand to include focal point support; and/or switch this to be an SF API type
 */
type Crop = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type HydrogenImageProps = React.ComponentPropsWithRef<'img'> &
  HydrogenImageBaseProps;

type HydrogenImageBaseProps = {
  /** The aspect ratio of the image, in the format of `width/height`.
   *
   * @example
   * ```
   * <Image data={productImage} aspectRatio="4/5" />
   * ```
   */
  aspectRatio?: string;
  /** The crop position of the image.
   *
   * @remarks
   * In the event that AspectRatio is set, without specifying a crop,
   * the Shopify CDN won't return the expected image.
   *
   * @defaultValue `center`
   */
  crop?: Crop;
  /** Data mapping to the [Storefront API `Image`](https://shopify.dev/docs/api/storefront/2025-01/objects/Image) object. Must be an Image object.
   *
   * @example
   * ```
   * import {IMAGE_FRAGMENT, Image} from '@shopify/hydrogen';
   *
   * export const IMAGE_QUERY = `#graphql
   * ${IMAGE_FRAGMENT}
   * query {
   *   product {
   *     featuredImage {
   *       ...Image
   *     }
   *   }
   * }`
   *
   * <Image
   *   data={productImage}
   *   sizes="(min-width: 45em) 50vw, 100vw"
   *   aspectRatio="4/5"
   * />
   * ```
   *
   * Image: {@link https://shopify.dev/api/storefront/reference/common-objects/image}
   */
  data?: PartialDeep<ImageType, {recurseIntoArrays: true}>;
  /** A function that returns a URL string for an image.
   *
   * @remarks
   * By default, this uses Shopify’s CDN {@link https://cdn.shopify.com/} but you can provide
   * your own function to use a another provider, as long as they support URL based image transformations.
   */
  loader?: Loader;
  /** An optional prop you can use to change the default srcSet generation behaviour */
  srcSetOptions?: SrcSetOptions;
};

/**
 * A Storefront API GraphQL fragment that can be used to query for an image.
 */
export const IMAGE_FRAGMENT = `#graphql
  fragment Image on Image {
    altText
    url
    width
    height
  }
`;

/**
 * Hydrogen’s Image component is a wrapper around the HTML image element.
 * It supports the same props as the HTML `img` element, but automatically
 * generates the srcSet and sizes attributes for you. For most use cases,
 * you’ll want to set the `aspectRatio` prop to ensure the image is sized
 * correctly.
 *
 * @remarks
 * - `decoding` is set to `async` by default.
 * - `loading` is set to `lazy` by default.
 * - `alt` will automatically be set to the `altText` from the Storefront API if passed in the `data` prop
 * - `src` will automatically be set to the `url` from the Storefront API if passed in the `data` prop
 *
 * @example
 * A responsive image with a 4:5 aspect ratio:
 * ```
 * <Image
 *   data={product.featuredImage}
 *   aspectRatio="4/5"
 *   sizes="(min-width: 45em) 40vw, 100vw"
 * />
 * ```
 * @example
 * A fixed size image:
 * ```
 * <Image
 *   data={product.featuredImage}
 *   width={100}
 *   height={100}
 * />
 * ```
 *
 * {@link https://shopify.dev/docs/api/hydrogen-react/components/image}
 */
export const Image = React.forwardRef<HTMLImageElement, HydrogenImageProps>(
  (
    {
      alt,
      aspectRatio,
      crop = 'center',
      data,
      decoding = 'async',
      height = 'auto',
      loader = shopifyLoader,
      loading = 'lazy',
      sizes,
      src,
      srcSetOptions = {
        intervals: 15,
        startingWidth: 200,
        incrementSize: 200,
        placeholderWidth: 100,
      },
      width = '100%',
      ...passthroughProps
    },
    ref,
  ) => {
    /*
     * Gets normalized values for width, height from data  prop
     */
    const normalizedData = React.useMemo(() => {
      /* Only use data width if height is also set */
      const dataWidth: number | undefined =
        data?.width && data?.height ? data?.width : undefined;

      const dataHeight: number | undefined =
        data?.width && data?.height ? data?.height : undefined;

      return {
        width: dataWidth,
        height: dataHeight,
        unitsMatch: Boolean(unitsMatch(dataWidth, dataHeight)),
      };
    }, [data]);

    /*
     * Gets normalized values for width, height, src, alt, and aspectRatio props
     * supporting the presence of `data` in addition to flat props.
     */
    const normalizedProps = React.useMemo(() => {
      const nWidthProp: string | number = width || '100%';
      const widthParts = getUnitValueParts(nWidthProp.toString());
      const nWidth = `${widthParts.number}${widthParts.unit}`;

      const autoHeight = height === undefined || height === null;
      const heightParts = autoHeight
        ? null
        : getUnitValueParts(height.toString());

      const fixedHeight = heightParts
        ? `${heightParts.number}${heightParts.unit}`
        : '';

      const nHeight = autoHeight ? 'auto' : fixedHeight;

      const nSrc: string | undefined = src || data?.url;

      if (__HYDROGEN_DEV__ && !nSrc) {
        console.warn(
          `No src or data.url provided to Image component.`,
          passthroughProps?.key || '',
        );
      }

      const nAlt: string = data?.altText && !alt ? data?.altText : alt || '';

      const nAspectRatio: string | undefined = aspectRatio
        ? aspectRatio
        : normalizedData.unitsMatch
        ? [
            getNormalizedFixedUnit(normalizedData.width),
            getNormalizedFixedUnit(normalizedData.height),
          ].join('/')
        : undefined;

      return {
        width: nWidth,
        height: nHeight,
        src: nSrc,
        alt: nAlt,
        aspectRatio: nAspectRatio,
      };
    }, [
      width,
      height,
      src,
      data,
      alt,
      aspectRatio,
      normalizedData,
      passthroughProps?.key,
    ]);

    const {intervals, startingWidth, incrementSize, placeholderWidth} =
      srcSetOptions;

    /*
     * This function creates an array of widths to be used in srcSet
     */
    const imageWidths = React.useMemo(() => {
      return generateImageWidths(
        width,
        intervals,
        startingWidth,
        incrementSize,
      );
    }, [width, intervals, startingWidth, incrementSize]);

    const fixedWidth = isFixedWidth(normalizedProps.width);

    if (__HYDROGEN_DEV__ && !sizes && !fixedWidth) {
      console.warn(
        [
          'No sizes prop provided to Image component,',
          'you may be loading unnecessarily large images.',
          `Image used is ${
            src || data?.url || passthroughProps?.key || 'unknown'
          }`,
        ].join(' '),
      );
    }

    /*
     * We check to see whether the image is fixed width or not,
     * if fixed, we still provide a srcSet, but only to account for
     * different pixel densities.
     */
    if (fixedWidth) {
      return (
        <FixedWidthImage
          aspectRatio={aspectRatio}
          crop={crop}
          decoding={decoding}
          height={height}
          imageWidths={imageWidths}
          loader={loader}
          loading={loading}
          normalizedProps={normalizedProps}
          passthroughProps={passthroughProps}
          ref={ref}
          width={width}
          data={data}
        />
      );
    } else {
      return (
        <FluidImage
          aspectRatio={aspectRatio}
          crop={crop}
          decoding={decoding}
          imageWidths={imageWidths}
          loader={loader}
          loading={loading}
          normalizedProps={normalizedProps}
          passthroughProps={passthroughProps}
          placeholderWidth={placeholderWidth}
          ref={ref}
          sizes={sizes}
          data={data}
        />
      );
    }
  },
);

type FixedImageExludedProps =
  | 'data'
  | 'loader'
  | 'loaderOptions'
  | 'sizes'
  | 'srcSetOptions'
  | 'widths';

type FixedWidthImageProps = Omit<HydrogenImageProps, FixedImageExludedProps> &
  Pick<HydrogenImageBaseProps, 'data'> & {
    loader: Loader;
    passthroughProps: React.ImgHTMLAttributes<HTMLImageElement>;
    normalizedProps: NormalizedProps;
    imageWidths: number[];
    ref: React.Ref<HTMLImageElement>;
  };

const FixedWidthImage = React.forwardRef<
  HTMLImageElement,
  FixedWidthImageProps
>(
  (
    {
      aspectRatio,
      crop,
      decoding,
      height,
      imageWidths,
      loader = shopifyLoader,
      loading,
      normalizedProps,
      passthroughProps,
      width,
      data,
    },
    ref,
  ) => {
    const fixed = React.useMemo(() => {
      const intWidth: number | undefined = getNormalizedFixedUnit(width);
      const intHeight: number | undefined = getNormalizedFixedUnit(height);

      /*
       * The aspect ratio for fixed width images is taken from the explicitly
       * set prop, but if that's not present, and both width and height are
       * set, we calculate the aspect ratio from the width and height—as
       * long as they share the same unit type (e.g. both are 'px').
       */
      const fixedAspectRatio = aspectRatio
        ? aspectRatio
        : unitsMatch(normalizedProps.width, normalizedProps.height)
        ? [intWidth, intHeight].join('/')
        : normalizedProps.aspectRatio
        ? normalizedProps.aspectRatio
        : undefined;

      /*
       * The Sizes Array generates an array of all the parts
       * that make up the srcSet, including the width, height, and crop
       */
      const sizesArray =
        imageWidths === undefined
          ? undefined
          : generateSizes(imageWidths, fixedAspectRatio, crop, {
              width: data?.width ?? undefined,
              height: data?.height ?? undefined,
            });

      const fixedHeight = intHeight
        ? intHeight
        : fixedAspectRatio && intWidth
        ? intWidth * (parseAspectRatio(fixedAspectRatio) ?? 1)
        : undefined;

      const srcSet = generateSrcSet(normalizedProps.src, sizesArray, loader);
      const src = loader({
        src: normalizedProps.src,
        width: intWidth,
        height: fixedHeight,
        crop: normalizedProps.height === 'auto' ? undefined : crop,
      });

      return {
        width: intWidth,
        aspectRatio: fixedAspectRatio,
        height: fixedHeight,
        srcSet,
        src,
      };
    }, [
      aspectRatio,
      crop,
      data,
      height,
      imageWidths,
      loader,
      normalizedProps,
      width,
    ]);

    return (
      <img
        ref={ref}
        alt={normalizedProps.alt}
        decoding={decoding}
        height={fixed.height}
        loading={loading}
        src={fixed.src}
        srcSet={fixed.srcSet}
        width={fixed.width}
        style={{
          aspectRatio: fixed.aspectRatio,
          ...passthroughProps.style,
        }}
        {...passthroughProps}
      />
    );
  },
);

type FluidImageExcludedProps =
  | 'data'
  | 'width'
  | 'height'
  | 'loader'
  | 'loaderOptions'
  | 'srcSetOptions';

type FluidImageProps = Omit<HydrogenImageProps, FluidImageExcludedProps> &
  Pick<HydrogenImageBaseProps, 'data'> & {
    imageWidths: number[];
    loader: Loader;
    normalizedProps: NormalizedProps;
    passthroughProps: React.ImgHTMLAttributes<HTMLImageElement>;
    placeholderWidth: number;
    ref: React.Ref<HTMLImageElement>;
  };

const FluidImage = React.forwardRef<HTMLImageElement, FluidImageProps>(
  (
    {
      crop,
      decoding,
      imageWidths,
      loader = shopifyLoader,
      loading,
      normalizedProps,
      passthroughProps,
      placeholderWidth,
      sizes,
      data,
    },
    ref,
  ) => {
    const fluid = React.useMemo(() => {
      const sizesArray =
        imageWidths === undefined
          ? undefined
          : generateSizes(imageWidths, normalizedProps.aspectRatio, crop, {
              width: data?.width ?? undefined,
              height: data?.height ?? undefined,
            });

      const placeholderHeight =
        normalizedProps.aspectRatio && placeholderWidth
          ? placeholderWidth *
            (parseAspectRatio(normalizedProps.aspectRatio) ?? 1)
          : undefined;

      const srcSet = generateSrcSet(normalizedProps.src, sizesArray, loader);

      const src = loader({
        src: normalizedProps.src,
        width: placeholderWidth,
        height: placeholderHeight,
        crop,
      });

      return {
        placeholderHeight,
        srcSet,
        src,
      };
    }, [crop, data, imageWidths, loader, normalizedProps, placeholderWidth]);

    return (
      <img
        ref={ref}
        alt={normalizedProps.alt}
        decoding={decoding}
        height={fluid.placeholderHeight}
        loading={loading}
        sizes={sizes}
        src={fluid.src}
        srcSet={fluid.srcSet}
        width={placeholderWidth}
        {...passthroughProps}
        style={{
          width: normalizedProps.width,
          aspectRatio: normalizedProps.aspectRatio,
          ...passthroughProps.style,
        }}
      />
    );
  },
);

/**
 * The shopifyLoader function is a simple utility function that takes a src, width,
 * height, and crop and returns a string that can be used as the src for an image.
 * It can be used with the Hydrogen Image component or with the next/image component.
 * (or any others that accept equivalent configuration)
 * @param src - The source URL of the image, e.g. `https://cdn.shopify.com/static/sample-images/garnished.jpeg`
 * @param width - The width of the image, e.g. `100`
 * @param height - The height of the image, e.g. `100`
 * @param crop - The crop of the image, e.g. `center`
 * @returns A Shopify image URL with the correct query parameters, e.g. `https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=100&height=100&crop=center`
 *
 * @example
 * ```
 * shopifyLoader({
 *   src: 'https://cdn.shopify.com/static/sample-images/garnished.jpeg',
 *   width: 100,
 *   height: 100,
 *   crop: 'center',
 * })
 * ```
 */
const PLACEHOLDER_DOMAIN = 'https://placeholder.shopify.com';
export function shopifyLoader({src, width, height, crop}: LoaderParams) {
  if (!src) {
    return '';
  }

  const url = new URL(src, PLACEHOLDER_DOMAIN);

  if (width) {
    url.searchParams.append('width', Math.round(width).toString());
  }

  if (height) {
    url.searchParams.append('height', Math.round(height).toString());
  }

  if (crop) {
    url.searchParams.append('crop', crop);
  }
  return url.href.replace(PLACEHOLDER_DOMAIN, '');
}

/**
 * Checks whether the width and height share the same unit type
 * @param width - The width of the image, e.g. 100% | 10px
 * @param height - The height of the image, e.g. auto | 100px
 * @returns Whether the width and height share the same unit type (boolean)
 */
function unitsMatch(
  width: string | number = '100%',
  height: string | number = 'auto',
): boolean {
  return (
    getUnitValueParts(width.toString()).unit ===
    getUnitValueParts(height.toString()).unit
  );
}

/**
 * Given a CSS size, returns the unit and number parts of the value
 * @param value - The CSS size, e.g. 100px
 * @returns The unit and number parts of the value, e.g. \{unit: 'px', number: 100\}
 */
function getUnitValueParts(value: string): {unit: string; number: number} {
  const unit = value.replace(/[0-9.]/g, '');
  const number = parseFloat(value.replace(unit, ''));

  return {
    unit: unit === '' ? (number === undefined ? 'auto' : 'px') : unit,
    number,
  };
}

/**
 * Given a value, returns the width of the image as an integer in pixels
 * @param value - The width of the image, e.g. 16px | 1rem | 1em | 16
 * @returns The width of the image in pixels, e.g. 16, or undefined if the value is not a fixed unit
 */
function getNormalizedFixedUnit(value?: string | number): number | undefined {
  if (value === undefined) {
    return;
  }

  const {unit, number} = getUnitValueParts(value.toString());

  switch (unit) {
    case 'em':
      return number * 16;
    case 'rem':
      return number * 16;
    case 'px':
      return number;
    case '':
      return number;
    default:
      return;
  }
}

/**
 * This function checks whether a width is fixed or not.
 * @param width - The width of the image, e.g. 100 | '100px' | '100em' | '100rem'
 * @returns Whether the width is fixed or not
 */
function isFixedWidth(width: string | number): boolean {
  const fixedEndings = /\d(px|em|rem)$/;
  return typeof width === 'number' || fixedEndings.test(width);
}

/**
 * This function generates a srcSet for Shopify images.
 * @param src - The source URL of the image, e.g. https://cdn.shopify.com/static/sample-images/garnished.jpeg
 * @param sizesArray - An array of objects containing the `width`, `height`, and `crop` of the image, e.g. [\{width: 200, height: 200, crop: 'center'\}, \{width: 400, height: 400, crop: 'center'\}]
 * @param loader - A function that takes a Shopify image URL and returns a Shopify image URL with the correct query parameters
 * @returns A srcSet for Shopify images, e.g. 'https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=200&height=200&crop=center 200w, https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=400&height=400&crop=center 400w'
 */
export function generateSrcSet(
  src?: string,
  sizesArray?: Array<{width?: number; height?: number; crop?: Crop}>,
  loader: Loader = shopifyLoader,
): string {
  if (!src) {
    return '';
  }

  if (sizesArray?.length === 0 || !sizesArray) {
    return src;
  }

  return sizesArray
    .map(
      (size, i) =>
        `${loader({
          src,
          width: size.width,
          height: size.height,
          crop: size.crop,
        })} ${sizesArray.length === 3 ? `${i + 1}x` : `${size.width ?? 0}w`}`,
    )
    .join(`, `);
}

/**
 * This function generates an array of sizes for Shopify images, for both fixed and responsive images.
 * @param width - The CSS width of the image
 * @param intervals - The number of intervals to generate
 * @param startingWidth - The starting width of the image
 * @param incrementSize - The size of each interval
 * @returns An array of widths
 */
export function generateImageWidths(
  width: string | number = '100%',
  intervals: number,
  startingWidth: number,
  incrementSize: number,
): number[] {
  const responsive = Array.from(
    {length: intervals},
    (_, i) => i * incrementSize + startingWidth,
  );

  const fixed = Array.from(
    {length: 3},
    (_, i) => (i + 1) * (getNormalizedFixedUnit(width) ?? 0),
  );

  return isFixedWidth(width) ? fixed : responsive;
}

/**
 * Simple utility function to convert an aspect ratio CSS string to a decimal, currently only supports values like `1/1`, not `0.5`, or `auto`
 * @param aspectRatio - The aspect ratio of the image, e.g. `1/1`
 * @returns The aspect ratio as a number, e.g. `0.5`
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio}
 */
export function parseAspectRatio(aspectRatio?: string): number | undefined {
  if (!aspectRatio) return;
  const [width, height] = aspectRatio.split('/');
  return 1 / (Number(width) / Number(height));
}

// Generate data needed for Imagery loader
export function generateSizes(
  imageWidths?: number[],
  aspectRatio?: string,
  crop: Crop = 'center',
  sourceDimensions?: {width?: number; height?: number},
):
  | {
      width: number;
      height: number | undefined;
      crop: Crop;
    }[]
  | undefined {
  if (!imageWidths) return;
  return imageWidths
    .map((width: number) => {
      return {
        width,
        height: aspectRatio
          ? width * (parseAspectRatio(aspectRatio) ?? 1)
          : undefined,
        crop,
      };
    })
    .filter(({width, height}) => {
      if (sourceDimensions?.width && width > sourceDimensions.width) {
        return false;
      }

      if (
        sourceDimensions?.height &&
        height &&
        height > sourceDimensions.height
      ) {
        return false;
      }

      return true;
    });
  /*
    Given:
      ([100, 200], 1/1, 'center')
    Returns:
      [{width: 100, height: 100, crop: 'center'},
      {width: 200, height: 200, crop: 'center'}]
  */
}
