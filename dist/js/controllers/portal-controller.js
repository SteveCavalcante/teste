/** controllers/portal-controller.js — focused functions used by the application controller. */
function saveLayouts() {
    portalRepository.write("conecta-layouts-v1", {
        schemaVersion: 3,
        layouts,
        selectedLayout,
    });
}

function loadLayoutSheet() {
    try {
        let rows = XLSX.utils.sheet_to_json(
                layoutWorkbook.Sheets[$("layoutSheet").value],
                { header: 1, defval: "", raw: false, blankrows: false },
            ),
            headers = rows[0] || [],
            positions = ["campoproduto", "campodataprep", "tipo"].map((k) =>
                headers.findIndex(
                    (h) =>
                        norm(h) === k ||
                        (k === "campoproduto" && norm(h) === "campoorigem") ||
                        (k === "campodataprep" && norm(h) === "campospec"),
                ),
            );
        if (positions.slice(1).some((i) => i < 0))
            throw Error(
                "A aba deve conter campo_spec e tipo. campo_produto é opcional.",
            );
        if (rows.length > 10001)
            throw Error("Use no máximo 10.000 campos no layout.");
        let fields = validateLayoutFields(
            rows.slice(1).map((row) => ({
                campo_produto: fieldName(row[positions[0]]),
                campo_dataprep: fieldName(row[positions[1]]),
                tipo: layoutType(row[positions[2]]),
            })),
        );
        $("layoutFields").value = layoutText(fields);
        previewLayout();
    } catch (e) {
        $("layoutFields").value = "";
        $("layoutPreview").innerHTML = "";
        $("layoutError").textContent = e.message;
    }
}

function refreshLayoutOptions() {
    const edit = $("layoutEditSelect").value;
    $("layoutEditSelect").innerHTML =
        '<option value="">Novo layout</option>' +
        layouts
            .map(
                (l) =>
                    `<option value="${esc(l.id)}" ${l.id === edit ? "selected" : ""}>${esc(layoutDisplayName(l))}</option>`,
            )
            .join("");
    renderLayouts();
    renderLayoutStorage();
}

function editTt(tt) {
    if (projectReadOnly) return;
    const rows = data.filter((r) => String(r.transtype ?? "") === tt);
    if (!rows.length) return;
    const base = rows[0],
        conflicts = meta.filter((k) => rows.some((r) => r[k] !== base[k]));
    ttDraft = {
        originalTt: tt,
        shared: Object.fromEntries(meta.map((k) => [k, String(base[k] ?? "")])),
        conditions: rows.map((r) => ({
            id: newRecordId(),
            campo: r.campo,
            operador: r.operador,
            valor: r.valor,
            _connector: r._connector || "AND",
        })),
        conflicts,
        importError: rows.find((r) => r._sqlImportError)?._sqlImportError ||
            (rows.some(r => ["OR", "OU"].includes(String(r._connector || "").toUpperCase()))
                ? "A regra contém OR/OU. Altere para AND/E e revalide antes de salvar." : ""),
    };
    $("rawSqlRepair").hidden = !ttDraft.importError;
    $("rawSqlInput").value = ttDraft.importError
        ? (rows.some(r => r._sqlImportError || r._sourceSql !== undefined)
            ? originalSqlFor(rows)
            : rows.map((r, i) => (i ? normalizedConnector(r._connector) + " " : "") + expression(r)).join("\n"))
        : "";
    $("rawSqlError").textContent = ttDraft.importError;
    $("rawSqlError").classList.remove("success");
    $("ttEditorTitle").textContent = "Editar Transtype " + (tt || "sem código");
    $("ttSharedWarning").textContent = conflicts.length
        ? "Há dados divergentes em " +
          conflicts.map((k) => sharedLabels[k]).join(", ") +
          ". O editor mostra os valores do primeiro registro. Ao salvar, os dados compartilhados acima serão aplicados a todas as condições."
        : "";
    renderSharedFields();
    renderTtConditions();
    ttFeedback();
    $("editor").showModal();
}

function conditionFieldOptions(value, query = "") {
    const fields = selectableFields(),
        selected = fieldName(value),
        known = !!resolveField(selected);
    return (
        '<option value="" disabled ' +
        (!selected ? "selected" : "") +
        ">Selecione um campo do layout</option>" +
        (selected && !known
            ? `<option value="${esc(selected)}" selected disabled>⚠ Não localizado: ${esc(selected)}</option>`
            : "") +
        fields
            .map(
                (f) =>
                    `<option value="${esc(f.value)}" ${fieldKey(f.value) === fieldKey(selected) ? "selected" : ""}>${esc(fieldPickerLabel(f.name))}</option>`,
            )
            .join("")
    );
}

function pickerControl(id) {
    return id.startsWith("shared-")
        ? $("tt_shared_" + id.slice(7))
        : $("tt_campo_" + id);
}

