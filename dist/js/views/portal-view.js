/** views/portal-view.js — focused functions used by the application controller. */
function renderIntegrationLocations() {
    suggestDestinationDatabase();
    $("parameterSquad").value = parameterDetails.squad;
    $("parameterKnowledgeBase").value = parameterDetails.knowledgeBase;
    for (const key of locationKeys) $(key).value = integrationLocations[key];
    $("destinationDatabaseHint").textContent = parameterType
        ? "Destino " +
          parameterType +
          ": database padrão configurado. Você pode editar este campo quando necessário."
        : "Selecione LK2 ou VP8 para sugerir o database de destino. Todos os campos são editáveis.";
}

function renderLayouts() {
    $("layoutSelect").innerHTML =
        '<option value="">Selecione um layout</option>' +
        layouts
            .map(
                (l) =>
                    `<option value="${esc(l.id)}" ${l.id === selectedLayout ? "selected" : ""}>${esc(layoutDisplayName(l))}</option>`,
            )
            .join("");
}

function previewLayout() {
    try {
        const fields = parseLayoutText($("layoutFields").value);
        $("layoutPreview").innerHTML = fields
            .map(
                (f) =>
                    `<tr><td>${esc(f.campo_produto)}</td><td>${esc(f.campo_dataprep)}</td><td><span class="badge">${esc(f.tipo)}</span></td></tr>`,
            )
            .join("");
        $("layoutError").textContent = "";
        return fields;
    } catch (e) {
        $("layoutPreview").innerHTML = "";
        $("layoutError").textContent = e.message;
        return null;
    }
}

function fillLayoutForm() {
    layoutDraftRecord = null;
    let l = layouts.find((x) => x.id === $("layoutEditSelect").value);
    $("layoutName").value = l?.name || "";
    $("layoutCode").value = l?.code || "";
    $("layoutFields").value = layoutText(l?.fields || []);
    $("layoutSheetLabel").hidden = true;
    $("layoutUpload").value = "";
    previewLayout();
    renderLayoutStorage();
    layoutBaseline = layoutDraftKey();
    updateUnsavedBanner();
}

function renderLayoutStorage() {
    const current =
        layouts.find((l) => l.id === $("layoutEditSelect").value) ||
        layoutDraftRecord;
    $("layoutDates").textContent = current
        ? "Cadastro: " +
          formatLayoutDate(current.createdAt) +
          " • Última alteração: " +
          formatLayoutDate(current.updatedAt)
        : "A data de cadastro será registrada ao salvar um novo layout.";
    $("layoutFolderStatus").textContent = projectLayoutApiAvailable
        ? "Armazenamento ativo: pasta layouts/ do projeto. Nenhuma seleção de pasta é necessária."
        : "Modo de prévia: layouts salvos apenas neste navegador. Para gravar os JSONs em layouts/ do projeto, execute python server.py no código-fonte e acesse http://localhost:8080.";
    $("refreshProjectLayouts").disabled = projectLayoutLoading;
    $("saveLayout").textContent = "Salvar";
    $("layoutInventory").innerHTML =
        layouts
            .map(
                (l) =>
                    `<tr><td>${esc(l.name)}</td><td>${esc(l.code || "Não informado")}</td><td>${esc(formatLayoutDate(l.createdAt))}</td><td>${esc(formatLayoutDate(l.updatedAt))}</td><td>${projectLayoutIds.has(l.id) ? "Projeto · layouts/" : "Navegador"}</td></tr>`,
            )
            .join("") ||
        '<tr><td colspan="5">Nenhum layout cadastrado.</td></tr>';
}

function toast(s) {
    $("toast").textContent = s;
    $("toast").style.display = "block";
    setTimeout(() => ($("toast").style.display = "none"), 3500);
}

