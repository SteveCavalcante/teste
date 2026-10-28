/** Navigation actions reuse the existing project and layout storage. */
function setNavigation(id) {
    for (const button of document.querySelectorAll?.('aside .nav') || []) {
        button.classList.toggle('active', button.id === id);
        if (button.id === id) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    }
}

function showMainView(id) {
    for (const view of ['projectsView', 'parameterView', 'layoutListView', 'layoutDialog'])
        $(view).hidden = view !== id;
    updateBreadcrumb(id);
    updateUnsavedBanner();
    scrollTo({top: 0, behavior: 'smooth'});
}

function showParameterList() {
    showProjects();
}

function openLayoutAction(mode, id) {
    if (!permitNavigation()) return;
    layoutViewOnly = false;
    if (mode === 'edit' && !layouts.length) {
        toast('Nenhum layout cadastrado. Use Layout > Cadastrar.');
        return;
    }
    discardProjectEdit();
    setNavigation(mode === 'create' ? 'navLayoutCreate' : 'navLayouts');
    $('manageLayouts').onclick();
    layoutReturnToParameter = false;
    $('backLayouts').textContent = "Voltar";
    $('layoutDialogTitle').textContent = mode === 'create' ? 'Cadastrar layout' : mode === 'view' ? 'Exibir layout' : 'Alterar layout';
    $('layoutEditSelect').innerHTML = mode === 'create'
        ? '<option value="">Novo layout</option>'
        : layouts.map(l => `<option value="${esc(l.id)}">${esc(layoutDisplayName(l))}</option>`).join('');
    $('layoutEditSelect').value = mode === 'create' ? '' : (id || layouts[0].id);
    fillLayoutForm();
    layoutViewOnly = mode === "view";
    applyLayoutMode();
    layoutBaseline = layoutDraftKey();
    updateUnsavedBanner();
    updateBreadcrumb("layoutDialog");
}

function closeLayoutEditor() {
    if (!permitNavigation()) return;
    layoutBaseline = "";
    if (layoutReturnToParameter) {
        showMainView('parameterView');
        setNavigation('navHome');
    } else {
        showMainView('layoutListView');
        setNavigation('navLayouts');
        renderLayoutList();
    }
}

async function openLayoutConsultation() {
    if (!permitNavigation()) return;
    discardProjectEdit();
    setNavigation('navLayouts');
    showMainView('layoutListView');
    $('layoutListError').textContent = '';
    renderLayoutList();
    await loadProjectLayouts();
    renderLayoutList();
}

function renderLayoutList() {
    const query = normalizedText($('layoutListSearch').value);
    const matching = layouts.filter(l => normalizedText(l.name + ' ' + (l.code || '')).includes(query));
    $('layoutList').innerHTML = paginateList(sortConsultation(matching, 'layouts'), 'layouts').map(l => `<article class="layout-list-card">
        <div class="layout-list-heading"><div><h2>${esc(l.name)}</h2><p>Código: ${esc(l.code || 'Não informado')} · ${l.fields.length} campos</p><small>Cadastro: ${esc(formatLayoutDate(l.createdAt))} · Alteração: ${esc(formatLayoutDate(l.updatedAt))}</small></div>
        <div class="project-card-actions"><button type="button" class="secondary" data-view-layout="${esc(l.id)}">Exibir</button><button type="button" class="secondary" data-edit-layout="${esc(l.id)}">Alterar</button><button type="button" class="link danger" data-delete-layout="${esc(l.id)}">Excluir</button></div></div>
        <details><summary>Campos do layout</summary><div class="consult-table-wrap"><table><thead><tr><th>Produto</th><th>Spec</th><th>Tipo</th></tr></thead><tbody>${l.fields.map(f => `<tr><td>${esc(f.campo_produto)}</td><td>${esc(f.campo_dataprep)}</td><td>${esc(f.tipo)}</td></tr>`).join('')}</tbody></table></div></details>
        </article>`).join('') || '<p>Nenhum layout encontrado.</p>';
}

function requestLayoutDelete(id) {
    $('layoutEditSelect').innerHTML = layouts.map(l => `<option value="${esc(l.id)}">${esc(layoutDisplayName(l))}</option>`).join('');
    $('layoutEditSelect').value = id;
    $('layoutError').textContent = '';
    $('deleteLayout').onclick();
    $('layoutListError').textContent = $('layoutError').textContent;
}


function openProjectCreate() {
    if (!permitNavigation()) return;
    discardProjectEdit();
    renderLayouts();
    render();
    $("projectForm").reset();
    $("projectFormError").textContent = "";
    $("projectDialog").showModal();
}

function paginateList(items, key) {
    const state = listPagination[key], pages = Math.max(1, Math.ceil(items.length / state.size));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * state.size;
    $(key + "ListSize").value = String(state.size);
    $(key + "ListInfo").textContent = `Página ${state.page} de ${pages} · ${items.length} itens`;
    $(key + "ListPrevious").disabled = state.page === 1;
    $(key + "ListNext").disabled = state.page === pages;
    return items.slice(start, start + state.size);
}

function bindListPagination() {
    for (const key of ["projects", "layouts"]) {
        const render = key === "projects" ? renderProjects : renderLayoutList;
        for (const suffix of ["SortKey", "SortDirection"]) $(key + suffix).onchange = () => { listPagination[key].page = 1; render(); };
        $(key + "ListSize").onchange = () => {
            const size = Number($(key + "ListSize").value);
            if (![10, 50, 100].includes(size)) return;
            listPagination[key] = {page: 1, size}; render();
        };
        $(key + "ListPrevious").onclick = () => { listPagination[key].page--; render(); };
        $(key + "ListNext").onclick = () => { listPagination[key].page++; render(); };
    }
}

function sortConsultation(records, key) {
    const field = $(key + 'SortKey').value || 'name';
    const direction = $(key + 'SortDirection').value === 'desc' ? -1 : 1;
    return records.map((record,index)=>({record,index})).sort((a,b)=>{
        let result;
        if (field === 'name') result = tableCollator.compare(a.record.name || '', b.record.name || '');
        else {
            const left = Date.parse(a.record[field]), right = Date.parse(b.record[field]);
            if (!Number.isFinite(left) || !Number.isFinite(right)) {
                if (Number.isFinite(left)) return -1;
                if (Number.isFinite(right)) return 1;
                return a.index-b.index;
            }
            result = left-right;
        }
        return result*direction || a.index-b.index;
    }).map(item=>item.record);
}