function filterConditionFields(id, query) {
    const value = pickerControl(id).value,
        source = $("tt_field_popup_" + id).dataset.activeSource || "Produto",
        matches = selectableFields()
            .filter((f) => f.origin.includes(source))
            .filter((f) =>
                normalizedText(f.name + " " + source + " " + f.tipo).includes(
                    normalizedText(query),
                ),
            );
    $("tt_field_options_" + id).innerHTML =
        matches
            .map(
                (f) =>
                    `<button type="button" role="option" aria-selected="${f.name === value}" data-pick-field="${esc(f.value)}" data-picker-id="${id}">${esc(f.name)}${source === "Produto" && f.value !== f.name ? " → " + esc(f.target) : ""} <small class="field-origin">${esc(source)} · ${esc(f.tipo)}</small></button>`,
            )
            .join("") ||
        '<div class="field-no-results">Nenhum campo encontrado</div>';
    $("tt_search_status_" + id).textContent =
        matches.length + " campo(s) de " + source;
    for (const button of $("tt_field_popup_" + id).querySelectorAll(
        "[data-field-source]",
    ))
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.fieldSource === source),
        );
}

function closeFieldPicker(returnFocus = false) {
    if (!openFieldPickerId) return;
    const id = openFieldPickerId,
        popup = $("tt_field_popup_" + id),
        button = $("tt_field_button_" + id);
    if (popup) popup.hidden = true;
    if (button) {
        button.setAttribute("aria-expanded", "false");
        if (returnFocus) button.focus({ preventScroll: true });
    }
    openFieldPickerId = null;
}

function openFieldPicker(id) {
    if (openFieldPickerId === id) {
        closeFieldPicker(true);
        return;
    }
    closeFieldPicker();
    const button = $("tt_field_button_" + id),
        popup = $("tt_field_popup_" + id),
        rect = button.getBoundingClientRect(),
        width = Math.min(Math.max(rect.width, 290), window.innerWidth - 24);
    popup.hidden = false;
    popup.style.width = width + "px";
    popup.style.left =
        Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) +
        "px";
    popup.style.top =
        (window.innerHeight - rect.bottom < 320
            ? Math.max(12, rect.top - 320)
            : rect.bottom + 4) + "px";
    button.setAttribute("aria-expanded", "true");
    openFieldPickerId = id;
    const search = $("tt_field_search_" + id),
        value = pickerControl(id).value;
    popup.dataset.activeSource =
        pickerControl(id).dataset.selectedSource ||
        (value &&
        (activeLayout()?.fields || []).some((f) => f.campo_produto === value)
            ? "Produto"
            : value &&
                (activeLayout()?.fields || []).some(
                    (f) => f.campo_dataprep === value,
                )
              ? "Spec"
              : (activeLayout()?.fields || []).some((f) => f.campo_produto)
                ? "Produto"
                : "Spec");
    search.value = "";
    filterConditionFields(id, "");
    positionFieldPicker();
    search.focus({ preventScroll: true });
}

function updateFieldPickerLabels() {
    const ids = ttDraft.conditions
        .map((c) => c.id)
        .concat(meta.map((k, i) => "shared-" + i));
    for (const id of ids) {
        const button = $("tt_field_button_" + id);
        if (button)
            button.querySelector(".field-picker-value").textContent =
                fieldPickerLabel(
                    pickerControl(id).value,
                    pickerControl(id).dataset.selectedSource,
                );
    }
}

function handleFieldPickerClick(event) {
    const sourceButton = event.target.closest("button[data-field-source]");
    if (sourceButton) {
        const id = sourceButton.dataset.pickerId;
        $("tt_field_popup_" + id).dataset.activeSource =
            sourceButton.dataset.fieldSource;
        filterConditionFields(id, $("tt_field_search_" + id).value);
        return true;
    }
    const trigger = event.target.closest("[data-open-picker]");
    if (trigger) {
        openFieldPicker(trigger.dataset.openPicker);
        return true;
    }
    const option = event.target.closest("[data-pick-field]");
    if (option) {
        const id = option.dataset.pickerId,
            field = option.dataset.pickField;
        if (!resolveField(field)) return true;
        const control = pickerControl(id);
        control.value = field;
        control.dataset.selectedSource = $(
            "tt_field_popup_" + id,
        ).dataset.activeSource;
        control.dispatchEvent(new Event("change", { bubbles: true }));
        ttFeedback();
        updateFieldPickerLabels();
        closeFieldPicker(true);
        return true;
    }
    return false;
}

function captureTtDraft() {
    for (const k of meta)
        ttDraft.shared[k] = $("tt_shared_" + meta.indexOf(k)).value.trim();
    for (const condition of ttDraft.conditions)
        for (const k of ["campo", "operador", "valor"])
            condition[k] = $("tt_" + k + "_" + condition.id).value.trim();
    for (const condition of ttDraft.conditions)
        condition._connector = "AND";
    return normalizeListRows(
        ttDraft.conditions.map((c) => ({
            ...ttDraft.shared,
            campo: c.campo,
            operador: c.operador,
            valor: c.valor,
            _connector: c._connector,
            ...(ttDraft.importError
                ? {
                      _sqlImportError: ttDraft.importError,
                      _rawSql: $("rawSqlInput").value,
                  }
                : {}),
        })),
    );
}