function displayCell(r, k) {
    const value = esc(presentationValue(r[k], k));
    if (!["EMPRESA", "DEPARTAMENTO DEBITO", "DEPARTAMENTO CREDITO"].includes(k))
        return value;
    const fixed =
        k === "EMPRESA" ? /^\d{3}[./]\d{3}$/.test(r[k]) : /^\d{5}$/.test(r[k]);
    const malformed =
        k === "EMPRESA" ? /^[\d./]+$/.test(r[k]) : /^\d+$/.test(r[k]);
    const type = fixed ? "fixed" : malformed ? "invalid" : "reference";
    const label = fixed
        ? "Fixo"
        : malformed
          ? "Formato inválido"
          : "Campo do layout";
    return `<span class="typed-value">${value}<span class="value-type ${type}">${label}</span></span>`;
}

function sortValue(record, key) {
    if (key === "pilot") return pilotTranstypes.has(record.tt) ? "1" : "0";
    if (key === "excluded")
        return excludedTranstypes.has(record.tt) ? "1" : "0";
    if (key === "regra_sql") return record.sql;
    if (key === "review")
        return record.errors.length ? "Com alerta" : "Sem alertas";
    if (key === "validation")
        return record.errors.join(" | ") || "Todos os campos preenchidos.";
    return attributeDisplayValue(record.base[key], key);
}

function orderTts(records) {
    return records
        .map((record, index) => ({ record, index }))
        .sort((a, b) => {
            const comparison = tableCollator.compare(
                sortValue(a.record, tableState.sortKey),
                sortValue(b.record, tableState.sortKey),
            );
            return comparison
                ? tableState.direction === "asc"
                    ? comparison
                    : -comparison
                : a.index - b.index;
        })
        .map((item) => item.record);
}

function paginateTts(records) {
    const pages = Math.max(1, Math.ceil(records.length / tableState.pageSize));
    tableState.page = Math.max(1, Math.min(tableState.page, pages));
    const start = (tableState.page - 1) * tableState.pageSize;
    return {
        rows: records.slice(start, start + tableState.pageSize),
        pages,
        start,
        end: Math.min(start + tableState.pageSize, records.length),
    };
}

function ttRecords() {
    const groups = new Map();
    for (const r of data) {
        const tt = String(r.transtype ?? "");
        if (!groups.has(tt)) groups.set(tt, []);
        groups.get(tt).push(r);
    }
    return [...groups].map(([tt, rows]) => {
        const errors = [
            ...new Set(rows.map((r) => check(r, rows)).filter(Boolean)),
        ];
        return { tt, rows, base: rows[0], errors, sql: sqlFor(rows) };
    });
}

function visibleTts(records = ttRecords()) {
    const query = $("search").value.toLowerCase(),
        filter = $("filter").value;
    return orderTts(
        records.filter(
            (record) =>
                (record.rows.some((r) =>
                    Object.values(r).join(" ").toLowerCase().includes(query),
                ) ||
                    record.sql.toLowerCase().includes(query) ||
                    ["ATRIBUTO_DATA", "ATRIBUTO_VALOR"].some((k) =>
                        attributeDisplayValue(record.base[k], k)
                            .toLowerCase()
                            .includes(query),
                    )) &&
                (filter === "all" ||
                    (filter === "excluded"
                        ? excludedTranstypes.has(record.tt)
                        : filter === "pilot"
                          ? pilotTranstypes.has(record.tt)
                          : filter === "error"
                            ? record.errors.length
                            : !record.errors.length)),
        ),
    );
}

