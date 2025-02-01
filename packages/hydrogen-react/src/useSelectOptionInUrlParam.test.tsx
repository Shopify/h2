import {vi, afterEach, describe, expect, it} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useSelectedOptionInUrlParam} from './useSelectedOptionInUrlParam.js';

type MockOptions = {search?: string; pathname?: string};

const globalMocks = ({search = '', pathname = ''}: MockOptions) => {
  let currentSearch = search;
  let currentPathname = pathname;

  return {
    location: {
      get search() {
        return currentSearch;
      },
      set search(search: string) {
        currentSearch = search;
      },
      get pathname() {
        return currentPathname;
      },
      set pathname(pathname: string) {
        currentPathname = pathname;
      },
    },
    history: {
      replaceState: (_state: unknown, _unused: unknown, url: string) => {
        const newUrl = new URL(url, 'https://placeholder.shopify.com');
        currentSearch = newUrl.search;
        currentPathname = newUrl.pathname;
      },
    },
  };
};

const mockGlobals = (options?: MockOptions) => {
  const mocks = globalMocks(options || {});

  vi.stubGlobal('location', mocks.location);
  vi.stubGlobal('history', mocks.history);
};

describe(`useSelectedOptionInUrlParam`, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates url with selected options search params when url itself has no search params', () => {
    mockGlobals();
    renderHook(() =>
      useSelectedOptionInUrlParam([
        {
          name: 'Color',
          value: 'Red',
        },
        {
          name: 'Size',
          value: 'Medium',
        },
      ]),
    );
    expect(location.search).toBe('?Color=Red&Size=Medium');
  });

  it('updates url with selected options search params when url itself has other search params', () => {
    mockGlobals({search: '?test=test'});
    renderHook(() =>
      useSelectedOptionInUrlParam([
        {
          name: 'Color',
          value: 'Red',
        },
        {
          name: 'Size',
          value: 'Medium',
        },
      ]),
    );
    expect(location.search).toBe('?test=test&Color=Red&Size=Medium');
  });

  it('updates url with selected options search params when url itself has other duplicated search params', () => {
    mockGlobals({search: '?Color=blue'});
    renderHook(() =>
      useSelectedOptionInUrlParam([
        {
          name: 'Color',
          value: 'Red',
        },
        {
          name: 'Size',
          value: 'Medium',
        },
      ]),
    );
    expect(location.search).toBe('?Color=Red&Size=Medium');
  });
});
