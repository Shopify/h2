import {json, type LoaderArgs, type MetaFunction} from '@hydrogen/remix';
import {useLoaderData} from '@remix-run/react';
import {flattenConnection, Image} from '@shopify/hydrogen-ui-alpha';
import type {Article} from '@shopify/hydrogen-ui-alpha/storefront-api-types';
import {Grid, PageHeader, Section, Link} from '~/components';
import {getBlog} from '~/data';
import {getImageLoadingPriority, PAGINATION_SIZE} from '~/lib/const';
import {getLocalizationFromUrl} from '~/lib/utils';

const BLOG_HANDLE = 'Journal';

export const loader = async ({request, params}: LoaderArgs) => {
  const locale = getLocalizationFromUrl(request.url);
  const journals = await getBlog({
    locale,
    blogHandle: BLOG_HANDLE,
    paginationSize: PAGINATION_SIZE,
  });

  const articles = flattenConnection(journals).map((article) => {
    const {publishedAt} = article;
    return {
      ...article,
      publishedAt: new Intl.DateTimeFormat(
        `${locale.language}-${locale.country}`,
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      ).format(new Date(publishedAt!)),
    };
  });

  return json(
    {articles},
    {
      headers: {
        // TODO cacheLong()
      },
    },
  );
};

export const meta: MetaFunction = () => {
  return {
    title: 'All Journals',
  };
};

export default function Journals() {
  const {articles} = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader heading={BLOG_HANDLE} />
      <Section>
        <Grid as="ol" layout="blog">
          {articles.map((article, i) => (
            <ArticleCard
              blogHandle={BLOG_HANDLE.toLowerCase()}
              article={article as Article}
              key={article.id}
              loading={getImageLoadingPriority(i, 2)}
            />
          ))}
        </Grid>
      </Section>
    </>
  );
}

function ArticleCard({
  blogHandle,
  article,
  loading,
}: {
  blogHandle: string;
  article: Article;
  loading?: HTMLImageElement['loading'];
}) {
  return (
    <li key={article.id}>
      <Link to={`/${blogHandle}/${article.handle}`}>
        {article.image && (
          <div className="card-image aspect-[3/2]">
            <Image
              alt={article.image.altText || article.title}
              className="object-cover w-full"
              data={article.image}
              height={400}
              loading={loading}
              sizes="(min-width: 768px) 50vw, 100vw"
              width={600}
              loaderOptions={{
                scale: 2,
                crop: 'center',
              }}
            />
          </div>
        )}
        <h2 className="mt-4 font-medium">{article.title}</h2>
        <span className="block mt-1">{article.publishedAt}</span>
      </Link>
    </li>
  );
}
