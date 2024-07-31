import {forwardRef, ScriptHTMLAttributes, HTMLAttributes} from 'react';
import {useNonce} from './csp';
import {useLoadScript} from '@shopify/hydrogen-react';

type ScriptProps = HydrogenScriptProps & ScriptAttributes;

interface HydrogenScriptProps {
  /** Wait to load the script until after the page hydrates. This prevents hydration errors for scripts that modify the DOM. Note: `nonce` is not supported when using `waitForHydration`. Instead you need to add the domain of the script directly to your [Content Securitiy Policy directives](https://shopify.dev/docs/storefronts/headless/hydrogen/content-security-policy#step-3-customize-the-content-security-policy).*/
  waitForHydration?: boolean;
}

interface ScriptAttributes extends ScriptHTMLAttributes<HTMLScriptElement> {}

export const Script = forwardRef<HTMLScriptElement, ScriptProps>(
  (props, ref) => {
    const {waitForHydration, src, ...rest} = props;

    const nonce = useNonce();

    return !waitForHydration ? (
      <script
        suppressHydrationWarning
        {...rest}
        src={src}
        nonce={nonce}
        ref={ref}
      />
    ) : (
      <LazyScript src={src} options={rest} />
    );
  },
);

function LazyScript({
  src,
  options,
}: {
  src?: string;
  options: JSX.IntrinsicElements['script'];
}) {
  if (!src) return null;

  useLoadScript(src, {
    attributes: options as Record<string, string>,
  });

  return null;
}
