import {Await, useLoaderData} from '@remix-run/react';
import {defer} from '@remix-run/server-runtime';
import {Suspense} from 'react';

export async function loader() {
  return defer({
    promise: new Promise((resolve) => setTimeout(() => resolve('stuff'), 5000)),
  });
}
export default function Test() {
  const {promise} = useLoaderData<typeof loader>();
  promise.then(() => console.log('hi'));

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Await resolve={promise}>{() => <div>Test</div>}</Await>
    </Suspense>
  );
}
