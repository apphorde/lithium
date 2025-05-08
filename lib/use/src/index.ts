import { signal } from "@li3/reactive";

export function useAsyncFetcher<T>(effect: (...args: any[]) => Promise<T>) {
  const error = signal("");
  const loading = signal(false);
  const empty = signal(false);
  const value = signal(null);

  const fetch = async (...args: any[]) => {
    loading.value = true;
    empty.value = false;

    try {
      const v = await effect(...args);
      value.value = v;
      empty.value = Array.isArray(v) ? !v.length : !v;
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  };

  return { error, loading, empty, fetch };
}
