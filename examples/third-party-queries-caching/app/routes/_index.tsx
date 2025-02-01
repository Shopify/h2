import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData} from '@remix-run/react';
import {CacheShort} from '@shopify/hydrogen';

export async function loader({context}: LoaderFunctionArgs) {
  // 1. Fetch characters from the Rick & Morty GraphQL API
  const {characters} = await context.rickAndMorty.query(CHARACTERS_QUERY, {
    cache: CacheShort(),
  });
  return {characters};
}

type Character = {
  name: string;
  id: string;
};

export default function Homepage() {
  const {characters} = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Rick & Morty Characters</h1>
      {/* 2. Render data from the Rick & Morty GraphQL API: */}
      <ul>
        {(characters.results || []).map((character: Character) => (
          <li key={character.name}>{character.name}</li>
        ))}
      </ul>
    </div>
  );
}

// 3. The Rick & Morty characters GraphQL query
// NOTE: https://rickandmortyapi.com/documentation/#graphql
const CHARACTERS_QUERY = `#graphql:rickAndMorty
  query Characters {
    characters(page: 1) {
      results {
        name
        id
      }
    }
  }
`;
