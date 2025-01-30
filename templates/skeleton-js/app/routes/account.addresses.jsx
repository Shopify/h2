import {json} from '@shopify/remix-oxygen';
import {
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from '@remix-run/react';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';

/**
 * @type {MetaFunction}
 */
export const meta = () => {
  return [{title: 'Addresses'}];
};

/**
 * @param {LoaderFunctionArgs}
 */
export async function loader({context}) {
  await context.customerAccount.handleAuthStatus();

  return json({});
}

/**
 * @param {ActionFunctionArgs}
 */
export async function action({request, context}) {
  const {customerAccount} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return json(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address = {};
    const keys = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {address, defaultAddress},
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            throw new Error(data?.customerAddressCreate?.userErrors[0].message);
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return json({
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          });
        } catch (error) {
          if (error instanceof Error) {
            return json(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return json(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(data?.customerAddressUpdate?.userErrors[0].message);
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return json({
            error: null,
            updatedAddress: address,
            defaultAddress,
          });
        } catch (error) {
          if (error instanceof Error) {
            return json(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return json(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {addressId: decodeURIComponent(addressId)},
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            throw new Error(data?.customerAddressDelete?.userErrors[0].message);
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return json({error: null, deletedAddress: addressId});
        } catch (error) {
          if (error instanceof Error) {
            return json(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return json(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return json(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return json(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return json(
      {error},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="account-addresses">
      <h2>Addresses</h2>
      <br />
      {!addresses.nodes.length ? (
        <p>You have no addresses saved.</p>
      ) : (
        <div>
          <div>
            <legend>Create address</legend>
            <NewAddressForm />
          </div>
          <br />
          <hr />
          <br />
          <ExistingAddresses
            addresses={addresses}
            defaultAddress={defaultAddress}
          />
        </div>
      )}
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  };

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div>
          <button
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            {stateForMethod('POST') !== 'idle' ? 'Creating' : 'Create'}
          </button>
        </div>
      )}
    </AddressForm>
  );
}

/**
 * @param {Pick<CustomerFragment, 'addresses' | 'defaultAddress'>}
 */
function ExistingAddresses({addresses, defaultAddress}) {
  return (
    <div>
      <legend>Existing addresses</legend>
      {addresses.nodes.map((address) => (
        <AddressForm
          key={address.id}
          addressId={address.id}
          address={address}
          defaultAddress={defaultAddress}
        >
          {({stateForMethod}) => (
            <div>
              <button
                disabled={stateForMethod('PUT') !== 'idle'}
                formMethod="PUT"
                type="submit"
              >
                {stateForMethod('PUT') !== 'idle' ? 'Saving' : 'Save'}
              </button>
              <button
                disabled={stateForMethod('DELETE') !== 'idle'}
                formMethod="DELETE"
                type="submit"
              >
                {stateForMethod('DELETE') !== 'idle' ? 'Deleting' : 'Delete'}
              </button>
            </div>
          )}
        </AddressForm>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   addressId: AddressFragment['id'];
 *   address: CustomerAddressInput;
 *   defaultAddress: CustomerFragment['defaultAddress'];
 *   children: (props: {
 *     stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
 *   }) => React.ReactNode;
 * }}
 */
export function AddressForm({addressId, address, defaultAddress, children}) {
  const {state, formMethod} = useNavigation();
  /** @type {ActionReturnData} */
  const action = useActionData();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  return (
    <Form id={addressId}>
      <fieldset>
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <label htmlFor="firstName">First name*</label>
        <input
          aria-label="First name"
          autoComplete="given-name"
          defaultValue={address?.firstName ?? ''}
          id="firstName"
          name="firstName"
          placeholder="First name"
          required
          type="text"
        />
        <label htmlFor="lastName">Last name*</label>
        <input
          aria-label="Last name"
          autoComplete="family-name"
          defaultValue={address?.lastName ?? ''}
          id="lastName"
          name="lastName"
          placeholder="Last name"
          required
          type="text"
        />
        <label htmlFor="company">Company</label>
        <input
          aria-label="Company"
          autoComplete="organization"
          defaultValue={address?.company ?? ''}
          id="company"
          name="company"
          placeholder="Company"
          type="text"
        />
        <label htmlFor="address1">Address line*</label>
        <input
          aria-label="Address line 1"
          autoComplete="address-line1"
          defaultValue={address?.address1 ?? ''}
          id="address1"
          name="address1"
          placeholder="Address line 1*"
          required
          type="text"
        />
        <label htmlFor="address2">Address line 2</label>
        <input
          aria-label="Address line 2"
          autoComplete="address-line2"
          defaultValue={address?.address2 ?? ''}
          id="address2"
          name="address2"
          placeholder="Address line 2"
          type="text"
        />
        <label htmlFor="city">City*</label>
        <input
          aria-label="City"
          autoComplete="address-level2"
          defaultValue={address?.city ?? ''}
          id="city"
          name="city"
          placeholder="City"
          required
          type="text"
        />
        <label htmlFor="zoneCode">State / Province*</label>
        <input
          aria-label="State/Province"
          autoComplete="address-level1"
          defaultValue={address?.zoneCode ?? ''}
          id="zoneCode"
          name="zoneCode"
          placeholder="State / Province"
          required
          type="text"
        />
        <label htmlFor="zip">Zip / Postal Code*</label>
        <input
          aria-label="Zip"
          autoComplete="postal-code"
          defaultValue={address?.zip ?? ''}
          id="zip"
          name="zip"
          placeholder="Zip / Postal Code"
          required
          type="text"
        />
        <label htmlFor="territoryCode">Country Code*</label>
        <input
          aria-label="territoryCode"
          autoComplete="country"
          defaultValue={address?.territoryCode ?? ''}
          id="territoryCode"
          name="territoryCode"
          placeholder="Country"
          required
          type="text"
          maxLength={2}
        />
        <label htmlFor="phoneNumber">Phone</label>
        <input
          aria-label="Phone Number"
          autoComplete="tel"
          defaultValue={address?.phoneNumber ?? ''}
          id="phoneNumber"
          name="phoneNumber"
          placeholder="+16135551111"
          pattern="^\+?[1-9]\d{3,14}$"
          type="tel"
        />
        <div>
          <input
            defaultChecked={isDefaultAddress}
            id="defaultAddress"
            name="defaultAddress"
            type="checkbox"
          />
          <label htmlFor="defaultAddress">Set as default address</label>
        </div>
        {error ? (
          <p>
            <mark>
              <small>{error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        {children({
          stateForMethod: (method) => (formMethod === method ? state : 'idle'),
        })}
      </fieldset>
    </Form>
  );
}

/**
 * @typedef {{
 *   addressId?: string | null;
 *   createdAddress?: AddressFragment;
 *   defaultAddress?: string | null;
 *   deletedAddress?: string | null;
 *   error: Record<AddressFragment['id'], string> | null;
 *   updatedAddress?: AddressFragment;
 * }} ActionResponse
 */

/** @typedef {import('@shopify/hydrogen/customer-account-api-types').CustomerAddressInput} CustomerAddressInput */
/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
/** @typedef {import('customer-accountapi.generated').CustomerFragment} CustomerFragment */
/** @typedef {import('@shopify/remix-oxygen').ActionFunctionArgs} ActionFunctionArgs */
/** @typedef {import('@shopify/remix-oxygen').LoaderFunctionArgs} LoaderFunctionArgs */
/** @template T @typedef {import('@remix-run/react').MetaFunction<T>} MetaFunction */
/** @template T @typedef {import('@remix-run/react').Fetcher<T>} Fetcher */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof action>} ActionReturnData */
