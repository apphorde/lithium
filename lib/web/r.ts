export class ReactiveContext {
  public check: VoidFunction;
  public suspended = false;
  public observers: AnyFunction[] = [];

  constructor() {
    this.check = check.bind(null, this);
  }

  watch<T>(getter: Ref<T> | (() => T), effect?: AnyFunction): void {
    if (typeof getter !== "function" && !isRef(getter)) {
      throw new Error("Watched expression must be a function");
    }

    if (effect && typeof effect !== "function") {
      throw new Error("Watcher effect must be a function");
    }

    this.observers.push(effect ? watchValue(getter, effect) : (getter as any));
  }

  ref<T>(initialValue: T | null, options?: RefOptions): Ref<T> {
    return ref(initialValue, this.check, options);
  }

  watchDeep<T extends object>(context: T, callback?: VoidFunction): T {
    return reactive(context, callback || this.check);
  }

  suspend(): void {
    this.suspended = true;
  }

  unsuspend(): void {
    this.suspended = false;
  }
}
