import { getElement } from "@li3/web";

/**
 * @example
 *    import { useQuery } from '@li3/use/async-state';
 *
 *    const listItems = useQuery('li');
 *
 *    for (const li of listItems.all) {
 *      // ...
 *    }
 */
export function useQuery(selector: string) {
  const element = getElement();

  return {
    get one() {
      return element.querySelector(selector);
    },

    get all() {
      return element.querySelectorAll(selector);
    },
  };
}
