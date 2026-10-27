/** services/sql-service.js — focused functions used by the application controller. */
function fieldErrors(r) {
    if (r._sqlImportError) return { regra_sql: r._sqlImportError };
    let errors = {};
    const exists = (k) => {
        let v = String(r[k] ?? "").trim(),
            layout = activeLayout();
        if (!layout) errors[k] = "Selecione um layout para validar o campo.";
        else if (!resolveField(v))
            errors[k] =
                'Campo "' +
                v +
                '" não localizado nos campos de Produto ou DataPrep do layout "' +
                layout.name +
                '".';
    };
    for (const k of keys)
        if (!String(r[k] ?? "").trim())
            errors[k] = "Preenchimento obrigatório.";
    for (const k of ["campo", "ATRIBUTO_DATA", "ATRIBUTO_VALOR"])
        if (!errors[k]) exists(k);
    if (!errors.EMPRESA && !/^\d{3}[./]\d{3}$/.test(r.EMPRESA)) {
        if (/^[\d./]+$/.test(r.EMPRESA))
            errors.EMPRESA =
                "Empresa fixa deve ter o formato NNN.NNN ou NNN/NNN.";
        else exists("EMPRESA");
    }
    for (const k of ["DEPARTAMENTO DEBITO", "DEPARTAMENTO CREDITO"])
        if (!errors[k] && !/^\d{5}$/.test(r[k])) {
            if (/^\d+$/.test(r[k]))
                errors[k] =
                    "Departamento fixo deve conter exatamente 5 dígitos.";
            else exists(k);
        }
    for (const k of ["CONTA DEBITO", "CONTA CREDITO"])
        if (!errors[k] && !/^\d{13}$/.test(r[k]))
            errors[k] =
                "Conta é sempre fixa e deve conter exatamente 13 dígitos.";
    if (
        !errors.ATRIBUTO_VALOR &&
        !["INT", "DECIMAL"].includes(resolveField(r.ATRIBUTO_VALOR)?.tipo)
    )
        errors.ATRIBUTO_VALOR =
            "O atributo valor deve ser numérico (INT ou DECIMAL).";
    if (
        !errors.campo &&
        !errors.valor &&
        ops.includes(normalizedOp(r.operador))
    ) {
        try {
            typedCondition(r);
        } catch (e) {
            errors.valor = e.message;
        }
    }
    return errors;
}

function dateSql(v) {
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return null;
    let iso = `${m[3]}-${m[2]}-${m[1]}`,
        d = new Date(iso + "T00:00:00Z");
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === iso
        ? `DATE '${iso}'`
        : false;
}

function divergent(r, rows = data) {
    return meta.filter(
        (k) =>
            k !== "transtype" &&
            rows.some((x) => x.transtype === r.transtype && x[k] !== r[k]),
    );
}

function missing(r) {
    return keys.filter((k) => !String(r[k] ?? "").trim());
}

function check(r, rows = data) {
    let errors = fieldErrors(r);
    if (Object.keys(errors).length)
        return Object.entries(errors)
            .map(([k, v]) => k + ": " + v)
            .join(" ");
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(r.campo))
        return "Campo deve ser um identificador simples, sem espaços.";
    if (!ops.includes(normalizedOp(r.operador)))
        return "Operador não suportado. Use IN, NOT IN, >, >=, <, <=, = ou <>.";
    let conflicts = divergent(r, rows);
    if (conflicts.length)
        return (
            "Transtype " +
            r.transtype +
            ": valores divergentes em " +
            conflicts.join(", ") +
            "."
        );
    return "";
}

function readSqlLiteral(input) {
    let date = /^DATE\s+'(\d{4})-(\d{2})-(\d{2})'/i.exec(input),
        match;
    if (date) {
        let value = `${date[3]}/${date[2]}/${date[1]}`;
        if (!dateSql(value)) throw Error("Literal DATE inválido.");
        return {
            value,
            type: "date",
            sql: dateSql(value),
            rest: input.slice(date[0].length),
        };
    }
    if ((match = /^'((?:''|[^'])*)'/.exec(input))) {
        let value = match[1].replace(/''/g, "'");
        return {
            value,
            type: "string",
            sql: match[0],
            rest: input.slice(match[0].length),
        };
    }
    if ((match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input)))
        return {
            value: match[0],
            type: "number",
            sql: match[0],
            rest: input.slice(match[0].length),
        };
    throw Error("Use texto entre aspas simples, número ou DATE 'AAAA-MM-DD'.");
}

