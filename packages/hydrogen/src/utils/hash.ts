type QueryKey = string | readonly unknown[];

const encoder = new TextEncoder();

export async function hashKey(queryKey: QueryKey): Promise<string> {
  const rawKeys = Array.isArray(queryKey) ? queryKey : [queryKey];
  let hash = '';

  // Keys could be in the following shape:
  //
  // From `storefront.query`:
  // ['api-endpoint', 'method', 'headers', 'query']
  //
  // From `createWithCache`:
  // ['string', {}, 1, []]
  for (const key of rawKeys) {
    if (key != null) {
      if (typeof key === 'object') {
        hash += JSON.stringify(key);
      } else {
        hash += key.toString();
      }
    }
  }

  const hashBuffer = await crypto.subtle.digest(
    'sha-512',
    encoder.encode(hash),
  );

  // Hex string
  // return Array.from(new Uint8Array(hashBuffer))
  //   .map((byte) => byte.toString(16).padStart(2, '0'))
  //   .join('');

  // B64 string
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}
