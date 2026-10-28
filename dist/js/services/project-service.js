/** services/project-service.js — focused functions used by the application controller. */
function suggestDestinationDatabase() {
    const defaults = {
        LK2: "db_corp_repositoriosdedados_integracaovarejo_contabil_spec_01",
        VP8: "db_corp_gestaodefinancas_integracao_recepcaocontabil_spec_01",
    };
    const previousDefaults = [
        "database_lk2_provisorio",
        "database_vp8_provisorio",
        ...Object.values(defaults),
    ];
    if (
        !integrationLocations.destinationDatabase ||
        previousDefaults.includes(integrationLocations.destinationDatabase)
    ) {
        integrationLocations.destinationDatabase =
            defaults[parameterType] || "";
    }
}

function persist() {
    if (projectReadOnly) return;
    if (projectEditActive) {
        $("saveProjectFeedback").textContent = "Alterações pendentes. Clique em Salvar para gravar.";
        updateUnsavedBanner();
        return;
    }
    saveCurrentProject();
    portalRepository.write("conecta-contabil-v1", {
        parameterType,
        serviceCode,
        rows: data,
        name: $("fileName").textContent,
    });
}

function currentProject() {
    return projects.find((p) => p.id === currentProjectId);
}

function saveProjectStore() {
    portalRepository.write("conecta-projects-v1", {
        schemaVersion: 1,
        selectedId: currentProjectId,
        projects,
    });
}

function saveCurrentProject() {
    if (projectEditActive) return;
    const p = currentProject();
    if (!p) return;
    Object.assign(p, {
        rows: data.map(r => ({ ...r })),
        parameterType,
        serviceCode,
        integrationLocations: { ...integrationLocations },
        parameterDetails: { ...parameterDetails },
        layoutId: selectedLayout,
        excluded: [...excludedTranstypes],
        pilot: [...pilotTranstypes],
        fileName: $("fileName").textContent,
        updatedAt: new Date().toISOString(),
    });
    saveProjectStore();
}

function restoreProject(id) {
    currentProjectId = id;
    const p = currentProject();
    if (p?.layoutSnapshot && !layouts.some(l => l.id === p.layoutId)) {
        try { layouts.push(parseLayoutRecord(p.layoutSnapshot)); } catch {}
    }
    parameterDetails = {
        squad: String(p?.parameterDetails?.squad ?? ""),
        knowledgeBase: String(p?.parameterDetails?.knowledgeBase ?? ""),
    };
    integrationLocations = Object.fromEntries(
        locationKeys.map((key) => [
            key,
            String(p?.integrationLocations?.[key] ?? ""),
        ]),
    );
    if (!p) {
        currentProjectId = null;
        data = [];
        parameterType = "";
        serviceCode = "";
        selectedLayout = "";
        excludedTranstypes = new Set();
        pilotTranstypes = new Set();
        $("fileName").textContent = "Nenhuma planilha importada";
        $("selectedProjectName").textContent = "";
        $("selectedProjectDescription").textContent = "";
        return;
    }
    data = (p.rows || []).map((r) => ({
        ...r,
        DESCRICAO_TRANSTYPE: removeAccents(r.DESCRICAO_TRANSTYPE),
    }));
    parameterType = p.parameterType || "";
    suggestDestinationDatabase();
    serviceCode = p.serviceCode || "";
    selectedLayout = p.layoutId || "";
    excludedTranstypes = new Set(p.excluded || []);
    pilotTranstypes = new Set(p.pilot || []);
    $("fileName").textContent = p.fileName || "Nenhuma planilha importada";
    $("selectedProjectName").textContent = p.name;
    $("selectedProjectDescription").textContent = p.description;
}

function setAllMarkings(kind, checked) {
    const codes = ttRecords().map((record) => record.tt),
        marks = kind === "pilot" ? pilotTranstypes : excludedTranstypes;
    for (const code of codes) checked ? marks.add(code) : marks.delete(code);
    persist();
    render();
    toast(
        (checked ? "Marcados" : "Desmarcados") +
            " " +
            codes.length +
            " Transtypes para " +
            (kind === "pilot" ? "piloto" : "exclusão") +
            ".",
    );
}

function removeProject(id, confirmation) {
    if (!isDeleteConfirmation(confirmation)) throw Error("Digite excluir para confirmar.");
    if (!projects.some((p) => p.id === id))
        throw Error("Projeto não encontrado.");
    discardProjectEdit();
    const remaining = projects.filter((p) => p.id !== id),
        selected = remaining.some((p) => p.id === currentProjectId)
            ? currentProjectId
            : remaining[0]?.id || null;
    portalRepository.write("conecta-projects-v1", {
        schemaVersion: 1,
        selectedId: selected,
        projects: remaining,
    });
    projects = remaining;
    restoreProject(selected);
    persist();
    tableState.page = 1;
    renderLayouts();
    render();
    showProjects();
}

function discardProjectEdit() {
    if (!projectEditActive) { projectReadOnly = false; return; }
    projectEditActive = false;
    projectReadOnly = false;
    restoreProject(currentProjectId);
}

function commitProjectEdit() {
    if (projectReadOnly) return;
    const editing = projectEditActive, original = currentProject() ? JSON.parse(JSON.stringify(currentProject())) : null;
    projectEditActive = false;
    try {
        persist();
        if (portalRepository.blocked) throw Error(portalRepository.message);
        projectBaseline = projectDraftKey();
    } catch (error) {
        if (original) projects = projects.map(p => p.id === original.id ? original : p);
        throw error;
    } finally { projectEditActive = editing; updateUnsavedBanner(); }
}