function ttTableRow(record) {
    const { tt, rows, base, errors, sql } = record,
        conflicts = meta.filter((k) => rows.some((r) => r[k] !== base[k]));
    return `<tr tabindex="${projectReadOnly ? "-1" : "0"}" data-tt="${esc(tt)}" aria-label="${projectReadOnly ? "Transtype" : "Editar Transtype"} ${esc(tt || "sem código")}">${ttColumns
        .map((k) => {
            if (k === "regra_sql")
                return `<td class="tt-sql-cell"><pre>${esc(sql)}</pre>${rows.some((row) => row._sqlImportError) ? '<small class="raw-sql-warning">Regra original com erro • abra para corrigir</small>' : ""}</td>`;
            const empty = !String(base[k] ?? "").trim(),
                problem = rows.map((r) => fieldErrors(r)[k]).find(Boolean);
            return `<td class="${empty || problem ? "cell-missing" : conflicts.includes(k) ? "cell-conflict" : ""}" title="${esc(problem || (conflicts.includes(k) ? "Valores divergentes entre as condições do Transtype." : ""))}">${empty ? '<span class="missing-label">⚠ Obrigatório</span>' : k === "transtype" ? `<strong>${esc(tt)}</strong><small class="tt-count-note">${rows.length} ${rows.length === 1 ? "condição" : "condições"}</small>` : displayCell(base, k)}</td>`;
        })
        .join(
            "",
        )}<td><span class="badge ${errors.length ? "error" : ""}">${errors.length ? "◌ Com alerta" : "● Sem alertas"}</span></td><td class="validation-detail">${esc(errors.join(" | ") || "Todos os campos preenchidos.")}</td><td class="exclude-cell"><input type="checkbox" data-exclude="${esc(tt)}" aria-label="Marcar ${esc(tt)} para exclusão" ${excludedTranstypes.has(tt) ? "checked" : ""}></td><td class="exclude-cell pilot-cell"><input type="checkbox" data-pilot="${esc(tt)}" aria-label="Marcar ${esc(tt)} para piloto" ${pilotTranstypes.has(tt) ? "checked" : ""}></td><td>${projectReadOnly ? "" : "↗"}</td></tr>`;
}

function render() {
    renderIntegrationLocations();
    $("serviceCode").value = serviceCode;
    $("typeLK2").checked = parameterType === "LK2";
    $("typeVP8").checked = parameterType === "VP8";
    $("parameterTypeInfo").textContent = parameterType
        ? "Tipo selecionado: " +
          parameterType +
          " • aplica-se a todo o conjunto atual."
        : "Selecione LK2 ou VP8 antes de importar e revisar a prévia SQL.";
    const records = ttRecords();
    renderBulkMarkings(records);
    const ok = records.filter((record) => !record.errors.length).length;
    $("valid").textContent = ok;
    $("invalid").textContent = records.length - ok;
    $("systems").textContent = records.length;
    $("count").textContent = records.length;
    const visible = visibleTts(records);
    $("export").disabled = !visible.length;
    const pagination = paginateTts(visible);
    $("rows").innerHTML =
        pagination.rows.map(ttTableRow).join("") ||
        '<tr><td colspan="15">Nenhum Transtype encontrado.</td></tr>';
    $("shown").textContent = visible.length
        ? `Exibindo ${pagination.start + 1}–${pagination.end} de ${visible.length} Transtypes${visible.length !== records.length ? " (total: " + records.length + ")" : ""}`
        : "Nenhum Transtype encontrado";
    $("pageSize").value = String(tableState.pageSize);
    $("pageInfo").textContent =
        "Página " + tableState.page + " de " + pagination.pages;
    $("firstPage").disabled = $("previousPage").disabled =
        tableState.page === 1;
    $("nextPage").disabled = $("lastPage").disabled =
        tableState.page === pagination.pages;
    for (const button of $("paramHeader").querySelectorAll("[data-sort]")) {
        const active = button.dataset.sort === tableState.sortKey;
        button
            .closest("th")
            .setAttribute(
                "aria-sort",
                active
                    ? tableState.direction === "asc"
                        ? "ascending"
                        : "descending"
                    : "none",
            );
        button.querySelector(".sort-indicator").textContent = active
            ? tableState.direction === "asc"
                ? "↑"
                : "↓"
            : "↕";
    }
    applyProjectMode();
}

