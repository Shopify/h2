import {describe, expect, it} from 'vitest';

import {render, screen, renderHook} from '@testing-library/react';
import {useShop} from './ShopifyProvider.js';
import {HydrogenProvider} from './HydrogenProvider.js';

describe('<HydrogenProvider/>', () => {
  it('renders its children', () => {
    render(
      <HydrogenProvider countryIsoCode={'US'} languageIsoCode={'EN'}>
        <div>child</div>;
      </HydrogenProvider>,
    );

    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('returns the hydrogen context values', () => {
    const {result} = renderHook(() => useShop(), {
      wrapper: ({children}) => (
        <HydrogenProvider countryIsoCode={'CA'} languageIsoCode={'FR'}>
          {children}
        </HydrogenProvider>
      ),
    });

    expect(result.current.countryIsoCode).toBe('CA');
    expect(result.current.languageIsoCode).toBe('FR');
  });
});
