import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApiClient, ApiResponse, Timers } from '../src/api/client.js';
import {
  createClient,
  realTimers,
  requestWithRetry,
  standardHeaders,
} from '../src/api/client.js';
import { fetchRepository } from '../src/api/repository.js';
import { fetchHistory, nextPageFromLink } from '../src/api/history.js';
import { ApiError } from '../src/api/errors.js';

const FIXED_START = Date.UTC(2026, 8, 6);

interface Recorded {
  route: string;
  params: Record<string, unknown>;
}

function mockClient(
  handler: (
    call: Recorded,
    index: number,
  ) => ApiResponse | Promise<ApiResponse> | never,
): { client: ApiClient; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const client: ApiClient = {
    request: async (route: string, params: Record<string, unknown>) => {
      const call = { route, params };
      calls.push(call);
      return await handler(call, calls.length - 1);
    },
  };
  return { client, calls };
}

const instantTimers: Timers = {
  now: (() => {
    let t = 0;
    return () => (t += 1);
  })(),
  sleep: async () => undefined,
};

describe('standardHeaders', () => {
  it('sets version + accept, and authorization only with a token', () => {
    expect(standardHeaders('')['x-github-api-version']).toBe('2026-03-10');
    expect(standardHeaders('')['accept']).toBe('application/vnd.github+json');
    expect(standardHeaders('')['authorization']).toBeUndefined();
    expect(standardHeaders('tok')['authorization']).toBe('Bearer tok');
  });
});

describe('fetchRepository', () => {
  it('returns validated metadata', async () => {
    const { client, calls } = mockClient(() => ({
      status: 200,
      headers: {},
      data: {
        full_name: 'octocat/Hello-World',
        name: 'Hello-World',
        owner: { login: 'octocat' },
        created_at: '2020-01-01T00:00:00Z',
        stargazers_count: 42,
      },
    }));
    const meta = await fetchRepository(
      client,
      { owner: 'octocat', repo: 'hello-world' },
      'tok',
    );
    expect(meta.stargazersCount).toBe(42);
    expect(meta.fullName).toBe('octocat/Hello-World');
    expect(calls[0]?.params.headers).toMatchObject({
      authorization: 'Bearer tok',
    });
  });

  it('throws a helpful error for 404', async () => {
    const { client } = mockClient(() => {
      throw Object.assign(new Error('Not Found'), { status: 404 });
    });
    await expect(
      fetchRepository(client, { owner: 'a', repo: 'b' }, '', {
        timers: instantTimers,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects invalid metadata', async () => {
    const { client } = mockClient(() => ({
      status: 200,
      headers: {},
      data: { created_at: 'nope', stargazers_count: -1 },
    }));
    await expect(
      fetchRepository(client, { owner: 'a', repo: 'b' }, ''),
    ).rejects.toThrow(ApiError);
  });
});

describe('fetchHistory pagination', () => {
  it('follows Link: next until exhausted', async () => {
    const path = '/repos/a/b/stargazers/history';
    const page1 = Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(
        Date.UTC(2020, 0, 1) + i * 7 * 86400000,
      ).toISOString(),
      total: 1,
      days: [1, 0, 0, 0, 0, 0, 0],
    }));
    const page2 = [
      {
        timestamp: new Date(Date.UTC(2021, 0, 1)).toISOString(),
        total: 2,
        days: [2, 0, 0, 0, 0, 0, 0],
      },
    ];
    const { client, calls } = mockClient((call) => {
      const page = call.params.page;
      if (page === 1) {
        return {
          status: 200,
          headers: {
            link: `<https://api.github.com${path}?page=2>; rel="next"`,
          },
          data: page1,
        };
      }
      return { status: 200, headers: {}, data: page2 };
    });
    const weeks = await fetchHistory(client, { owner: 'a', repo: 'b' }, 'tok');
    expect(weeks).toHaveLength(31);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.params.per_page).toBe(30);
  });

  it('rejects malformed payloads', async () => {
    const { client } = mockClient(() => ({
      status: 200,
      headers: {},
      data: { not: 'an array' },
    }));
    await expect(
      fetchHistory(client, { owner: 'a', repo: 'b' }, ''),
    ).rejects.toThrow(ApiError);
  });

  it('rejects entries with bad daily values', async () => {
    const { client } = mockClient(() => ({
      status: 200,
      headers: {},
      data: [{ timestamp: '2020-01-01T00:00:00Z', total: 1, days: [1, 1] }],
    }));
    await expect(
      fetchHistory(client, { owner: 'a', repo: 'b' }, ''),
    ).rejects.toThrow(ApiError);
  });
});