function normalizeTtInput(event) {
    const element = event.target;
    if (element.dataset.fieldSearch) {
        filterConditionFields(element.dataset.fieldSearch, element.value);
        return;
    }
    const start = element.selectionStart,
        key = element.dataset.shared || element.dataset.conditionField;
    if (key === "valor") {
        const id = element.dataset.conditionId,
            field = resolveField($("tt_campo_" + id).value),
            op = normalizedOp($("tt_operador_" + id).value);
        if (field?.tipo === "STRING") {
            if (["IN", "NOT IN"].includes(op))
                element.value = element.value
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(
                        /'((?:''|[^'])*)'/g,
                        (_, v) =>
                            "'" + normalizedText(v.replace(/''/g, "'")) + "'",
                    );
            else
                element.value = element.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9\s]/g, "");
        }
    }
    if (start !== null && element.setSelectionRange)
        element.setSelectionRange(
            Math.min(start, element.value.length),
            Math.min(start, element.value.length),
        );
    ttFeedback();
}

function replaceTtRows(source, oldTt, replacement) {
    const result = [],
        seen = new Set();
    for (const row of source) {
        if (String(row.transtype ?? "") === oldTt) {
            if (!seen.has(oldTt)) {
                result.push(...replacement);
                seen.add(oldTt);
            }
        } else result.push(row);
    }
    return result;
}

function openImport() {
    if ($("parameterView").hidden) {
        toast("Acesse um projeto antes de importar.");
        return;
    }
    if (!parameterType) {
        toast("Selecione o tipo LK2 ou VP8 antes de importar.");
        $("typeLK2").focus();
        return;
    }
    $("importDialog").showModal();
}

function download(rows, name) {
    let wb = XLSX.utils.book_new(),
        ws = XLSX.utils.json_to_sheet(
            rows.map((r) =>
                Object.fromEntries(keys.map((k) => [k, String(r[k] ?? "")])),
            ),
            { header: keys },
        );
    ws["!cols"] = keys.map((k) => ({ wch: Math.max(k.length + 2, 20) }));
    XLSX.utils.book_append_sheet(wb, ws, "Parametrizacoes");
    XLSX.writeFile(wb, name);
}

function generateParameterization() {
    const records = visibleTts();
    if (!records.length) {
        toast("Não há Transtypes exibidos para gerar a parametrização.");
        return;
    }
    const headers = [
        "TRANSTYPE",
        "DESCRIÇÃO TRANSTYPE",
        "REGRA",
        "EMPRESA",
        "ATRIBUTO DATA",
        "ATRIBUTO VALOR",
        "DEPARTAMENTO DÉBITO",
        "DEPARTAMENTO CRÉDITO",
        "CONTA DÉBITO",
        "CONTA CRÉDITO",
        "REVISÃO",
        "VALIDAÇÃO",
        "EXCLUIR",
        "PILOTO",
        "PROJETO",
    ];
    const content = [
            headers,
            ...records.map((record) => [
                ...ttColumns.map((k) =>
                    k === "regra_sql"
                        ? record.sql
                        : attributeDisplayValue(record.base[k], k),
                ),
                record.errors.length ? "Com alerta" : "Sem alertas",
                record.errors.join(" | ") || "Todos os campos preenchidos.",
                excludedTranstypes.has(record.tt) ? "SIM" : "NÃO",
                pilotTranstypes.has(record.tt) ? "SIM" : "NÃO",
                currentProject()?.name || "",
            ]),
        ],
        wb = XLSX.utils.book_new(),
        ws = XLSX.utils.aoa_to_sheet(content);
    ws["!cols"] = headers.map((header, i) => ({
        wch: i === 2 || i === 11 ? 75 : Math.max(header.length + 2, 20),
    }));
    ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: content.length - 1, c: headers.length - 1 },
        }),
    };
    XLSX.utils.book_append_sheet(wb, ws, "Parametrizacao");
    XLSX.writeFile(
        wb,
        "parametrizacao" +
            (parameterType ? "_" + parameterType : "") +
            (serviceCode ? "_" + serviceCode : "") +
            ".xlsx",
    );
    toast(
        records.length +
            " Transtype(s) incluído(s) no Excel da parametrização.",
    );
}

function importKeys() {
    return [...meta, "regra_sql"];
}

function readSheet() {
    raw = XLSX.utils.sheet_to_json(workbook.Sheets[$("sheet").value], {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
    });
    renderMapping();
}

function loadDemoTranstypes() {
    const existing = portalRepository.readRaw("conecta-contabil-v1");
    if (existing) portalRepository.writeRaw("conecta-before-demo", existing);
    data = demo.map((r) => ({ ...r }));
    parameterType = parameterType || "LK2";
    const example = {
        id: "demonstracao-33-transtypes",
        name: "Layout de demonstração (33 Transtypes)",
        fields: demoLayoutFields.map((f) => ({ ...f })),
    };
    layouts = layouts.filter((l) => l.id !== example.id);
    layouts.push(example);
    selectedLayout = example.id;
    saveLayouts();
    $("fileName").textContent =
        "Exemplo demonstrativo • 33 Transtypes fictícios";
    normalizeListRows(data);

    persist();
    renderLayouts();
    render();
    toast("Exemplo carregado: 33 Transtypes com regras consolidadas.");
}