function fieldPickerHtml(id, control, value, label, searchLabel, attributes) {
    return `<div class="condition-field-picker"><select hidden id="${control}" ${attributes} required>${conditionFieldOptions(value)}</select><button type="button" class="field-picker-button" role="combobox" aria-label="${esc(label)}" aria-haspopup="listbox" aria-controls="tt_field_options_${id}" aria-expanded="false" data-open-picker="${id}" id="tt_field_button_${id}"><span class="field-picker-value">${esc(fieldPickerLabel(value))}</span><span aria-hidden="true">⌄</span></button><div class="field-picker-popup" id="tt_field_popup_${id}" hidden><div class="field-source-tabs" role="group" aria-label="Layout dos campos">${["Produto", "Spec"].map((source) => `<button type="button" data-field-source="${source}" data-picker-id="${id}" aria-pressed="false">${source}</button>`).join("")}</div><input type="search" id="tt_field_search_${id}" data-field-search="${id}" aria-label="${esc(searchLabel)}" placeholder="Pesquisar campo…" autocomplete="off"><div role="listbox" aria-label="Campos do layout: ${esc(label)}" class="field-picker-options" id="tt_field_options_${id}"></div><small id="tt_search_status_${id}" class="field-search-status" role="status"></small></div></div>`;
}

function fieldPickerLabel(value, source) {
    if (!value) return "Selecione um campo";
    const field = resolveField(value);
    if (!field) return "⚠ Não localizado: " + fieldName(value);
    const origin =
        source &&
        selectableFields().some(
            (f) =>
                fieldKey(f.name) === fieldKey(value) &&
                f.origin.includes(source),
        )
            ? source
            : fieldKey(field.campo_produto) === fieldKey(value)
              ? "Produto"
              : "Spec";
    return fieldName(value) + " · " + origin + " · " + field.tipo;
}

function renderTtConditions() {
    closeFieldPicker();
    $("ttConditions").innerHTML = ttDraft.conditions
        .map(
            (condition, index) =>
                `<tr data-condition-id="${condition.id}"><td>${fieldPickerHtml(condition.id, "tt_campo_" + condition.id, condition.campo, "Campo da condição " + (index + 1), "Pesquisar campo da condição " + (index + 1), 'data-condition-field="campo" data-condition-id="' + condition.id + '"')}</td><td><select data-condition-field="operador" data-condition-id="${condition.id}" id="tt_operador_${condition.id}" aria-label="Operador da condição ${index + 1}">${!ops.includes(normalizedOp(condition.operador)) ? `<option value="${esc(condition.operador)}">${esc(condition.operador)} (não aceito)</option>` : ""}${ops.map((op) => `<option ${op === normalizedOp(condition.operador) ? "selected" : ""}>${esc(op)}</option>`).join("")}</select></td><td><input data-condition-field="valor" data-condition-id="${condition.id}" id="tt_valor_${condition.id}" aria-label="Valor da condição ${index + 1}" value="${esc(condition.valor)}" required></td><td class="tt-condition-validation" id="tt_error_${condition.id}"></td><td><button type="button" class="tt-remove-condition" data-remove-condition="${condition.id}" aria-label="Remover condição ${index + 1}">×</button></td></tr>`,
        )
        .join("");
    $("ttConditionCount").textContent = ttDraft.conditions.length;
}

