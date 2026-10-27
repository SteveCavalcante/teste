/** Composition root: hydrate the model, render the views, then bind controllers. */
hydratePortalState();

$("guideFields").innerHTML = keys
    .map(
        (k) =>
            `<div class="guideRow"><code>${esc(k)}</code> obrigatório • texto</div>`,
    )
    .join("");

normalizeListRows(data);

persist();
renderLayouts();
render();

if (
    $("fileName").textContent.startsWith("Exemplo demonstrativo") &&
    !$("fileName").textContent.includes("33 Transtypes")
)
    loadDemoTranstypes();
loadProjectLayouts();

renderProjects();

bindPortalEvents();

portalRepository.showStatus();
