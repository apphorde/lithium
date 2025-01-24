import { ref, onInit } from "@li3/web";

export default function autoTableOfContent() {
  const links = ref([]);

  function navigateTo(id) {
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
  }

  function addSection(section) {
    const text = section.querySelector("h2").textContent.trim();
    links.value = [...links.value, { id: section.id, text }];
  }

  onInit(function () {
    document.body.addEventListener("addsection", (e) => addSection(e.detail));
  });

  return { navigateTo, links };
}
