import type {LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {useLoaderData, useMatches} from '@remix-run/react';
import {marked} from 'marked';
import {useState} from 'react';

import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
// @ts-ignore
import {oneDark} from 'react-syntax-highlighter/dist/cjs/styles/prism/index.js';

export async function loader({params}: LoaderFunctionArgs) {
  return {doc: params.doc};
}

function getDefinition(definitions: any, type: string) {
  return definitions[type] ? definitions[type] : {};
}

export default function Index() {
  const {doc} = useLoaderData<typeof loader>();
  if (!doc || doc === 'worker.js') return null;

  const matches = useMatches();
  const data = (matches as any)[0].data.data;

  const docMetaData = data.find((d: any) => d.name === doc);
  const definition = docMetaData?.definitions?.[0];
  const typeDef = definition
    ? getDefinition(definition.typeDefinitions, definition.type)
    : null;

  const props = typeDef
    ? typeDef.members ?? typeDef.params ?? typeDef.value
    : null;

  return (
    <div>
      <h1 className="block text-2xl font-bold mb-8">{docMetaData.name}</h1>
      <p
        dangerouslySetInnerHTML={{
          __html: marked.parse(docMetaData.description),
        }}
      ></p>

      <Examples examples={docMetaData.defaultExample.codeblock.tabs} />

      {props ? (
        <>
          <h2 className="block text-xl font-bold my-8">{definition.title}</h2>
          {props instanceof Array ? (
            <div className="flex flex-col gap-4">
              {props.map((prop: any) => (
                <Prop key={prop.name} prop={prop} />
              ))}
            </div>
          ) : (
            <div className="font-mono bg-slate-100 rounded-sm px-2">
              {props}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function Prop({
  prop,
}: {
  prop: {
    name: string;
    value: string;
    description: string;
    isOptional?: boolean;
  };
}) {
  return (
    <div>
      <div className="flex gap-4 mb-2">
        <div className="font-bold">{prop.name}</div>
        <div className="font-mono bg-slate-100 rounded-sm px-2">
          {prop.value}
        </div>
        <div className="text-red-900 bg-red-300 rounded-sm px-2">required</div>
      </div>
      <p
        dangerouslySetInnerHTML={{
          __html: marked.parse(prop.description),
        }}
      ></p>
    </div>
  );
}

function Examples({
  examples,
}: {
  examples: {title: string; code: string; language: string}[];
}) {
  const [selectedExample, setSelectedExample] = useState(0);

  if (!examples) return;

  return (
    <div className="mt-8">
      <h3 className="font-mono font-bold text-lg my-4">Example code</h3>
      <div>
        <div>
          {examples.map((example, index) => (
            <button
              onClick={() => setSelectedExample(index)}
              className={`${
                index === selectedExample ? 'font-bold underline' : ''
              } mr-4`}
              key={example.title}
            >
              {example.title}
            </button>
          ))}
        </div>
        <SyntaxHighlighter
          language={examples[selectedExample].language}
          showLineNumbers
          showInlineLineNumbers
          style={oneDark}
          className="w-full"
        >
          {examples[selectedExample].code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