function ttFeedback() {
    if (!ttDraft) return;
    $("saveTt").disabled = !!ttDraft.importError;
    if (ttDraft.importError) {
        $("sql").value = $("rawSqlInput").value;
        $("sqlFeedback").textContent = ttDraft.importError;
        return;
    }
    const rows = captureTtDraft(),
        collision = data.some(
            (r) =>
                r.transtype !== ttDraft.originalTt &&
                r.transtype === ttDraft.shared.transtype,
        );
    const sharedErrors = rows.length ? fieldErrors(rows[0]) : {};
    for (const [i, k] of meta.entries()) {
        $("tt_shared_" + i).setAttribute(
            "aria-invalid",
            sharedErrors[k] ? "true" : "false",
        );
        $("tt_shared_error_" + i).textContent = sharedErrors[k] || "";
        if ($("tt_field_button_shared-" + i))
            $("tt_field_button_shared-" + i).setAttribute(
                "aria-invalid",
                sharedErrors[k] ? "true" : "false",
            );
    }
    for (let i = 0; i < rows.length; i++) {
        const error = check(rows[i], rows);
        $("tt_error_" + ttDraft.conditions[i].id).textContent =
            error || "Sem alertas";
        $("tt_field_button_" + ttDraft.conditions[i].id).setAttribute(
            "aria-invalid",
            fieldErrors(rows[i]).campo ? "true" : "false",
        );
        for (const k of ["campo", "valor"])
            $("tt_" + k + "_" + ttDraft.conditions[i].id).setAttribute(
                "aria-invalid",
                fieldErrors(rows[i])[k] ? "true" : "false",
            );
    }
    if (collision) {
        if (ttDraft.revalidated) {
            $("rawSqlError").classList.remove("success");
            $("rawSqlError").textContent = "Corrija a duplicidade do Transtype antes de salvar.";
        }
        $("sql").value = "-- Já existe um Transtype com esse nome.";
        $("sqlFeedback").textContent =
            "Já existe um Transtype com esse nome. Use outro código.";
        return;
    }
    if (!rows.length) {
        if (ttDraft.revalidated) {
            $("rawSqlError").classList.remove("success");
            $("rawSqlError").textContent = "Adicione uma condição antes de salvar.";
        }
        $("sql").value = "-- Adicione pelo menos uma condição.";
        $("sqlFeedback").textContent = "Adicione pelo menos uma condição.";
        return;
    }
    const preview = rows.map((r) => ({ ...r }));
    $("sql").value = sqlFor(preview);
    const errors = rows.filter((r) => check(r, rows)).length;
    if (ttDraft.revalidated) {
        $("rawSqlError").classList.toggle("success", !errors);
        $("rawSqlError").textContent = errors
            ? "Sintaxe revalidada, mas há campos ou valores para corrigir."
            : "Regra revalidada com sucesso. Salve o Transtype para aplicar.";
    }
    $("sqlFeedback").textContent = errors
        ? errors + " condição(ões) com alertas para revisar."
        : rows.length + " condição(ões) neste Transtype.";
}

function renderMapping() {
    let headers = raw[headerIndex()] || [],
        fields = importKeys();
    $("mapFields").innerHTML = fields
        .map((k, i) => {
            let match = headers.findIndex(
                (h) =>
                    norm(h) === norm(k) ||
                    (k === "regra_sql" &&
                        ["regra", "regrasql", "regras", "sql"].includes(
                            norm(h),
                        )),
            );
            return `<label>${esc(k)}<select id="map_${i}"><option value="">Selecione a coluna</option>${headers.map((h, j) => `<option value="${j}" ${j === match ? "selected" : ""}>${esc(h || "Coluna " + (j + 1))}</option>`).join("")}</select></label>`;
        })
        .join("");
    $("importModeInfo").textContent =
        "SQL em uma célula: AND/E (sem diferenciar maiúsculas); espaços ou quebras de linha entre condições completas viram AND. Operadores: IN, NOT IN, >, >=, <, <=, = e <>. Informe listas sem parênteses: 150, 151 ou 'A', 'B'. Funções e agrupamentos lógicos não são aceitos.";
    $("importError").textContent = "";
    $("importSummary").textContent =
        `${Math.max(raw.length - headerIndex() - 1, 0)} linhas identificadas. A importação substituirá o conjunto atual. Códigos devem estar como Texto no Excel para preservar zeros à esquerda.`;
}

function renderProjects() {
    $("parameterListTitle").textContent = "Consultar parametrizações";
    const query = normalizedText($("projectSearch").value);
    $("projectList").innerHTML =
        paginateList(sortConsultation(projects.filter(p => (normalizedText(p.name + " " + p.description).includes(query) || (p.rows || []).some(r => normalizedText(r.transtype).includes(query)))), "projects"), "projects")
            .map(
                (p) =>
                    `<article class="project-card"><div><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><small>${new Set(p.rows.map((r) => r.transtype)).size} Transtypes · Cadastro: ${esc(formatLayoutDate(p.createdAt))} · Atualização: ${esc(formatLayoutDate(p.updatedAt))}</small></div><div class="project-card-actions"><button class="secondary" data-view-project="${esc(p.id)}">Exibir</button><button class="secondary" data-open-project="${esc(p.id)}">Alterar</button><button class="link danger" data-delete-project="${esc(p.id)}" aria-label="Excluir parametrização ${esc(p.name)}">Excluir</button></div></article>`,
            )
            .join("") ||
        '<div class="project-empty">' +
            (projects.length
                ? "Nenhum projeto encontrado."
                : "Nenhuma parametrização cadastrada. Use Parametrização > Cadastrar.") +
            "</div>";
}

