import {createCookieSessionStorage} from '@shopify/remix-oxygen';

/**
 * This is a custom session implementation for your Hydrogen shop.
 * Feel free to customize it to your needs, add helper methods, or
 * swap out the cookie-based implementation with something else!
 */
export class AppSession {
  /**
   * @public
   * @default false
   */
  isPending = false;

  #sessionStorage;
  #session;

  /**
   * @param {SessionStorage} sessionStorage
   * @param {Session} session
   */
  constructor(sessionStorage, session) {
    this.#sessionStorage = sessionStorage;
    this.#session = session;
  }

  /**
   * @static
   * @param {Request} request
   * @param {string[]} secrets
   */
  static async init(request, secrets) {
    const storage = createCookieSessionStorage({
      cookie: {
        name: 'session',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secrets,
      },
    });

    const session = await storage
      .getSession(request.headers.get('Cookie'))
      .catch(() => storage.getSession());

    return new this(storage, session);
  }

  get has() {
    return this.#session.has;
  }

  get get() {
    return this.#session.get;
  }

  get flash() {
    return this.#session.flash;
  }

  get unset() {
    this.isPending = true;
    return this.#session.unset;
  }

  get set() {
    this.isPending = true;
    return this.#session.set;
  }

  destroy() {
    return this.#sessionStorage.destroySession(this.#session);
  }

  commit() {
    this.isPending = false;
    return this.#sessionStorage.commitSession(this.#session);
  }
}

/** @typedef {import('@shopify/hydrogen').HydrogenSession} HydrogenSession */
/** @typedef {import('@shopify/remix-oxygen').SessionStorage} SessionStorage */
/** @typedef {import('@shopify/remix-oxygen').Session} Session */
