import path from 'node:path';
import {EventEmitter} from 'node:events';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {mapSourcePosition} from 'source-map-support';
import type {WaitUntil} from '../types.js';

const IGNORED_ROUTES = new Set([
  '/graphiql',
  '/subrequest-profiler',
  '/debug-network-server',
  '/favicon.ico',
]);

type RequestEvent = {
  event: string;
  data: string;
};

const EVENT_MAP: Record<string, string> = {
  request: 'Request',
  subrequest: 'Sub request',
};

export type RequestEventPayload = {
  __fromVite?: boolean;
  url: string;
  eventType: 'request' | 'subrequest';
  requestId?: string | null;
  purpose?: string | null;
  startTime: number;
  endTime?: number;
  cacheStatus?: 'MISS' | 'HIT' | 'STALE' | 'PUT';
  waitUntil?: WaitUntil;
  graphql?: string | null;
  stackInfo?: {
    file?: string;
    func?: string;
    line?: number;
    column?: number;
  };
  responsePayload?: any;
  responseInit?: Omit<ResponseInit, 'headers'> & {headers?: [string, string][]};
  cache?: {
    status?: string;
    strategy?: string;
    key?: string | readonly unknown[];
    tags?: string[];
  };
  displayName?: string;
};

function getEventInfo(data: RequestEventPayload) {
  return {
    ...data,
    requestId: data.requestId ?? '',
    eventType: data.eventType || 'unknown',
    endTime: data.endTime || Date.now(),
    purpose: data.purpose === 'prefetch' ? '(prefetch)' : '',
    cacheStatus: data.cacheStatus ?? '',
    graphql: data.graphql
      ? (JSON.parse(data.graphql) as {
          query: string;
          variables: object;
          schema?: string;
        })
      : null,
  };
}

const eventEmitter = new EventEmitter();
const eventHistory: RequestEvent[] = [];

export function emitRequestEvent(payload: RequestEventPayload, root: string) {
  if (!payload || !payload.url || !payload.requestId) {
    // Ignore incorrect events, although this should not happen.
    return;
  }

  if (payload.eventType === 'request' && !payload.__fromVite) {
    // Filter out events that come from @shopify/remix-oxygen,
    // which is a deprecated way to send events.
    return;
  }

  delete payload.__fromVite;

  const {pathname} = new URL(payload.url, 'http://localhost');
  if (IGNORED_ROUTES.has(pathname)) return;

  const {
    url: descriptionUrl,
    displayName: displayNameData,
    eventType,
    purpose,
    graphql,
    stackInfo,
    ...data
  } = getEventInfo(payload);

  let graphiqlLink = '';
  let displayName = displayNameData;

  if (eventType === 'subrequest') {
    displayName =
      displayName ||
      graphql?.query
        .match(/(query|mutation)\s+(\w+)/)?.[0]
        ?.replace(/\s+/, ' ');

    if (graphql) {
      graphiqlLink = getGraphiQLUrl(graphql);
    }
  }

  let stackLine: string | null = null;
  let stackLink: string | null = null;

  if (stackInfo?.file) {
    stackInfo.file = path.join(root, stackInfo.file);

    const {source, line, column} = mapSourcePosition({
      source: stackInfo.file,
      line: stackInfo.line ?? 0,
      column: stackInfo.column ?? 0,
    });

    stackLine = `${source}:${line}:${column + 1}`;
    stackLink = `vscode://${path.join('file', stackLine)}`;

    stackLine = stackLine.split(path.sep + 'app' + path.sep)[1] ?? stackLine;
    if (stackInfo.func) {
      stackLine = `${stackInfo.func.replace(/\d+$/, '')} (${stackLine})`;
    }
  }

  const event = {
    event: EVENT_MAP[eventType] || eventType,
    data: JSON.stringify({
      ...data,
      displayName,
      url: `${purpose} ${descriptionUrl}`.trim(),
      graphiqlLink,
      stackLine,
      stackLink,
    }),
  };

  eventHistory.push(event);
  if (eventHistory.length > 100) eventHistory.shift();

  eventEmitter.emit('request', event);
}

export function clearHistory(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) {
  eventHistory.length = 0;
  res.writeHead(200);
  res.end();
}

export function streamRequestEvents(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });

  const enqueueEvent = ({event = 'message', data}: RequestEvent) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
  };

  eventHistory.forEach(enqueueEvent);
  eventEmitter.addListener('request', enqueueEvent);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    eventEmitter.removeListener('request', enqueueEvent);
  }

  req.on('close', close);
  res.on('close', close);
}

type GraphiQLOptions = {
  query: string;
  variables: string | Record<string, any>;
  schema?: string;
};

function getGraphiQLUrl({query, variables, schema}: GraphiQLOptions) {
  let url = `/graphiql?query=${encodeURIComponent(query)}`;

  if (variables) {
    if (typeof variables !== 'string') variables = JSON.stringify(variables);
    url += `&variables=${encodeURIComponent(variables)}`;
  }

  if (schema) {
    url += `&schema=${schema}`;
  }

  return url;
}