function showProjects() {
    if (!permitNavigation()) return;
    discardProjectEdit();
    showMainView("projectsView");
    setNavigation("navHome");
    renderProjects();
    scrollTo({ top: 0, behavior: "smooth" });
}

function openProject(id, readOnly = false) {
    if (!permitNavigation()) return;
    projectReadOnly = readOnly;
    setNavigation("navHome");
    $("saveProjectFeedback").textContent = "";
    restoreProject(id);
    projectEditActive = !readOnly;
    projectBaseline = "";
    tableState.page = 1;
    $("search").value = "";
    $("filter").value = "all";
    renderLayouts();
    normalizeListRows(data);
    render();
    showMainView("parameterView");
    projectBaseline = projectDraftKey();
    updateUnsavedBanner();
    scrollTo({ top: 0, behavior: "smooth" });
}

function openDeleteProject(id) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    deletingProjectId = id;
    $("deleteProjectConfirmation").value = "";
    $("confirmDeleteProject").disabled = true;
    $("deleteProjectError").textContent = "";
    $("deleteProjectMessage").textContent =
        'Excluir o projeto "' +
        project.name +
        '" e seus ' +
        new Set(project.rows.map((r) => r.transtype)).size +
        " Transtypes? As parametrizações e marcações desse projeto serão apagadas. Os layouts serão mantidos para reutilização. Esta ação não pode ser desfeita.";
    $("deleteProjectDialog").showModal();
}

