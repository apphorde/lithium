import { signal } from "@li3/reactive";

export function useAsyncFetcher<T>(effect: (...args: any[]) => Promise<T> = fetch as any) {
  const error = signal("");
  const loading = signal(false);
  const empty = signal(false);
  const data = signal(null);

  const fetch = async (...args: any[]) => {
    loading.value = true;
    empty.value = false;

    try {
      const v = await effect(...args);
      data.value = v;
      empty.value = Array.isArray(v) ? !v.length : !v;
    } catch (e) {
      empty.value = false;
      error.value = e;
    } finally {
      loading.value = false;
    }
  };

  return { data, error, loading, empty, fetch };
}
