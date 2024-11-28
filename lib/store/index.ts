import { ref } from '@lithium/reactive';
import type { Ref } from '@lithium/reactive';

export function useStore<T>(initialState: T) {
  function select<V>(selector: (state: T) => V): Ref<V>
}