/** Bind DOM events once, after model hydration and initial rendering. */
function bindPortalEvents() {
    $("exportProjectJson").onclick = exportProjectJson;
    $("copyProject").onclick = copyProject;
    $("cancelCopyProject").onclick = () => $("copyProjectDialog").close();
    $("copyProjectForm").onsubmit = confirmProjectCopy;
    for (const id of ["importProjectJson", "importProjectJsonList"]) $(id).onclick = () => $("projectJsonFile").click();
    $("projectJsonFile").onchange = event => importProjectJson(event.target.files[0]);
    $("saveProject").onclick = () => {
        try {
            commitProjectEdit();
            let message;
            if (portalRepository.blocked) message = "Não foi possível confirmar o salvamento no arquivo. " + portalRepository.message;
            else if (portalRepository.local) message = "Projeto salvo no computador em dados/projetos/.";
            else message = "Projeto salvo neste navegador. Para salvar em arquivo, execute o portal com Python.";
            $("saveProjectFeedback").textContent = message;
            toast(message);
        } catch (error) {
            $("saveProjectFeedback").textContent = "Não foi possível salvar: " + error.message;
            toast($("saveProjectFeedback").textContent);
        }
    };
    $("parameterSquad").oninput = () => {
        parameterDetails.squad = $("parameterSquad").value;
        persist();
    };
    $("parameterKnowledgeBase").oninput = () => {
        parameterDetails.knowledgeBase = $("parameterKnowledgeBase").value;
        persist();
    };
    $("rawSqlInput").oninput = () => {
        if (!ttDraft) return;
        ttDraft.importError =
            "Regra alterada. Clique em Revalidar regra antes de salvar.";
        $("rawSqlError").textContent = ttDraft.importError;
        ttFeedback();
    };
    $("revalidateRawSql").onclick = revalidateImportedRule;
    document.addEventListener(
        "click",
        (event) => {
            if (
                openFieldPickerId &&
                !event.target.closest(".condition-field-picker")
            )
                closeFieldPicker();
        },
        { capture: true },
    );
    $("editor").addEventListener("scroll", positionFieldPicker, {
        passive: true,
    });
    window.addEventListener("resize", positionFieldPicker);
    $("editor").addEventListener("keydown", (event) => {
        if (!openFieldPickerId) return;
        const id = openFieldPickerId;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeFieldPicker(true);
            return;
        }
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            const options = [
                ...$("tt_field_options_" + id).querySelectorAll(
                    '[role="option"]',
                ),
            ];
            if (!options.length) return;
            event.preventDefault();
            const current = options.indexOf(document.activeElement),
                next =
                    event.key === "ArrowDown"
                        ? (current + 1) % options.length
                        : current <= 0
                          ? options.length - 1
                          : current - 1;
            options[next].focus();
        }
    });
    $("editor").addEventListener("close", () => closeFieldPicker());
    $("layoutSelect").onchange = () => {
        selectedLayout = $("layoutSelect").value;
        saveLayouts();
        normalizeListRows(data);

        persist();
        renderLayouts();
        render();
    };
    $("manageLayouts").onclick = () => {
        if (!permitNavigation()) return;
        layoutViewOnly = false;
        applyLayoutMode();
        $("layoutDialogTitle").textContent = "Cadastrar ou alterar layout";
        $("layoutEditSelect").innerHTML =
            '<option value="">Novo layout</option>' +
            layouts
                .map(
                    (l) =>
                        `<option value="${esc(l.id)}" ${l.id === selectedLayout ? "selected" : ""}>${esc(layoutDisplayName(l))}</option>`,
                )
                .join("");
        fillLayoutForm();
        renderLayoutStorage();
        layoutReturnToParameter = !$("parameterView").hidden;
        $("backLayouts").textContent = "Voltar";
        showMainView("layoutDialog");
        loadProjectLayouts();
    };
    $("navLayoutCreate").onclick = () => openLayoutAction("create");
    $("navLayouts").onclick = openLayoutConsultation;
    $("navParamCreate").onclick = () => { setNavigation("navParamCreate"); openProjectCreate(); };
    $("layoutListSearch").oninput = () => { listPagination.layouts.page = 1; renderLayoutList(); };
    bindListPagination();
    $("backLayouts").onclick = closeLayoutEditor;
    $("backLayoutsBottom").onclick = closeLayoutEditor;
    $("backProjectsBottom").onclick = showProjects;
    $("saveProjectBottom").onclick = () => $("saveProject").onclick();
    $("layoutList").onclick = (event) => {
        const view = event.target.closest("[data-view-layout]");
        if (view) { openLayoutAction("view", view.dataset.viewLayout); return; }
        const edit = event.target.closest("[data-edit-layout]");
        if (edit) { openLayoutAction("edit", edit.dataset.editLayout); return; }
        const remove = event.target.closest("[data-delete-layout]");
        if (remove) requestLayoutDelete(remove.dataset.deleteLayout);
    };
    $("layoutEditSelect").onchange = fillLayoutForm;
    $("layoutFields").oninput = () => { previewLayout(); updateUnsavedBanner(); };
    for (const id of ["layoutCode", "layoutName"]) $(id).oninput = updateUnsavedBanner;
    $("layoutUpload").onchange = async (event) => {
        let file = event.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            $("layoutError").textContent = "O limite é de 10 MB.";
            return;
        }
        try {
            if (file.name.toLowerCase().endsWith(".json")) {
                let record = parseLayoutRecord(JSON.parse(await file.text()));
                layoutDraftRecord = record;
                $("layoutEditSelect").value = layouts.some(
                    (l) => l.id === record.id,
                )
                    ? record.id
                    : "";
                $("layoutName").value = record.name;
                $("layoutCode").value = record.code;
                $("layoutFields").value = layoutText(record.fields);
                $("layoutSheetLabel").hidden = true;
                previewLayout();
                renderLayoutStorage();
                return;
            }
            layoutDraftRecord = null;
            layoutWorkbook = XLSX.read(await file.arrayBuffer(), {
                type: "array",
                cellFormula: false,
            });
            $("layoutSheet").innerHTML = layoutWorkbook.SheetNames.map(
                (n) => `<option>${esc(n)}</option>`,
            ).join("");
            $("layoutSheetLabel").hidden = false;
            $("layoutEditSelect").value = "";
            $("layoutCode").value = "";
            $("layoutName").value = file.name.replace(/\.[^.]+$/, "");
            $("layoutFields").value = "";
            $("layoutPreview").innerHTML = "";
            loadLayoutSheet();
        } catch (e) {
            $("layoutError").textContent =
                "Não foi possível ler o arquivo de layout: " + e.message;
        }
    };
    $("layoutSheet").onchange = loadLayoutSheet;
    $("layoutTemplate").onclick = () => {
        let wb = XLSX.utils.book_new(),
            ws = XLSX.utils.json_to_sheet(demoLayoutFields.map(f => ({campo_produto: f.campo_produto, campo_spec: f.campo_dataprep, tipo: f.tipo})), {
                header: ["campo_produto", "campo_spec", "tipo"],
            });
        ws["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, "Layout");
        XLSX.writeFile(wb, "modelo_layout.xlsx");
    };
    $("saveLayout").onclick = async () => {
        if (layoutViewOnly) return;
        const button = $("saveLayout");
        try {
            let record = makeLayoutDraft();
            button.disabled = true;
            if (projectLayoutApiAvailable)
                record = await writeProjectLayout(record);
            if (layouts.some((l) => l.id === record.id))
                layouts = layouts.map((l) => (l.id === record.id ? record : l));
            else layouts.push(record);
            if (layoutReturnToParameter) selectedLayout = record.id;
            saveLayouts();
            normalizeListRows(data);

            persist();
            renderLayouts();
            render();
            renderLayoutStorage();
            layoutBaseline = layoutDraftKey();
            closeLayoutEditor();
            toast(
                projectLayoutApiAvailable
                    ? "Layout salvo em layouts/ no projeto."
                    : "Layout salvo neste navegador de prévia.",
            );
        } catch (e) {
            $("layoutError").textContent =
                "Não foi possível salvar: " + e.message;
        } finally {
            button.disabled = false;
        }
    };
    $("refreshProjectLayouts").onclick = loadProjectLayouts;
    $("downloadLayoutJson").onclick = () => {
        try {
            const record = makeLayoutDraft(),
                blob = new Blob(
                    [
                        JSON.stringify(layoutRecordPayload(record), null, 2) +
                            "\n",
                    ],
                    { type: "application/json;charset=utf-8" },
                ),
                url = URL.createObjectURL(blob),
                link = document.createElement("a");
            link.href = url;
            link.download = "layout-" + record.id + ".layout.json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast("Cópia JSON preparada para baixar.");
        } catch (e) {
            $("layoutError").textContent = e.message;
        }
    };
    for (const key of locationKeys)
        $(key).oninput = () => {
            integrationLocations[key] = $(key).value;
            persist();
        };
    $("serviceCode").oninput = () => {
        const entered = $("serviceCode").value;
        serviceCode = entered.replace(/[^0-9]/g, "").slice(0, 5);
        $("serviceCode").value = serviceCode;
        $("serviceCodeFeedback").textContent =
            entered !== serviceCode
                ? "Use apenas números, com no máximo 5 dígitos."
                : "";
        persist();
    };
    for (const value of ["LK2", "VP8"])
        $("type" + value).onchange = () => {
            parameterType = value;
            suggestDestinationDatabase();
            persist();
            render();
        };
    $("search").oninput = () => {
        tableState.page = 1;
        render();
    };
    $("filter").onchange = () => {
        tableState.page = 1;
        render();
    };
    $("rows").onclick = (event) => {
        if (event.target.closest("[data-exclude], [data-pilot]")) return;
        const row = event.target.closest("tr[data-tt]");
        if (row) editTt(row.dataset.tt);
    };
    $("rows").onkeydown = (event) => {
        if (event.key === "Enter" && event.target.matches("tr[data-tt]")) {
            event.preventDefault();
            event.target.click();
        }
    };
    $("paramHeader").onclick = (event) => {
        const button = event.target.closest("[data-sort]");
        if (!button) return;
        const key = button.dataset.sort;
        tableState.direction =
            tableState.sortKey === key && tableState.direction === "asc"
                ? "desc"
                : "asc";
        tableState.sortKey = key;
        tableState.page = 1;
        render();
    };
    $("pageSize").onchange = () => {
        const size = Number($("pageSize").value);
        if ([10, 50, 100].includes(size)) {
            tableState.pageSize = size;
            tableState.page = 1;
            render();
        }
    };
    $("firstPage").onclick = () => {
        tableState.page = 1;
        render();
    };
    $("previousPage").onclick = () => {
        tableState.page--;
        render();
    };
    $("nextPage").onclick = () => {
        tableState.page++;
        render();
    };
    $("lastPage").onclick = () => {
        tableState.page = Math.max(
            1,
            Math.ceil(visibleTts().length / tableState.pageSize),
        );
        render();
    };
    $("ttSharedFields").oninput = normalizeTtInput;
    $("ttSharedFields").onclick = handleFieldPickerClick;
    $("ttConditions").oninput = normalizeTtInput;
    $("ttConditions").onchange = (event) => {
        if (event.target.dataset.fieldSearch) return;
        const rows = captureTtDraft();
        for (let i = 0; i < rows.length; i++)
            for (const k of ["campo", "operador", "valor"]) {
                $("tt_" + k + "_" + ttDraft.conditions[i].id).value =
                    rows[i][k];
                ttDraft.conditions[i][k] = rows[i][k];
            }
        updateFieldPickerLabels();
        ttFeedback();
    };
    $("addTtCondition").onclick = () => {
        captureTtDraft();
        ttDraft.conditions.push({
            id: newRecordId(),
            campo: "",
            operador: "=",
            valor: "",
        });
        renderTtConditions();
        ttFeedback();
        openFieldPicker(ttDraft.conditions.at(-1).id);
    };
    $("ttConditions").onclick = (event) => {
        if (handleFieldPickerClick(event)) return;
        const button = event.target.closest("[data-remove-condition]");
        if (!button) return;
        captureTtDraft();
        ttDraft.conditions = ttDraft.conditions.filter(
            (c) => c.id !== button.dataset.removeCondition,
        );
        renderTtConditions();
        ttFeedback();
    };
    $("saveTt").onclick = () => {
        if (ttDraft.importError) {
            ttFeedback();
            return;
        }
        const rows = captureTtDraft();
        if (!rows.length) {
            ttFeedback();
            return;
        }
        if (rows.some((r) => missing(r).length)) {
            ttFeedback();
            $("sqlFeedback").textContent =
                "Preencha os dados compartilhados e todos os campos de cada condição antes de salvar.";
            return;
        }
        if (
            data.some(
                (r) =>
                    String(r.transtype ?? "") !== ttDraft.originalTt &&
                    r.transtype === rows[0].transtype,
            )
        ) {
            ttFeedback();
            return;
        }
        if (rows.some((r) => check(r, rows))) {
            ttFeedback();
            $("sqlFeedback").textContent =
                "Corrija as inconsistências antes de salvar o Transtype.";
            return;
        }
        if (pilotTranstypes.delete(ttDraft.originalTt))
            pilotTranstypes.add(rows[0].transtype);
        if (excludedTranstypes.delete(ttDraft.originalTt))
            excludedTranstypes.add(rows[0].transtype);

        data = replaceTtRows(data, ttDraft.originalTt, rows);
        persist();
        render();
        $("editor").close();
        toast("Transtype atualizado. Clique em Salvar na parametrização para gravar.");
        ttDraft = null;
    };
    $("cancelTt").onclick = () => {
        $("editor").close();
        ttDraft = null;
    };
    $("importBtn").onclick = openImport;
    $("navHome").onclick = () => showParameterList("consult");
    $("export").onclick = generateParameterization;
    $("upload").onchange = async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        $("mapping").hidden = true;
        $("importError").textContent = "";
        if (file.size > 10 * 1024 * 1024) {
            $("importError").textContent = "O limite é de 10 MB.";
            return;
        }
        try {
            workbook = XLSX.read(await file.arrayBuffer(), {
                type: "array",
                cellFormula: false,
            });
            $("sheet").innerHTML = workbook.SheetNames.map(
                (n) => `<option>${esc(n)}</option>`,
            ).join("");
            $("mapping").hidden = false;
            readSheet();
        } catch (err) {
            $("importError").textContent =
                "Não foi possível ler a planilha. Verifique o arquivo.";
        }
    };
    $("headerRow").onchange = () => {
        if (workbook) readSheet();
    };
    $("sheet").onchange = readSheet;
    const downloadRuleTemplate = () => {
        const compact = [
                {
                    ...base,
                    regra_sql:
                        "data = DATE '2026-01-01'\nAND tipo_evento = '150'",
                },
            ],
            wb = XLSX.utils.book_new(),
            ws = XLSX.utils.json_to_sheet(compact, {
                header: [...meta, "regra_sql"],
            });
        ws["!cols"] = [...meta.map(() => ({ wch: 24 })), { wch: 65 }];
        ws["!rows"] = [{ hpt: 22 }, { hpt: 65 }];
        XLSX.utils.book_append_sheet(wb, ws, "Transtype_Regra");
        XLSX.writeFile(wb, "modelo_transtype_regra.xlsx");
    };
    $("confirmImport").onclick = () => {
        let fields = importKeys(),
            indices = fields.map((k, i) => $("map_" + i).value);
        if (
            indices.some((v) => v === "") ||
            new Set(indices).size !== fields.length
        ) {
            $("importError").textContent =
                `Associe as ${fields.length} colunas a campos diferentes.`;
            return;
        }
        if (raw.length < headerIndex() + 2) {
            $("importError").textContent = "A aba não contém dados.";
            return;
        }
        let imported = raw
            .slice(headerIndex() + 1)
            .filter((a) => a.some((v) => String(v).trim()))
            .map((a) =>
                Object.fromEntries(
                    fields.map((k, i) => [
                        k,
                        String(a[+indices[i]] ?? "").trim(),
                    ]),
                ),
            );
        let candidate;
        try {
            candidate = expandSqlRows(imported);
        } catch (e) {
            $("importError").textContent =
                e.message + " Nenhum dado foi importado.";
            return;
        }
        normalizeListRows(candidate);

        data = candidate;
        pilotTranstypes = new Set(
            [...pilotTranstypes].filter((tt) =>
                data.some((r) => r.transtype === tt),
            ),
        );
        excludedTranstypes = new Set(
            [...excludedTranstypes].filter((tt) =>
                data.some((r) => r.transtype === tt),
            ),
        );
        $("fileName").textContent =
            $("upload").files[0].name + " • aba " + $("sheet").value;
        persist();
        render();
        $("importDialog").close();
        const invalid = candidate.filter((row) => row._sqlImportError).length;
        toast(
            `${imported.length} linha(s) carregada(s). ${invalid ? invalid + " regra(s) com erro: revise os registros Com alerta." : "Regras importadas."}`,
        );
    };
    $("closeProjectDialog").onclick = () => $("projectDialog").close();
    $("projectForm").onsubmit = (event) => {
        event.preventDefault();
        const name = $("projectName").value.trim(), description = "";
        if (!name) return;
        if (projects.some(p => nameKey(p.name) === nameKey(name))) {
            $("projectFormError").textContent = "Já existe uma parametrização com esse nome.";
            return;
        }
        const now = new Date().toISOString(),
            p = {
                id: newRecordId(),
                name,
                description,
                rows: [],
                parameterType: "",
                serviceCode: "",
                layoutId: "",
                excluded: [],
                fileName: "Nenhuma planilha importada",
                createdAt: now,
                updatedAt: now,
            };
        projects.push(p);
        try {
            saveProjectStore();
        } catch (error) {
            projects = projects.filter(project => project !== p);
            $("projectFormError").textContent = "Não foi possível salvar: " + error.message;
            return;
        }
        $("projectDialog").close();
        openProject(p.id);
        toast("Projeto criado.");
    };
    $("projectSearch").oninput = () => { listPagination.projects.page = 1; renderProjects(); };
    $("projectList").onclick = (event) => {
        const view = event.target.closest("[data-view-project]");
        if (view) { openProject(view.dataset.viewProject, true); return; }
        const remove = event.target.closest("[data-delete-project]");
        if (remove) {
            openDeleteProject(remove.dataset.deleteProject);
            return;
        }
        const button = event.target.closest("[data-open-project]");
        if (button) openProject(button.dataset.openProject);
    };
    $("backProjects").onclick = showProjects;
    $("projectLayouts").onclick = () => $("manageLayouts").click();
    $("rows").onchange = (event) => {
        const checkbox = event.target.closest("[data-exclude], [data-pilot]");
        if (!checkbox) return;
        const pilot = checkbox.hasAttribute("data-pilot"),
            marks = pilot ? pilotTranstypes : excludedTranstypes,
            code = pilot ? checkbox.dataset.pilot : checkbox.dataset.exclude;
        checkbox.checked ? marks.add(code) : marks.delete(code);
        persist();
        render();
    };
    $("ttSharedFields").onchange = (event) => {
        const mode = event.target.closest("[data-value-mode]");
        if (mode) {
            captureTtDraft();
            const k = mode.dataset.valueMode;
            ttDraft.valueModes = ttDraft.valueModes || {};
            ttDraft.valueModes[k] = mode.value;
            ttDraft.shared[k] =
                mode.value === "field" ? "__SELECIONAR_CAMPO__" : "";
            renderSharedFields();
            if (mode.value === "field") {
                const i = meta.indexOf(k);
                $("tt_shared_" + i).value = "";
                ttDraft.shared[k] = "";
                $("tt_field_button_shared-" + i).querySelector(
                    ".field-picker-value",
                ).textContent = "Selecione um campo";
            }
            ttFeedback();
            return;
        }
        ttFeedback();
    };
    $("deleteLayout").onclick = () => {
        const id = $("layoutEditSelect").value,
            record = layouts.find((l) => l.id === id);
        if (!record) {
            $("layoutError").textContent =
                "Selecione um layout cadastrado para excluir.";
            return;
        }
        saveCurrentProject();
        const links = layoutLinks(id);
        if (links.length) {
            $("layoutError").textContent =
                "Layout utilizado nos projetos: " +
                links.join(", ") +
                ". Selecione outro layout nesses projetos antes de excluir.";
            return;
        }
        deletingLayoutId = id;
        $("deleteLayoutConfirmation").value = "";
        $("deleteLayoutError").textContent = "";
        $("confirmDeleteLayout").disabled = true;
        $("deleteLayoutMessage").textContent =
            'O layout "' +
            record.name +
            '" será excluído. Esta ação não pode ser desfeita.';
        $("deleteLayoutDialog").showModal();
    };
    $("deleteLayoutConfirmation").oninput = () => {
        $("confirmDeleteLayout").disabled =
            !isDeleteConfirmation($("deleteLayoutConfirmation").value);
    };
    $("cancelDeleteLayout").onclick = () => $("deleteLayoutDialog").close();
    $("deleteLayoutForm").onsubmit = async (event) => {
        event.preventDefault();
        if (!isDeleteConfirmation($("deleteLayoutConfirmation").value)) return;
        const id = deletingLayoutId;
        if (layoutLinks(id).length) {
            $("deleteLayoutError").textContent =
                "O layout está vinculado a parametrizações.";
            return;
        }
        const button = $("confirmDeleteLayout");
        button.disabled = true;
        try {
            if (projectLayoutIds.has(id)) {
                await layoutApiRepository.delete(id);
                projectLayoutIds.delete(id);
            }
            layouts = layouts.filter((l) => l.id !== id);
            for (const p of projects) if (p.layoutId === id) p.layoutId = "";
            if (selectedLayout === id) selectedLayout = "";
            saveLayouts();
            persist();
            $("layoutEditSelect").value = "";
            layoutDraftRecord = null;
            refreshLayoutOptions();
            fillLayoutForm();
            render();
            $("deleteLayoutDialog").close();
            renderLayoutList();
            toast("Layout excluído.");
        } catch (e) {
            $("deleteLayoutError").textContent = e.message;
        } finally {
            button.disabled = !isDeleteConfirmation($("deleteLayoutConfirmation").value);
        }
    };
    $("pilotAll").onclick = () => setAllMarkings("pilot", true);
    $("pilotNone").onclick = () => setAllMarkings("pilot", false);
    $("excludeAll").onclick = () => setAllMarkings("excluded", true);
    $("excludeNone").onclick = () => setAllMarkings("excluded", false);
    $("deleteProjectConfirmation").oninput = () => {
        $("confirmDeleteProject").disabled =
            !isDeleteConfirmation($("deleteProjectConfirmation").value);
    };
    $("cancelDeleteProject").onclick = () => $("deleteProjectDialog").close();
    $("deleteProjectForm").onsubmit = (event) => {
        event.preventDefault();
        try {
            removeProject(
                deletingProjectId,
                $("deleteProjectConfirmation").value,
            );
            $("deleteProjectDialog").close();
            deletingProjectId = null;
            toast("Projeto excluído. Os layouts foram mantidos.");
        } catch (error) {
            $("deleteProjectError").textContent = error.message;
        }
    };
}

/** Raw source is only replaced after explicit successful syntax validation. */
function revalidateImportedRule() {
    if (!ttDraft) return;
    try {
        const parsed = parseSqlCell($("rawSqlInput").value);
        captureTtDraft();
        ttDraft.conditions = parsed.map((condition) => ({
            ...condition,
            id: newRecordId(),
        }));
        ttDraft.importError = "";
        ttDraft.revalidated = true;
        $("rawSqlError").textContent =
            "Sintaxe revalidada. Confira os campos e valores antes de salvar.";
        renderTtConditions();
        ttFeedback();
    } catch (error) {
        ttDraft.importError = error.message;
        ttDraft.revalidated = false;
        $("rawSqlError").classList.remove("success");
        $("rawSqlError").textContent = error.message;
        ttFeedback();
    }
}
