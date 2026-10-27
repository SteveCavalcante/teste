/** services/layout-service.js — focused functions used by the application controller. */
function layoutType(value) {
    const t = fieldKey(value).replace(/\s*\(.*\)$/, "");
    const aliases = {
        TEXT: "STRING",
        VARCHAR: "STRING",
        CHAR: "STRING",
        NVARCHAR: "STRING",
        INTEGER: "INT",
        BIGINT: "INT",
        SMALLINT: "INT",
        TINYINT: "INT",
        NUMERIC: "DECIMAL",
        NUMBER: "DECIMAL",
        FLOAT: "DECIMAL",
        DOUBLE: "DECIMAL",
        TIMESTAMP: "DATETIME",
    };
    return aliases[t] || t;
}

function activeLayout() {
    return layouts.find((l) => l.id === selectedLayout);
}

function resolveField(name) {
    const fields = activeLayout()?.fields || [],
        value = fieldKey(name);
    if (!value) return undefined;
    return (
        fields.find((f) => fieldKey(f.campo_produto) === value) ||
        fields.find((f) => fieldKey(f.campo_dataprep) === value)
    );
}

function selectableFields() {
    const items = new Map();
    for (const f of activeLayout()?.fields || [])
        for (const [name, origin] of [
            [f.campo_produto, "Produto"],
            [f.campo_dataprep, "DataPrep"],
        ]) {
            if (!name) continue;
            if (items.has(name)) items.get(name).origin = "Produto · DataPrep";
            else items.set(name, { name, origin, tipo: f.tipo });
        }
    return [...items.values()];
}

function validateLayoutFields(fields) {
    if (!fields.length) throw Error("Informe pelo menos um campo.");
    const seen = new Set(),
        targets = new Set();
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f.campo_dataprep || !f.tipo)
            throw Error(
                "Linha " +
                    (i + 2) +
                    ": preencha campo_dataprep e tipo. campo_produto é opcional.",
            );
        if (
            (f.campo_produto &&
                !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(f.campo_produto)) ||
            !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(f.campo_dataprep)
        )
            throw Error(
                "Linha " +
                    (i + 2) +
                    ": nomes devem conter letras, números, sublinhado e hífen, sem espaços.",
            );
        if (f.campo_produto && seen.has(fieldKey(f.campo_produto)))
            throw Error("Campo de produto duplicado: " + f.campo_produto + ".");
        if (f.campo_produto) seen.add(fieldKey(f.campo_produto));
        if (targets.has(fieldKey(f.campo_dataprep)))
            throw Error("Campo DataPrep duplicado: " + f.campo_dataprep + ".");
        targets.add(fieldKey(f.campo_dataprep));
        if (!layoutTypes.includes(f.tipo))
            throw Error(
                "Tipo inválido para " +
                    f.campo_produto +
                    ": " +
                    f.tipo +
                    ". Use STRING, INT, DECIMAL, DATE ou DATETIME.",
            );
    }
    for (const f of fields)
        if (
            fields.some(
                (other) =>
                    other !== f &&
                    fieldKey(other.campo_produto) ===
                        fieldKey(f.campo_dataprep),
            )
        )
            throw Error(
                "Mapeamento ambíguo: " +
                    f.campo_dataprep +
                    " também é campo de produto em outro mapeamento.",
            );
    return fields;
}

function layoutText(fields) {
    return (
        "campo_produto;campo_dataprep;tipo\n" +
        fields
            .map((f) => [f.campo_produto, f.campo_dataprep, f.tipo].join(";"))
            .join("\n")
    );
}

function parseLayoutText(text) {
    let lines = String(text)
        .split(/\r?\n/)
        .filter((l) => l.trim());
    if (
        lines[0] &&
        ["campoproduto", "campoorigem"].includes(norm(lines[0].split(";")[0]))
    )
        lines.shift();
    return validateLayoutFields(
        lines.map((line, i) => {
            let parts = line.split(";");
            if (parts.length !== 3)
                throw Error(
                    "Linha " +
                        (i + 2) +
                        ": informe três colunas separadas por ponto e vírgula.",
                );
            return {
                campo_produto: fieldName(parts[0]),
                campo_dataprep: fieldName(parts[1]),
                tipo: layoutType(parts[2]),
            };
        }),
    );
}

