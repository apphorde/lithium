import { ref } from "@li3/web";

export function useAsyncState<T>(effect: (...args: any[]) => Promise<T> = fetch as any) {
  const error = ref("");
  const loading = ref(false);
  const empty = ref(false);
  const data = ref(null);

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