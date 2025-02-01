import {useState, useRef, useEffect} from 'react';
import {type ServerEvents} from '../lib/useDebugNetworkServer.js';
import {Link} from '@remix-run/react';
import {IconClose} from './IconClose.jsx';

// Type is broken in use-resize-observer
import _useResizeObserver from 'use-resize-observer';
const useResizeObserver =
  _useResizeObserver as unknown as typeof import('use-resize-observer').default;

const TABS: Record<number, string> = {
  1: 'General',
  2: 'Headers',
  3: 'Cache',
  4: 'Data',
};

export function RequestDetails({
  serverEvents,
  activeEventId,
  setActiveEventId,
}: {
  serverEvents: ServerEvents;
  activeEventId: string | undefined;
  setActiveEventId: (eventId: string | undefined) => void;
}) {
  const [activeTab, setActiveTab] = useState(1);

  if (!activeEventId) {
    return null;
  }

  const requestInfo = serverEvents.allRequests[activeEventId];

  if (!requestInfo) {
    return null;
  }

  function activeTabClass(tab: number) {
    return activeTab === tab ? ' active' : '';
  }

  function TabButton(key: number) {
    return (
      <div
        tabIndex={0}
        className={`tab${activeTabClass(key)}`}
        onClick={() => setActiveTab(key)}
        onKeyUp={(event) => {
          if (event.code === 'Space') setActiveTab(key);
        }}
      >
        {TABS[key]}
      </div>
    );
  }

  return (
    <div id="request-detail">
      <div id="request-detail-header">
        <TabButtonsBar>
          {TabButton(1)}
          {!!requestInfo.responseInit?.headers && TabButton(2)}
          {!!requestInfo.cache && TabButton(3)}
          {!!requestInfo.responsePayload && TabButton(4)}
        </TabButtonsBar>
        <div id="close-request-detail">
          <button
            className="plain icon"
            onClick={() => {
              setActiveEventId(undefined);
            }}
          >
            <IconClose />
          </button>
        </div>
      </div>
      <div className="tabPanels pad">
        <div id="tab1-panel" className={`tabPanel${activeTabClass(1)}`}>
          <div className="grid-layout">
            <DetailsRow rowName="Name" value={requestInfo.displayName} />
            <DetailsRow rowName="Request URL" value={requestInfo.url} />
            {requestInfo.responseInit ? (
              <DetailsRow
                rowName="Status"
                value={`${requestInfo.responseInit?.status} ${requestInfo.responseInit?.statusText}`}
              />
            ) : null}
            <DetailsRow
              rowName="GraphiQL"
              value={requestInfo.graphiqlLink}
              type="url"
            />
            <DetailsRow
              rowName="Location"
              text={requestInfo.stackLine}
              value={requestInfo.stackLink}
              type="url"
            />
          </div>
        </div>
        {!!requestInfo.responseInit?.headers && (
          <div id="tab2-panel" className={`tabPanel${activeTabClass(2)}`}>
            <div className="grid-layout">
              {Object.entries(requestInfo.responseInit?.headers).map(
                ([key, value]) => (
                  <DetailsRow key={key} rowName={value[0]} value={value[1]} />
                ),
              )}
            </div>
          </div>
        )}
        {!!requestInfo.cache && (
          <div id="tab3-panel" className={`tabPanel${activeTabClass(3)}`}>
            <div className="grid-layout">
              <DetailsRow rowName="Status" value={requestInfo.cache?.status} />
              <DetailsRow
                rowName="Cache-Control"
                value={requestInfo.cache?.strategy}
              />
              <DetailsRow
                rowName="Cache Key"
                value={requestInfo.cache?.key?.toString()}
              />
            </div>
          </div>
        )}
        {!!requestInfo.responsePayload && (
          <div id="tab4-panel" className={`tabPanel${activeTabClass(4)}`}>
            <pre className="code-json">
              {JSON.stringify(requestInfo.responsePayload, undefined, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButtonsBar({children}: {children: React.ReactNode}) {
  const [fadeClass, setFadeClass] = useState('');
  const scrollBarRef = useRef<HTMLDivElement>(null);

  useResizeObserver({
    ref: scrollBarRef,
    onResize: () => {
      if (scrollBarRef.current) {
        setFade(scrollBarRef.current);
      }
    },
  });

  function setFade(target: HTMLDivElement) {
    if (target.scrollWidth === target.clientWidth) {
      setFadeClass('');
      return;
    }

    const scrollRange = target.scrollWidth - target.clientWidth;
    if (target.scrollLeft > 10 && target.scrollLeft < scrollRange - 10) {
      setFadeClass('fadeLeftRight');
    } else if (target.scrollLeft <= 10) {
      setFadeClass('fadeRight');
    } else if (target.scrollLeft > scrollRange - 10) {
      setFadeClass('fadeLeft');
    }
  }

  return (
    <div
      id="tab-buttons-wrapper"
      // eslint-disable-next-line react/no-unknown-property
      onResize={(event) => setFade(event.currentTarget)}
    >
      <div
        id="tabButtons"
        ref={scrollBarRef}
        className="flex-row gap-tiny"
        onScroll={(event) => setFade(event.currentTarget)}
      >
        {children}
      </div>
      <div className={`fadCover ${fadeClass}`} />
    </div>
  );
}

function DetailsRow({
  rowName,
  value,
  text,
  type = 'string',
}: {
  rowName: string;
  value: string | undefined;
  text?: string;
  type?: 'url' | 'string';
}) {
  if (!rowName || !value) {
    return null;
  }

  return (
    <>
      <div className="gridTitle">{rowName}</div>
      {type === 'url' && (
        <Link target="_blank" to={value}>
          {text ?? value}
        </Link>
      )}
      {type === 'string' && (
        <div className="word-break-all">{text ?? value}</div>
      )}
    </>
  );
}