function makeLayoutDraft() {
    const name = $("layoutName").value.trim(),
        fields = previewLayout(),
        chosen = $("layoutEditSelect").value;
    const code = $("layoutCode").value.trim();
    if (!code || code.length > 100)
        throw Error("Preencha o código do layout com até 100 caracteres.");
    if (!name) throw Error("Preencha o nome do layout.");
    if (!fields)
        throw Error($("layoutError").textContent || "Corrija o mapeamento.");
    const previous = layouts.find((l) => l.id === chosen) || layoutDraftRecord,
        id = previous?.id || newRecordId();
    if (layouts.some((l) => l.id !== id && l.name === name))
        throw Error("Já existe um layout com esse nome.");
    const now = new Date().toISOString();
    return {
        id,
        name,
        code,
        fields,
        createdAt: previous ? previous.createdAt || null : now,
        updatedAt: now,
    };
}

function validLayoutDate(value) {
    return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(value) &&
        !Number.isNaN(Date.parse(value))
        ? value
        : null;
}

function parseLayoutRecord(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.fields))
        throw Error("Arquivo não contém um layout salvo.");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(value.id || ""))
        throw Error("Identificador de layout inválido.");
    const name = String(value.name ?? "").trim();
    const code = String(value.code ?? "").trim();
    if (code.length > 100)
        throw Error("Código do layout deve ter até 100 caracteres.");
    if (!name) throw Error("Nome de layout ausente.");
    const fields = validateLayoutFields(
        value.fields.map((f) => ({
            campo_produto: fieldName(f.campo_produto ?? f.campo_origem),
            campo_dataprep: fieldName(f.campo_dataprep),
            tipo: layoutType(f.tipo),
        })),
    );
    return {
        id: value.id,
        name,
        code,
        fields,
        createdAt: validLayoutDate(value.createdAt),
        updatedAt: validLayoutDate(value.updatedAt),
    };
}

function layoutRecordPayload(record) {
    return {
        schemaVersion: 3,
        id: record.id,
        name: record.name,
        code: record.code || "",
        createdAt: record.createdAt || null,
        updatedAt: record.updatedAt || null,
        fields: record.fields,
    };
}

async function loadProjectLayouts() {
    if (projectLayoutLoading) return;
    projectLayoutLoading = true;
    renderLayoutStorage();
    try {
        const payload = await layoutApiRepository.list();
        if (payload.storage !== "project" || !Array.isArray(payload.layouts))
            throw Error("Resposta de layouts inválida.");
        const found = payload.layouts.map(parseLayoutRecord);
        projectLayoutIds = new Set(found.map((l) => l.id));
        for (const record of found) {
            if (layouts.some((l) => l.id === record.id))
                layouts = layouts.map((l) => (l.id === record.id ? record : l));
            else layouts.push(record);
        }
        projectLayoutApiAvailable = true;
        saveLayouts();
        normalizeListRows(data);

        persist();
        render();
        refreshLayoutOptions();
        $("layoutStorageFeedback").textContent =
            found.length +
            " layout(s) lido(s) de layouts/." +
            (payload.errors?.length
                ? " Arquivos com problemas: " + payload.errors.join(" | ")
                : "");
    } catch (e) {
        projectLayoutApiAvailable = false;
        projectLayoutIds = new Set();
        $("layoutStorageFeedback").textContent =
            "A pasta do projeto é lida automaticamente ao executar a versão local com python server.py.";
    } finally {
        projectLayoutLoading = false;
        renderLayoutStorage();
    }
}

async function writeProjectLayout(record) {
    const payload = await layoutApiRepository.save(layoutRecordPayload(record));
    const saved = parseLayoutRecord(payload.layout);
    projectLayoutIds.add(saved.id);
    return saved;
}

function layoutLinks(id) {
    return projects
        .filter((p) => p.layoutId === id && p.rows.length)
        .map((p) => p.name);
}

function layoutDisplayName(record) {
    return record.code ? record.code + " — " + record.name : record.name;
}
