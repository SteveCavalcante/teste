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
    const p = currentProject();
    if (!p) return;
    Object.assign(p, {
        rows: data,
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
    data = (p.rows || []).map((r) => ({ ...r }));
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
    if (confirmation !== "EXCLUIR") throw Error("Digite exatamente EXCLUIR.");
    if (!projects.some((p) => p.id === id))
        throw Error("Projeto não encontrado.");
    saveCurrentProject();
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