function readSqlList(input) {
    const wrapped = input.startsWith("(");
    let rest = (wrapped ? input.slice(1) : input).trimStart(),
        items = [];
    if (!rest || rest.startsWith(")"))
        throw Error("A lista de IN ou NOT IN não pode estar vazia.");
    while (rest) {
        let item = readSqlLiteral(rest);
        items.push(item.sql);
        const trailing = item.rest;
        rest = trailing.trimStart();
        if (wrapped && rest.startsWith(")"))
            return {
                value: items.join(", "),
                type: "list",
                rest: rest.slice(1),
            };
        if (!wrapped && !rest.startsWith(","))
            return { value: items.join(", "), type: "list", rest: trailing };
        if (!rest.startsWith(","))
            throw Error("Separe os valores da lista com vírgulas.");
        rest = rest.slice(1).trimStart();
        if (!rest || rest.startsWith(")"))
            throw Error("Valor ausente após a vírgula.");
    }
    throw Error("Lista incompleta.");
}

function parseListValue(value) {
    let list = readSqlList(String(value ?? "").trim());
    if (list.rest.trim()) throw Error("Trecho inválido após a lista.");
    return "(" + list.value + ")";
}

function conditionValues(value) {
    let text = String(value ?? "").trim();
    if (text.startsWith("(") && text.endsWith(")"))
        text = text.slice(1, -1).trim();
    if (!text) throw Error("A lista não pode estar vazia.");
    let items = [],
        part = "",
        quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "'") {
            part += ch;
            if (quoted && text[i + 1] === "'") {
                part += "'";
                i++;
            } else quoted = !quoted;
        } else if (ch === "," && !quoted) {
            if (!part.trim()) throw Error("Item vazio na lista.");
            items.push(part.trim());
            part = "";
        } else part += ch;
    }
    if (quoted) throw Error("Aspas não fechadas na lista.");
    if (!part.trim()) throw Error("Item vazio na lista.");
    items.push(part.trim());
    return items.map((v) =>
        v.startsWith("'") && v.endsWith("'")
            ? v.slice(1, -1).replace(/''/g, "'")
            : v,
    );
}

function typedLiteral(value, type) {
    let v = String(value ?? "").trim();
    if (["DATE", "DATETIME"].includes(type))
        v = v.replace(/^(?:DATE|TIMESTAMP)\s+'([^']+)'$/i, "$1");
    if (type === "STRING") {
        v = normalizedText(v);
        if (!v) throw Error("Texto vazio após a limpeza.");
        return { display: v, sql: "'" + v + "'", type: "string" };
    }
    if (type === "INT") {
        if (!/^[+-]?\d+$/.test(v))
            throw Error(
                'Valor "' +
                    v +
                    '" incompatível com INT: informe um número inteiro.',
            );
        v = BigInt(v).toString();
        return { display: v, sql: v, type: "number" };
    }
    if (type === "DECIMAL") {
        v = v.replace(",", ".");
        if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(v))
            throw Error('Valor "' + v + '" incompatível com DECIMAL.');
        if (v.startsWith(".")) v = "0" + v;
        if (v.startsWith("-.")) v = "-0" + v.slice(1);
        if (v.startsWith("+.")) v = "+0" + v.slice(1);
        return { display: v, sql: v, type: "number" };
    }
    if (type === "DATE" || type === "DATETIME") {
        let datePart = v,
            time = "";
        if (type === "DATETIME") {
            let m = /^(.+?)[T ](\d{2}):(\d{2}):(\d{2})$/.exec(v);
            if (!m || +m[2] > 23 || +m[3] > 59 || +m[4] > 59)
                throw Error(
                    "DATETIME deve conter data e hora válidas (AAAA-MM-DD HH:MM:SS).",
                );
            datePart = m[1];
            time = `${m[2]}:${m[3]}:${m[4]}`;
        }
        let iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
        if (iso) datePart = `${iso[3]}/${iso[2]}/${iso[1]}`;
        const date = dateSql(datePart);
        if (!date)
            throw Error(
                "Valor incompatível com " +
                    type +
                    ": use DD/MM/AAAA ou AAAA-MM-DD.",
            );
        if (type === "DATE")
            return { display: datePart, sql: date, type: "date" };
        const canonical = date.slice(6, -1) + " " + time;
        return {
            display: datePart + " " + time,
            sql: "'" + canonical + "'",
            type: "datetime",
        };
    }
    throw Error("Tipo do layout não suportado: " + type);
}