describe('nextPageFromLink', () => {
  const path = '/repos/a/b/stargazers/history';
  it('returns null without a link', () => {
    expect(nextPageFromLink(undefined, path, 1)).toBeNull();
  });
  it('extracts an advancing page number', () => {
    expect(
      nextPageFromLink(
        `<https://api.github.com${path}?page=3>; rel="next"`,
        path,
        2,
      ),
    ).toBe(3);
  });
  it('rejects a non-advancing (cyclic) page', () => {
    expect(() =>
      nextPageFromLink(
        `<https://api.github.com${path}?page=1>; rel="next"`,
        path,
        2,
      ),
    ).toThrow(ApiError);
  });
  it('rejects an unexpected path', () => {
    expect(() =>
      nextPageFromLink(
        '<https://api.github.com/evil?page=2>; rel="next"',
        path,
        1,
      ),
    ).toThrow(ApiError);
  });
});

describe('requestWithRetry', () => {
  describe('overall deadline', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: FIXED_START });
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it.each([1999, 2000, 2001])(
      'checks the injected clock after a response completes at %ims',
      async (elapsed) => {
        let clock = FIXED_START + 1900;
        let signal: AbortSignal | undefined;
        const sleep = vi.fn(async () => undefined);
        const response = { status: 200, headers: {}, data: {} };
        const { client, calls } = mockClient(({ params }) => {
          signal = (params.request as { signal: AbortSignal }).signal;
          // Synchronous processing can cross the deadline before a timer fires.
          clock = FIXED_START + elapsed;
          return response;
        });
        const promise = requestWithRetry(
          client,
          'history',
          'GET /x',
          {},
          {
            startedAt: FIXED_START,
            budgetMs: 2000,
            requestTimeoutMs: 500,
            timers: { now: () => clock, sleep },
          },
        );
        if (elapsed < 2000) {
          await expect(promise).resolves.toBe(response);
        } else {
          await expect(promise).rejects.toMatchObject({
            name: 'ApiError',
            operation: 'history',
            message: expect.stringMatching(/history.*budget.*retry/i),
          });
        }
        expect(signal?.aborted).toBe(false);
        expect(calls).toHaveLength(1);
        expect(sleep).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it.each([1, 3])(
      'aborts Octokit at the remaining budget with maxAttempts=%i',
      async (maxAttempts) => {
        vi.setSystemTime(FIXED_START + 25);
        let signal: AbortSignal | undefined;
        const fetch = vi.fn(
          (_url: unknown, init?: RequestInit) =>
            new Promise<Response>((_, reject) => {
              signal = init?.signal ?? undefined;
              signal?.addEventListener('abort', () => {
                reject(
                  new DOMException('private transport details', 'AbortError'),
                );
              });
            }),
        );
        vi.stubGlobal('fetch', fetch);
        const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
        const promise = requestWithRetry(
          createClient(''),
          'history',
          'GET /repos/a/b',
          {},
          {
            startedAt: FIXED_START,
            budgetMs: 30,
            requestTimeoutMs: 500,
            maxAttempts,
            timers: { now: () => Date.now(), sleep },
          },
        );
        const rejected = expect(promise).rejects.toMatchObject({
          name: 'ApiError',
          operation: 'history',
          message: expect.stringMatching(/history.*budget.*retry/i),
        });
        await vi.advanceTimersByTimeAsync(4);
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(signal?.aborted).toBe(true);
        await rejected;
        await expect(promise).rejects.not.toThrow('private transport details');
        expect(fetch).toHaveBeenCalledOnce();
        expect(sleep).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it('rejects a late Octokit body even when the transport ignores abort', async () => {
      let signal: AbortSignal | undefined;
      let completeBody!: (body: string) => void;
      const response = Response.json({});
      const text = vi.spyOn(response, 'text').mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            completeBody = resolve;
          }),
      );
      const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return response;
      });
      vi.stubGlobal('fetch', fetch);
      const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
      const promise = requestWithRetry(
        createClient(''),
        'history',
        'GET /repos/a/b',
        {},
        {
          budgetMs: 30,
          requestTimeoutMs: 500,
          timers: { now: () => Date.now(), sleep },
        },
      );
      const rejected = expect(promise).rejects.toThrow(/history.*budget/i);
      await vi.advanceTimersByTimeAsync(0);
      expect(text).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(31);
      expect(signal?.aborted).toBe(true);
      completeBody('{}');
      await rejected;
      expect(fetch).toHaveBeenCalledOnce();
      expect(sleep).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('retries a per-request Octokit timeout while overall budget remains', async () => {
      const signals: AbortSignal[] = [];
      const fetch = vi.fn((_url: unknown, init?: RequestInit) => {
        const signal = init!.signal!;
        signals.push(signal);
        if (signals.length > 1)
          return Promise.resolve(Response.json({ ok: true }));
        return new Promise<Response>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('timed out', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetch);
      const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
      const promise = requestWithRetry(
        createClient(''),
        'history',
        'GET /repos/a/b',
        {},
        {
          budgetMs: 3000,
          requestTimeoutMs: 100,
          maxAttempts: 2,
          timers: { now: () => Date.now(), sleep },
        },
      );
      await vi.advanceTimersByTimeAsync(99);
      expect(signals[0]?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signals[0]?.aborted).toBe(true);
      expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
      await vi.advanceTimersByTimeAsync(999);
      expect(fetch).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toMatchObject({
        status: 200,
        data: { ok: true },
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(signals[1]?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    describe('aborted response bodies', () => {
      function stubBodyAborts(abortCount = Infinity) {
        const signals: AbortSignal[] = [];
        const bodies: Response[] = [];
        const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
          const signal = init!.signal!;
          signals.push(signal);
          const response =
            signals.length <= abortCount
              ? new Response(
                  new ReadableStream<Uint8Array>({
                    start(controller) {
                      signal.addEventListener(
                        'abort',
                        () => {
                          controller.error(
                            new DOMException(
                              'private body details',
                              'AbortError',
                            ),
                          );
                        },
                        { once: true },
                      );
                    },
                  }),
                  { headers: { 'content-type': 'application/json' } },
                )
              : Response.json({ ok: true });
          bodies.push(response);
          return response;
        });
        vi.stubGlobal('fetch', fetch);
        return { fetch, signals, bodies };
      }

      it('retries the empty 200 Octokit returns after a body timeout', async () => {
        const { fetch, signals, bodies } = stubBodyAborts(1);
        const client = createClient('');
        const request = vi.spyOn(client, 'request');
        const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
        const promise = requestWithRetry(
          client,
          'history',
          'GET /repos/a/b',
          {},
          {
            budgetMs: 3000,
            requestTimeoutMs: 20,
            maxAttempts: 2,
            timers: { now: () => Date.now(), sleep },
          },
        );
        await vi.advanceTimersByTimeAsync(19);
        expect(bodies[0]?.bodyUsed).toBe(true);
        expect(signals[0]?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(signals[0]?.aborted).toBe(true);
        // Real Octokit swallows the body-read abort and resolves a fake success.
        await expect(request.mock.results[0]?.value).resolves.toMatchObject({
          status: 200,
          data: '',
        });
        expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
        await vi.advanceTimersByTimeAsync(999);
        expect(fetch).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(1);
        await expect(promise).resolves.toMatchObject({
          status: 200,
          data: { ok: true },
        });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(signals[1]?.aborted).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
      });

      it.each([1, 3])(
        'prioritizes the overall deadline over body timeout with maxAttempts=%i',
        async (maxAttempts) => {
          vi.setSystemTime(FIXED_START + 25);
          const { fetch, signals, bodies } = stubBodyAborts();
          const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
          const promise = requestWithRetry(
            createClient(''),
            'history',
            'GET /repos/a/b',
            {},
            {
              startedAt: FIXED_START,
              budgetMs: 30,
              requestTimeoutMs: 500,
              maxAttempts,
              timers: { now: () => Date.now(), sleep },
            },
          );
          const rejected = expect(promise).rejects.toMatchObject({
            name: 'ApiError',
            operation: 'history',
            message: expect.stringMatching(/history.*budget.*retry/i),
          });
          await vi.advanceTimersByTimeAsync(4);
          expect(bodies[0]?.bodyUsed).toBe(true);
          expect(signals[0]?.aborted).toBe(false);
          await vi.advanceTimersByTimeAsync(1);
          await rejected;
          expect(signals[0]?.aborted).toBe(true);
          expect(fetch).toHaveBeenCalledOnce();
          expect(sleep).not.toHaveBeenCalled();
          expect(vi.getTimerCount()).toBe(0);
        },
      );

      it.each([1, 3])(
        'fails actionably after %i attempts with repeated body timeouts',
        async (maxAttempts) => {
          const { fetch, signals, bodies } = stubBodyAborts();
          const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
          const promise = requestWithRetry(
            createClient(''),
            'history',
            'GET /repos/a/b',
            {},
            {
              budgetMs: 5000,
              requestTimeoutMs: 20,
              maxAttempts,
              timers: { now: () => Date.now(), sleep },
            },
          );
          const rejected = expect(promise).rejects.toMatchObject({
            name: 'ApiError',
            operation: 'history',
            status: undefined,
            message: expect.stringMatching(/history.*timed out.*20ms.*retry/i),
          });
          await Promise.all([
            rejected,
            vi.advanceTimersByTimeAsync(maxAttempts === 1 ? 20 : 3060),
          ]);
          await expect(promise).rejects.not.toThrow('private body details');
          expect(fetch).toHaveBeenCalledTimes(maxAttempts);
          expect(signals.every((signal) => signal.aborted)).toBe(true);
          expect(bodies.every((body) => body.bodyUsed)).toBe(true);
          expect(sleep.mock.calls).toEqual(
            maxAttempts === 1 ? [] : [[1000], [2000]],
          );
          expect(vi.getTimerCount()).toBe(0);
        },
      );

      it.each([1019, 1020, 1021])(
        'only retries a body timeout when backoff fits the %ims budget',
        async (budgetMs) => {
          const { fetch } = stubBodyAborts(1);
          const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
          const promise = requestWithRetry(
            createClient(''),
            'history',
            'GET /repos/a/b',
            {},
            {
              budgetMs,
              requestTimeoutMs: 20,
              maxAttempts: 2,
              timers: { now: () => Date.now(), sleep },
            },
          );
          const checked =
            budgetMs > 1020
              ? expect(promise).resolves.toMatchObject({
                  status: 200,
                  data: { ok: true },
                })
              : expect(promise).rejects.toThrow(
                  /history.*budget.*waiting.*no early retry/i,
                );
          await Promise.all([checked, vi.advanceTimersByTimeAsync(1020)]);
          expect(fetch).toHaveBeenCalledTimes(budgetMs > 1020 ? 2 : 1);
          expect(sleep.mock.calls).toEqual(budgetMs > 1020 ? [[1000]] : []);
          expect(vi.getTimerCount()).toBe(0);
        },
      );

      it.each(['', '{invalid json', '{"not":"an array"}'])(
        'does not retry an honest malformed body: %j',
        async (body) => {
          let signal: AbortSignal | undefined;
          const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
            signal = init?.signal ?? undefined;
            return new Response(body, {
              headers: { 'content-type': 'application/json' },
            });
          });
          vi.stubGlobal('fetch', fetch);
          const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
          await expect(
            fetchHistory(createClient(''), { owner: 'a', repo: 'b' }, '', {
              budgetMs: 3000,
              requestTimeoutMs: 20,
              maxAttempts: 2,
              timers: { now: () => Date.now(), sleep },
            }),
          ).rejects.toThrow(/not an array/i);
          expect(signal?.aborted).toBe(false);
          expect(fetch).toHaveBeenCalledOnce();
          expect(sleep).not.toHaveBeenCalled();
          expect(vi.getTimerCount()).toBe(0);
        },
      );
    });

    it.each([404, 503, undefined])(
      'disposes timers and preserves errors before exhaustion (status %s)',
      async (status) => {
        const error = Object.assign(new Error('original error'), { status });
        const { client, calls } = mockClient(() => {
          throw error;
        });
        const sleep = vi.fn((ms: number) => realTimers.sleep(ms));
        await expect(
          requestWithRetry(
            client,
            'history',
            'GET /x',
            {},
            {
              maxAttempts: 1,
              timers: { now: () => Date.now(), sleep },
            },
          ),
        ).rejects.toBe(error);
        expect(calls).toHaveLength(1);
        expect(sleep).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      },
    );
  });

  it.each([
    { status: 403, headers: {}, wait: 60_000 },
    { status: 429, headers: { 'retry-after': 'nonsense' }, wait: 60_000 },
    { status: 429, headers: { 'retry-after': '-1' }, wait: 60_000 },
    { status: 429, headers: { 'retry-after': '1.5' }, wait: 1500 },
    {
      status: 403,
      headers: {
        'retry-after': '120',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String((FIXED_START + 180_000) / 1000),
      },
      wait: 180_000,
    },
    { status: 503, headers: {}, wait: 1000 },
  ])(
    'waits correctly for secondary limits, combined headers and transient errors: %j',
    async ({ status, headers, wait }) => {
      let clock = FIXED_START;
      const times: number[] = [];
      const { client } = mockClient((_, index) => {
        times.push(clock);
        if (!index)
          throw Object.assign(new Error('redacted'), {
            status,
            response: { headers },
          });
        return { status: 200, headers: {}, data: {} };
      });
      await requestWithRetry(
        client,
        'history',
        'GET /x',
        {},
        {
          timers: {
            now: () => clock,
            sleep: async (ms) => {
              clock += ms;
            },
          },
        },
      );
      expect(times).toEqual([FIXED_START, FIXED_START + wait]);
    },
  );

  it('accounts for time already spent and never starts a request at budget exhaustion', async () => {
    const { client, calls } = mockClient(() => ({
      status: 200,
      headers: {},
      data: {},
    }));
    await expect(
      requestWithRetry(
        client,
        'history',
        'GET /x',
        {},
        {
          startedAt: FIXED_START,
          budgetMs: 1000,
          timers: {
            now: () => FIXED_START + 1000,
            sleep: async () => undefined,
          },
        },
      ),
    ).rejects.toThrow(/budget/);
    expect(calls).toHaveLength(0);
  });

  it('bounds transient exponential backoff without capping server waits', async () => {
    let clock = 0;
    const waits: number[] = [];
    const { client } = mockClient((_, index) => {
      if (index < 5)
        throw Object.assign(new Error('unavailable'), { status: 503 });
      return { status: 200, headers: {}, data: {} };
    });
    await requestWithRetry(
      client,
      'history',
      'GET /x',
      {},
      {
        maxAttempts: 6,
        timers: {
          now: () => clock,
          sleep: async (ms) => {
            waits.push(ms);
            clock += ms;
          },
        },
      },
    );
    expect(waits).toEqual([1000, 2000, 4000, 8000, 8000]);
  });

  it('chunks real timers beyond Node’s maximum delay rather than retrying in 1ms', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      const sleep = realTimers.sleep(2_147_483_647 + 1000).then(done);
      await vi.advanceTimersByTimeAsync(2_147_483_647);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      await sleep;
      expect(done).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails safely for an out-of-range server retry date', async () => {
    const { client, calls } = mockClient(() => {
      throw Object.assign(new Error('secret-token'), {
        status: 429,
        response: { headers: { 'retry-after': '9007199254740991' } },
      });
    });
    await expect(
      requestWithRetry(
        client,
        'history',
        'GET /x',
        {},
        {
          timers: { now: () => FIXED_START, sleep: async () => undefined },
        },
      ),
    ).rejects.toThrow(/history.*budget.*retry.*supported date range/i);
    expect(calls).toHaveLength(1);
  });

  it.each([
    { 'retry-after': '120' },
    { 'retry-after': new Date(FIXED_START + 120_000).toUTCString() },
    {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String((FIXED_START + 120_000) / 1000),
    },
  ])('honours the full server wait beyond 90 seconds: %j', async (headers) => {
    let clock = FIXED_START;
    const calledAt: number[] = [];
    const timers: Timers = {
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    };
    const { client } = mockClient((_, index) => {
      calledAt.push(clock);
      if (index === 0)
        throw Object.assign(new Error('limited'), {
          status: 429,
          response: { headers },
        });
      return { status: 200, headers: {}, data: {} };
    });
    await requestWithRetry(client, 'history', 'GET /x', {}, { timers });
    expect(calledAt).toEqual([FIXED_START, FIXED_START + 120_000]);
  });

  it.each([
    { 'retry-after': '600' },
    { 'retry-after': new Date(FIXED_START + 600_000).toUTCString() },
    {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String((FIXED_START + 600_000) / 1000),
    },
  ])(
    'fails without premature retries when server wait exceeds budget: %j',
    async (headers) => {
      const sleep = vi.fn(async () => undefined);
      const { client, calls } = mockClient(() => {
        throw Object.assign(new Error('secret-token'), {
          status: 403,
          response: { headers },
        });
      });
      const promise = requestWithRetry(
        client,
        'history',
        'GET /x',
        {},
        {
          timers: { now: () => FIXED_START, sleep },
          budgetMs: 300_000,
        },
      );
      await expect(promise).rejects.toThrow(
        /history.*budget.*600s.*retry.*2026/i,
      );
      await expect(promise).rejects.not.toThrow('secret-token');
      expect(calls).toHaveLength(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it('retries transient 5xx then succeeds', async () => {
    let n = 0;
    const client: ApiClient = {
      request: async () => {
        n += 1;
        if (n < 2) {
          throw Object.assign(new Error('server'), { status: 503 });
        }
        return { status: 200, headers: {}, data: { ok: true } };
      },
    };
    const res = await requestWithRetry(
      client,
      'op',
      'GET /x',
      {},
      {
        timers: instantTimers,
      },
    );
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it('does not retry deterministic 404', async () => {
    let n = 0;
    const client: ApiClient = {
      request: async () => {
        n += 1;
        throw Object.assign(new Error('nf'), { status: 404 });
      },
    };
    await expect(
      requestWithRetry(client, 'op', 'GET /x', {}, { timers: instantTimers }),
    ).rejects.toThrow();
    expect(n).toBe(1);
  });

  it('fails with a budget message when the required wait exceeds the budget', async () => {
    const sleep = vi.fn(async () => undefined);
    let clock = 0;
    const timers: Timers = { now: () => clock, sleep };
    const client: ApiClient = {
      request: async () => {
        clock += 1;
        throw Object.assign(new Error('rl'), {
          status: 403,
          response: { headers: { 'retry-after': '30' } },
        });
      },
    };
    await expect(
      requestWithRetry(
        client,
        'op',
        'GET /x',
        {},
        {
          timers,
          maxAttempts: 5,
          budgetMs: 100,
        },
      ),
    ).rejects.toThrow(/budget/);
  });

  it('sleeps and retries a rate limit when within budget', async () => {
    const sleep = vi.fn(async () => undefined);
    let clock = 0;
    const timers: Timers = { now: () => clock, sleep };
    let n = 0;
    const client: ApiClient = {
      request: async () => {
        clock += 1;
        n += 1;
        if (n < 2) {
          throw Object.assign(new Error('rl'), {
            status: 403,
            response: { headers: { 'retry-after': '1' } },
          });
        }
        return { status: 200, headers: {}, data: { ok: true } };
      },
    };
    const res = await requestWithRetry(
      client,
      'op',
      'GET /x',
      {},
      {
        timers,
        maxAttempts: 5,
        budgetMs: 60_000,
      },
    );
    expect(res.status).toBe(200);
    expect(sleep).toHaveBeenCalledOnce();
  });
});
