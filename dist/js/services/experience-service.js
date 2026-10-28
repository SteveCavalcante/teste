function projectDraftKey() {
    return JSON.stringify([data,parameterType,serviceCode,integrationLocations,parameterDetails,selectedLayout,[...excludedTranstypes],[...pilotTranstypes]]);
}
function layoutDraftKey() {
    return JSON.stringify([$('layoutCode').value,$('layoutName').value,$('layoutFields').value]);
}
function hasUnsavedChanges() {
    if (!$('layoutDialog').hidden) return !layoutViewOnly && !!layoutBaseline && layoutDraftKey() !== layoutBaseline;
    return !$('parameterView').hidden && projectEditActive && !projectReadOnly && !!projectBaseline && projectDraftKey() !== projectBaseline;
}
function updateUnsavedBanner() { $('unsavedBanner').hidden = !hasUnsavedChanges(); }
function permitNavigation() {
    if (!hasUnsavedChanges()) return true;
    return typeof window.confirm !== 'function' || window.confirm('Há alterações não salvas. Sair e descartar essas alterações?');
}
function updateBreadcrumb(view) {
    const roots = view.startsWith('layout') ? 'Layout' : 'Parametrização';
    const list = view.startsWith('layout') ? 'navLayouts' : 'navHome';
    const action = view === 'layoutDialog' ? $('layoutDialogTitle').textContent : view === 'parameterView' ? (projectReadOnly ? 'Exibir' : 'Alterar') + ': ' + (currentProject()?.name || '') : 'Consultar';
    $('breadcrumb').innerHTML = `<button type="button" class="link" data-breadcrumb="navHome">Roteirizou!</button><span>/</span><button type="button" class="link" data-breadcrumb="${list}">${roots}</button><span>/</span><span aria-current="page">${esc(action)}</span>`;
}
function applyProjectMode() {
    const allowed = new Set(['search','filter','pageSize']);
    for (const element of $('parameterView').querySelectorAll('input,select,textarea'))
        if (!allowed.has(element.id)) element.disabled = projectReadOnly;
    for (const id of ['saveProject','saveProjectBottom','importBtn','importProjectJson','copyProject','manageLayouts','pilotAll','pilotNone','excludeAll','excludeNone']) $(id).hidden = projectReadOnly;
    updateUnsavedBanner();
}
function applyLayoutMode() {
    for (const id of ['layoutCode','layoutName','layoutFields','layoutUpload','layoutSheet']) $(id).disabled = layoutViewOnly;
    $('saveLayout').hidden = layoutViewOnly;
    $('layoutTemplate').hidden = layoutViewOnly;
}
function initializeExperience() {
    try { document.body.classList.toggle('sidebar-collapsed',localStorage.getItem('roteirizou-sidebar') === 'collapsed'); } catch {}
    const sync = () => {
        const collapsed = document.body.classList.contains('sidebar-collapsed');
        $('toggleSidebar').setAttribute('aria-expanded',String(!collapsed));
        $('toggleSidebar').setAttribute('aria-label',collapsed ? 'Expandir menu' : 'Recolher menu');
    };
    sync();
    $('toggleSidebar').onclick = () => {
        document.body.classList.toggle('sidebar-collapsed'); sync();
        try { localStorage.setItem('roteirizou-sidebar',document.body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded'); } catch {}
    };
    $('brandHome').onclick = event => { event.preventDefault(); showProjects(); };
    $('breadcrumb').onclick = event => {
        const button = event.target.closest('[data-breadcrumb]');
        if (button) $(button.dataset.breadcrumb).onclick();
    };
    window.addEventListener('beforeunload',event => { if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; } });
    document.addEventListener('input',updateUnsavedBanner);
    document.addEventListener('change',updateUnsavedBanner);
    updateBreadcrumb('projectsView');
}
