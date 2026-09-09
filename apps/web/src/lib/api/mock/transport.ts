import { handleRequest } from './routes';

/**
 * The seam: `fetch` itself.
 *
 * Everything above it runs untouched — `client.ts` still injects the
 * `Authorization` header, still unwraps the one envelope, still constructs the
 * one `ApiRequestError`, still retries a 401 exactly once. It simply gets its
 * responses from a route table instead of a socket. Anything not addressed to
 * the API base URL (fonts, covers, avatars) goes to the real network.
 */

const BASE_URL = import.meta.env.VITE_API_URL;

export function installMockTransport(): void {
  const base = new URL(BASE_URL, window.location.origin);
  const passThrough = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      return passThrough(input, init);
    }

    const path = url.pathname.slice(base.pathname.length) || '/';
    const outcome = handleRequest({
      method: request.method,
      path,
      query: url.searchParams,
      body: await readBody(request),
      token: bearer(request)
    });

    // Intercepted calls never appear in the network tab, so this is the only
    // trace of them. Loud on purpose.
    console.debug(`[mock] ${request.method} ${path}${url.search} → ${outcome.status}`);

    await latency(request.method);

    return new Response(JSON.stringify(outcome.payload), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' }
    });
  };
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return null;

  const raw = await request.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/**
 * Enough delay that loading states are something you see rather than something
 * you take on trust, and writes cost a little more than reads — which is how
 * the real one behaves.
 */
function latency(method: string): Promise<void> {
  const base = method === 'GET' ? 140 : 320;
  return new Promise((resolve) => setTimeout(resolve, base + Math.random() * 160));
}
