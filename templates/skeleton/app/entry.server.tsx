import type {EntryContext, AppLoadContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  const [reader, reader2] = body.tee();

  const stream = reader2.getReader();

  // read() returns a promise that resolves when a value has been received
  stream
    .read()
    .then(function pump({done, value}: {done: boolean; value: Uint8Array}) {
      if (done) {
        // Do something with last chunk of data then exit reader
        return;
      }
      // Otherwise do something here to process current chunk

      console.log(new TextDecoder().decode(value));

      // Read some more, and call this function again
      return reader.read().then(pump);
    });

  console.log('here a');
  if (isbot(request.headers.get('user-agent'))) {
    console.log('here b');
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(reader, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
