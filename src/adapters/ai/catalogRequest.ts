import {AiCatalogError} from '../../ports/aiCatalog';

export type CatalogRequest = (url: string, init: RequestInit) => Promise<Response>;

/** Catalog GETs only. Never follow a redirect with credentials or expose upstream error bodies. */
export async function requestCatalog(url: string, headers: Record<string, string>, signal: AbortSignal, request: CatalogRequest = fetch): Promise<unknown> {
  if (signal.aborted) throw new AiCatalogError('network');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, {once: true});
  let timedOut = false;
  const timer = setTimeout(() => {timedOut = true; controller.abort();}, 15000);
  try {
    const response = await request(url, {method: 'GET', headers: {...headers, Accept: 'application/json'}, signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store'});
    if (!response.ok) throw new AiCatalogError(response.status === 401 ? 'auth' : response.status === 403 ? 'permission' : response.status === 429 ? 'rate' : response.status === 404 ? 'unavailable' : 'response');
    return await response.json();
  } catch (error) {
    if (timedOut) throw new AiCatalogError('timeout');
    if (error instanceof AiCatalogError) throw error;
    throw new AiCatalogError(error instanceof SyntaxError ? 'response' : 'network');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
