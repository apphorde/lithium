import { describe, expect, it, vi } from "vitest";
import { mount, nextTick, onCleanup, ref, setFeatureFlag } from "./index.js";
import { computed, effect } from "./reactivity.js";
import { TemplateForeach } from "./rules.js";
import { walkDomTree } from "./internals.js";

function template(source: string) {
  const element = document.createElement("template");
  element.innerHTML = source;
  return element;
}

function waitForDom() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe("component cleanup", () => {
  it("disposes template effects when unmounted", async () => {
    const target = document.createElement("div");
    const state: { count?: any } = {};
    const unmount = mount(target, {
      template: template("<p>{{ count }}</p>"),
      setup() {
        state.count = ref(0);
        return { count: state.count };
      },
    });

    await nextTick();
    expect(target.textContent).toBe("0");

    unmount();
    state.count.value = 1;
    await nextTick();
    expect(target.textContent).toBe("0");
  });

  it("removes template event listeners when unmounted", () => {
    const target = document.createElement("div");
    const handler = vi.fn();
    const unmount = mount(target, {
      template: template('<button on-click="handle()">Click</button>'),
      setup: () => ({ handle: handler }),
    });
    const button = target.querySelector("button")!;

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs registered cleanup exactly once", () => {
    const target = document.createElement("div");
    const cleanup = vi.fn();
    const unmount = mount(target, {
      template: template("<p>content</p>"),
      setup: () => {
        onCleanup(cleanup);
        return {};
      },
    });

    unmount();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("DOM traversal", () => {
  it("visits text and element nodes in the existing breadth-first order", () => {
    const fragment = document.createDocumentFragment();
    const section = document.createElement("section");
    const paragraph = document.createElement("p");
    const text = document.createTextNode("text");
    paragraph.append(text);
    section.append(paragraph);
    fragment.append(section, document.createTextNode("tail"));

    const visited: Node[] = [];
    walkDomTree(fragment, (node) => visited.push(node), undefined);

    expect(visited).toEqual([section, fragment.childNodes[1], paragraph, text]);
  });

  it("walks wide subtrees without queue-shift or argument-spread limits", () => {
    const fragment = document.createDocumentFragment();
    const wide = document.createElement("div");
    for (let index = 0; index < 20_000; index++) {
      wide.append(document.createElement("i"));
    }
    fragment.append(wide);

    let visited = 0;
    walkDomTree(fragment, () => visited++, undefined);

    expect(visited).toBe(20_001);
  });
});

describe("computed dependencies", () => {
  it("stops tracking inactive branches", () => {
    const useFirst = ref(true);
    const first = ref(1);
    const second = ref(2);
    const values: number[] = [];
    const value = computed(() => (useFirst.value ? first.value : second.value));

    effect(
      () => value.value,
      (next) => values.push(next),
      { immediate: true },
    );
    useFirst.value = false;
    first.value = 10;
    second.value = 20;

    expect(values).toEqual([1, 2, 20]);
  });
});

describe("nested template structures", () => {
  it("matches both foreach and the legacy for attribute", () => {
    const rule = new TemplateForeach();
    const node = document.createElement("template");

    expect(rule.match(node, "foreach")).toBe(true);
    expect(rule.match(node, "for")).toBe(true);
  });

  it("links text and if content inside for rows", async () => {
    const target = document.createElement("div");
    const groups = ref([
      { name: "visible", visible: true },
      { name: "hidden", visible: false },
    ]);

    mount(target, {
      template: template(`
        <section>
          <template foreach="group of groups">
            <template if="group.visible">
              <p>Group: {{ group.name }}</p>
            </template>
          </template>
        </section>
      `),
      setup: () => ({ groups }),
    });

    await waitForDom();
    expect(target.textContent).toContain("Group: visible");
    expect(target.textContent).not.toContain("hidden");

    groups.value[1].visible = true;
    await waitForDom();
    expect(target.textContent).toContain("Group: hidden");
  });

  it("links for content inside if branches", async () => {
    const target = document.createElement("div");
    const visible = ref(false);
    const items = ref(["one", "two"]);

    mount(target, {
      template: template(`
        <template if="visible">
          <ul><template foreach="item of items"><li>{{ item }}</li></template></ul>
        </template>
      `),
      setup: () => ({ visible, items }),
    });

    await waitForDom();
    expect(target.textContent?.trim()).toBe("");

    visible.value = true;
    await waitForDom();
    expect(target.textContent).toContain("onetwo");
  });

  it("disposes removed for rows without throwing", async () => {
    const target = document.createElement("div");
    const items = ref(["one", "two", "three"]);

    mount(target, {
      template: template('<ul><template foreach="item of items"><li>{{ item }}</li></template></ul>'),
      setup: () => ({ items }),
    });

    await waitForDom();
    expect(target.querySelectorAll("li")).toHaveLength(3);

    items.value = ["one"];
    await waitForDom();
    expect(target.querySelectorAll("li")).toHaveLength(1);
    expect(target.textContent).toContain("one");
  });

  it("treats null and undefined for values as empty lists", async () => {
    const target = document.createElement("div");
    const items = ref<string[] | null | undefined>(undefined);

    mount(target, {
      template: template('<ul><template foreach="item of items"><li>{{ item }}</li></template></ul>'),
      setup: () => ({ items }),
    });

    await waitForDom();
    expect(target.querySelectorAll("li")).toHaveLength(0);

    items.value = ["loaded"];
    await waitForDom();
    expect(target.querySelectorAll("li")).toHaveLength(1);

    items.value = null;
    await waitForDom();
    expect(target.querySelectorAll("li")).toHaveLength(0);
  });

  it("runs the experimental code plan across bindings and nested structures", async () => {
    setFeatureFlag("codePlan", true);
    try {
      const target = document.createElement("div");
      const selected = vi.fn();
      const clicked = vi.fn();
      const visible = ref(true);
      const items = ref(["one", "two"]);
      mount(target, {
        template: template(`
          <button bind-title="title" on-click="clicked()" class-active="active">{{ title }}</button>
          <template if="visible">
            <ul><template for="item of items"><li on-click="select(item)">{{ item }}</li></template></ul>
          </template>
        `),
        setup: () => ({
          title: "Plan",
          clicked,
          active: true,
          visible,
          items,
          select: selected,
        }),
      });

      await waitForDom();
      const button = target.querySelector("button")!;
      expect(button.title).toBe("Plan");
      expect(button.textContent).toBe("Plan");
      expect(button.classList.contains("active")).toBe(true);
      expect(target.querySelectorAll("li")).toHaveLength(2);
      button.click();
      expect(clicked).toHaveBeenCalledTimes(1);
      target.querySelector("li")!.click();
      expect(selected).toHaveBeenCalledWith("one");

      visible.value = false;
      await waitForDom();
      expect(target.querySelectorAll("li")).toHaveLength(0);
      visible.value = true;
      items.value = ["three"];
      await waitForDom();
      expect(Array.from(target.querySelectorAll("li"), (li) => li.textContent)).toEqual(["three"]);
    } finally {
      setFeatureFlag("codePlan", false);
    }
  });
});