function renderSharedFields() {
    closeFieldPicker();
    $("ttSharedFields").innerHTML = [
        "transtype",
        "DESCRICAO_TRANSTYPE",
        "ATRIBUTO_DATA",
        "ATRIBUTO_VALOR",
        "EMPRESA",
        "DEPARTAMENTO DEBITO",
        "DEPARTAMENTO CREDITO",
        "CONTA DEBITO",
        "CONTA CREDITO",
    ]
        .map((k) => {
            const i = meta.indexOf(k),
                value = ttDraft.shared[k],
                dynamic = [
                    "EMPRESA",
                    "DEPARTAMENTO DEBITO",
                    "DEPARTAMENTO CREDITO",
                ].includes(k),
                fixed =
                    dynamic &&
                    (ttDraft.valueModes?.[k]
                        ? ttDraft.valueModes[k] === "fixed"
                        : !value || /^[\d./]+$/.test(value)),
                picker =
                    ["ATRIBUTO_DATA", "ATRIBUTO_VALOR"].includes(k) ||
                    (dynamic && !fixed),
                mode = dynamic
                    ? `<div class="value-settings"><select class="value-mode" aria-label="Tipo de ${esc(sharedLabels[k])}" data-value-mode="${esc(k)}"><option value="fixed" ${fixed ? "selected" : ""}>Valor fixo</option><option value="field" ${!fixed ? "selected" : ""}>Campo do layout</option></select></div>`
                    : "";
            return `<div class="tt-shared-picker ${k === "EMPRESA" ? "tt-company-field" : ""}"><span class="shared-field-label">${esc(sharedLabels[k])}</span>${mode}${picker ? fieldPickerHtml("shared-" + i, "tt_shared_" + i, value, sharedLabels[k], "Pesquisar " + sharedLabels[k], 'data-shared="' + k + '"') : `<input id="tt_shared_${i}" data-shared="${esc(k)}" aria-label="${esc(sharedLabels[k])}" required value="${esc(value)}">`}<small class="tt-inline-error" id="tt_shared_error_${i}"></small></div>`;
        })
        .join("");
}

function renderBulkMarkings(records) {
    const codes = records.map((r) => r.tt),
        count = codes.length,
        pilots = codes.filter((code) => pilotTranstypes.has(code)).length,
        excluded = codes.filter((code) => excludedTranstypes.has(code)).length;
    $("pilotAll").disabled = !count || pilots === count;
    $("pilotNone").disabled = !pilots;
    $("excludeAll").disabled = !count || excluded === count;
    $("excludeNone").disabled = !excluded;
    $("bulkMarkingScope").textContent =
        "Todos os " +
        count +
        " Transtypes do projeto, incluindo outras páginas e registros filtrados. Piloto: " +
        pilots +
        " · Exclusão: " +
        excluded +
        ".";
}

function positionFieldPicker() {
    if (!openFieldPickerId) return;
    const button = $("tt_field_button_" + openFieldPickerId),
        popup = $("tt_field_popup_" + openFieldPickerId);
    if (!button || !popup) return;
    const rect = button.getBoundingClientRect(),
        height = Math.min(320, window.innerHeight - 24),
        width = Math.min(Math.max(rect.width, 290), window.innerWidth - 24),
        below = window.innerHeight - rect.bottom;
    popup.style.width = width + "px";
    popup.style.maxHeight = height + "px";
    popup.style.left =
        Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) +
        "px";
    popup.style.top =
        Math.max(
            12,
            Math.min(
                below < height ? rect.top - height : rect.bottom + 4,
                window.innerHeight - height - 12,
            ),
        ) + "px";
}
