// Single data path for every deployment: GET data/v1/<doc>. On GitHub Pages these are static
// files written by `harpy-core export`; on a server `harpy-core serve` renders them per request.
// There is no alternate source. If a document can't be loaded, the UI says so.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const DATA_ROOT = (process.env.NEXT_PUBLIC_DATA_URL || `${BASE}/data/v1`).replace(/\/+$/, "");

export class DataError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export async function getDoc<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${DATA_ROOT}/${path}`, { cache: "no-cache", signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new DataError(path, null, `network error loading ${path}`);
  }
  if (res.status === 404) throw new DataError(path, 404, `${path} is not in this archive`);
  if (!res.ok) throw new DataError(path, res.status, `HTTP ${res.status} loading ${path}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new DataError(path, res.status, `${path} is not valid JSON`);
  }
}
