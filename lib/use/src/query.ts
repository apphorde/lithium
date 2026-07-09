import { getElement } from '@li3/web';

export function useQuery(selector: string) {
  const element = getElement();

  return {
    get one() {
      return element.querySelector(selector);
    },

    get all() {
      return element.querySelectorAll(selector);
    }
  }
}