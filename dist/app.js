/** Composition root: hydrate the model, render the views, then bind controllers. */
// Activate navigation even if saved data cannot be read or rendered.
bindPortalEvents();
hydratePortalState();

normalizeListRows(data);

renderLayouts();
render();

loadProjectLayouts();

renderProjects();

portalRepository.showStatus();

window.portalStartup?.ready();

initializeExperience();