function typedCondition(r) {
    const field = resolveField(r.campo);
    if (!field) throw Error("Campo não localizado no layout: " + r.campo);
    const op = normalizedOp(r.operador),
        isList = ["IN", "NOT IN"].includes(op);
    const values = isList ? conditionValues(r.valor) : [r.valor],
        items = values.map((v) => typedLiteral(v, field.tipo));
    return {
        field,
        op,
        items,
        display: isList
            ? items
                  .map((v) => (v.type === "string" ? v.sql : v.display))
                  .join(", ")
            : items[0].display,
        valueType: isList ? "list" : items[0].type,
    };
}

function normalizeListRows(rows) {
    for (const r of rows) {
        if (r._sqlImportError) continue;
        r.operador = normalizedOp(r.operador);
        for (const k of ["campo", "ATRIBUTO_DATA", "ATRIBUTO_VALOR"])
            r[k] = fieldName(r[k]);
        for (const k of [
            "EMPRESA",
            "DEPARTAMENTO DEBITO",
            "DEPARTAMENTO CREDITO",
        ])
            if (!/^[\d./]+$/.test(String(r[k] ?? ""))) r[k] = fieldName(r[k]);
        try {
            let typed = typedCondition(r);
            r.valor = typed.display;
            r._valueType = typed.valueType;
        } catch {}
    }
    return rows;
}

function parseSqlCell(input) {
    let rest = String(input ?? "").trim(),
        conditions = [],
        connector = "";
    if (!rest) throw Error("Regra obrigatória.");
    if (rest.length > 50000) throw Error("Regra excede 50.000 caracteres.");
    validateSqlQuotes(rest);
    while (rest) {
        const head =
            /^(\x60[A-Za-z_][A-Za-z0-9_-]*\x60|[A-Za-z_][A-Za-z0-9_-]*)\s*(NOT\s+IN\b|IN\b|<>|>=|<=|=|>|<)\s*/i.exec(
                rest,
            );
        if (!head)
            throw Error(
                "Condição inválida. Informe campo, operador e valor; conecte condições por AND/E ou OR/OU. Funções e agrupamentos lógicos ainda não são aceitos.",
            );
        rest = rest.slice(head[0].length);
        const op = normalizedOp(head[2]);
        const literal = ["IN", "NOT IN"].includes(op)
            ? readSqlList(rest)
            : readSqlLiteral(rest);
        conditions.push({
            campo: fieldName(head[1].replace(/^\x60|\x60$/g, "")),
            operador: op,
            valor: literal.value,
            _valueType: literal.type,
            _connector: connector,
        });
        rest = literal.rest;
        if (!rest.trim()) break;
        const whitespace = /^\s+/.test(rest);
        rest = rest.trimStart();
        const logical = /^(AND|OR|OU|E)\b\s*/i.exec(rest);
        if (logical) {
            const after = rest.slice(logical[0].length);
            // A field may itself be named E, AND, OR or OU.
            if (!/^(?:<>|>=|<=|=|>|<|IN\b|NOT\s+IN\b)/i.test(after)) {
                connector = /^(OR|OU)$/i.test(logical[1]) ? "OR" : "AND";
                rest = after;
                if (!rest)
                    throw Error("Operador lógico sem uma condição após ele.");
                continue;
            }
        }
        if (
            !whitespace ||
            !/^(\x60[A-Za-z_][A-Za-z0-9_-]*\x60|[A-Za-z_][A-Za-z0-9_-]*)\s*(NOT\s+IN\b|IN\b|<>|>=|<=|=|>|<)/i.test(
                rest,
            )
        )
            throw Error(
                "Separação inválida. Use AND/E ou OR/OU entre condições completas.",
            );
        connector = "AND";
    }
    return conditions;
}

function expandSqlRows(sourceRows) {
    const expanded = [];
    for (let i = 0; i < sourceRows.length; i++) {
        const row = sourceRows[i];
        const shared = Object.fromEntries(
            meta.map((k) => [k, String(row[k] ?? "").trim()]),
        );
        const original = String(row.regra_sql ?? "");
        let conditions;
        try {
            conditions = parseSqlCell(original);
        } catch (error) {
            conditions = [
                {
                    campo: "",
                    operador: "",
                    valor: "",
                    _rawSql: original,
                    _sqlImportError:
                        "Linha " +
                        (i + 2) +
                        ", Transtype " +
                        (row.transtype || "(vazio)") +
                        ": " +
                        error.message,
                },
            ];
        }
        expanded.push(
            ...conditions.map((condition) => ({
                ...shared,
                ...condition,
                _sourceSql: original,
                _sourceRuleId: "linha-" + i,
            })),
        );
        if (expanded.length > 10000)
            throw Error("A expansão excede 10.000 condições.");
    }
    return expanded;
}

function expression(r) {
    try {
        let t = typedCondition(r),
            id = sqlIdentifier(t.field.campo_dataprep);
        return `${id} ${t.op} ${["IN", "NOT IN"].includes(t.op) ? "(" + t.items.map((v) => v.sql).join(", ") + ")" : t.items[0].sql}`;
    } catch (e) {
        return "-- " + e.message;
    }
}

function sqlFor(rows) {
    if (rows.some((row) => row._sqlImportError)) return originalSqlFor(rows);
    if (!["LK2", "VP8"].includes(parameterType))
        return "-- Selecione o tipo de parametrização: LK2 ou VP8.";
    const errors = rows.map((row) => check(row, rows)).filter(Boolean);
    if (errors.length) return "-- Corrija os alertas para gerar a prévia SQL.";
    return rows
        .map(
            (row, index) =>
                (index ? normalizedConnector(row._connector) + " " : "") +
                expression(row),
        )
        .join("\n");
}

/** Detect quote boundaries before literals can swallow a following condition. */
function validateSqlQuotes(input) {
    let quoted = false,
        start = 0;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === "'") {
            if (quoted && input[i + 1] === "'") {
                i++;
                continue;
            }
            quoted = !quoted;
            if (quoted) start = i;
        } else if (quoted && /\s/.test(input[i])) {
            const embedded =
                /^\s+(AND|OR|OU|E)\s+(\x60[A-Za-z_][A-Za-z0-9_-]*\x60|[A-Za-z_][A-Za-z0-9_-]*)\s*(NOT\s+IN\b|IN\b|<>|>=|<=|=|>|<)/i.exec(
                    input.slice(i),
                );
            if (embedded)
                throw Error(
                    "Aspas incorretas: operador lógico " +
                        embedded[1].toUpperCase() +
                        " e outra condição foram encontrados dentro de um valor entre aspas (linha " +
                        input.slice(0, i).split("\n").length +
                        "). Revise o fechamento das aspas.",
                );
        }
    }
    if (quoted)
        throw Error(
            "Aspas simples não fechadas no valor iniciado na linha " +
                input.slice(0, start).split("\n").length +
                ".",
        );
}

function normalizedConnector(value) {
    const op = String(value || "AND")
        .trim()
        .toUpperCase();
    if (["AND", "E"].includes(op)) return "AND";
    if (["OR", "OU"].includes(op)) return "OR";
    throw Error("Operador lógico inválido: " + value);
}

/** Invalid source remains visible and is never silently normalized or executed. */
function originalSqlFor(rows) {
    const seen = new Set(),
        rules = [];
    for (const row of rows) {
        if (row._sourceRuleId && row._sourceSql !== undefined) {
            if (seen.has(row._sourceRuleId)) continue;
            seen.add(row._sourceRuleId);
            rules.push(row._sourceSql);
        } else rules.push(row._rawSql ?? expression(row));
    }
    return rules.join("\nAND ");
}
