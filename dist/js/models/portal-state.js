/** Model: application state and backwards-compatible persistence hydration. */
const $ = (id) => document.getElementById(id);

const keys = [
    "transtype",
    "DESCRICAO_TRANSTYPE",
    "campo",
    "operador",
    "valor",
    "EMPRESA",
    "ATRIBUTO_DATA",
    "ATRIBUTO_VALOR",
    "DEPARTAMENTO DEBITO",
    "DEPARTAMENTO CREDITO",
    "CONTA DEBITO",
    "CONTA CREDITO",
];

const labels = keys,
    ops = ["IN", "NOT IN", ">", ">=", "<", "<=", "=", "<>"],
    meta = keys.filter((k) => !["campo", "operador", "valor"].includes(k));

const base = {
    transtype: "tt001",
    DESCRICAO_TRANSTYPE: "XPTO",
    EMPRESA: "004/341",
    ATRIBUTO_DATA: "CAMPO_DATA",
    ATRIBUTO_VALOR: "CAMPO_VALOR",
    "DEPARTAMENTO DEBITO": "05080",
    "DEPARTAMENTO CREDITO": "05080",
    "CONTA DEBITO": "1234567890123",
    "CONTA CREDITO": "1234567890123",
};

const demo = [
    {
        ...base,
        transtype: "TT001",
        DESCRICAO_TRANSTYPE: "RECEBIMENTO DE VENDAS",
        campo: "DATA",
        operador: "=",
        valor: "01/01/2026",
    },
    {
        ...base,
        transtype: "TT001",
        DESCRICAO_TRANSTYPE: "RECEBIMENTO DE VENDAS",
        campo: "TIPO_EVENTO",
        operador: "IN",
        valor: "150, 151",
    },
    {
        ...base,
        transtype: "TT002",
        DESCRICAO_TRANSTYPE: "PAGAMENTO A FORNECEDORES",
        EMPRESA: "004.341",
        "DEPARTAMENTO DEBITO": "05081",
        "DEPARTAMENTO CREDITO": "05082",
        "CONTA DEBITO": "2234567890123",
        "CONTA CREDITO": "3234567890123",
        campo: "TIPO_EVENTO",
        operador: "=",
        valor: "200",
    },
    {
        ...base,
        transtype: "TT002",
        DESCRICAO_TRANSTYPE: "PAGAMENTO A FORNECEDORES",
        EMPRESA: "004.341",
        "DEPARTAMENTO DEBITO": "05081",
        "DEPARTAMENTO CREDITO": "05082",
        "CONTA DEBITO": "2234567890123",
        "CONTA CREDITO": "3234567890123",
        campo: "DATA",
        operador: ">=",
        valor: "01/02/2026",
    },
    {
        ...base,
        transtype: "TT003",
        DESCRICAO_TRANSTYPE: "TARIFAS DE SERVICOS",
        EMPRESA: "005/341",
        "DEPARTAMENTO DEBITO": "06010",
        "DEPARTAMENTO CREDITO": "06020",
        "CONTA DEBITO": "4234567890123",
        "CONTA CREDITO": "5234567890123",
        campo: "TIPO_EVENTO",
        operador: "NOT IN",
        valor: "300, 301",
    },
    {
        ...base,
        transtype: "TT003",
        DESCRICAO_TRANSTYPE: "TARIFAS DE SERVICOS",
        EMPRESA: "005/341",
        "DEPARTAMENTO DEBITO": "06010",
        "DEPARTAMENTO CREDITO": "06020",
        "CONTA DEBITO": "4234567890123",
        "CONTA CREDITO": "5234567890123",
        campo: "CAMPO_VALOR",
        operador: "<=",
        valor: "5000",
    },
    {
        ...base,
        transtype: "TT004",
        DESCRICAO_TRANSTYPE: "AJUSTE CONTABIL",
        EMPRESA: "006/341",
        "DEPARTAMENTO DEBITO": "07010",
        "DEPARTAMENTO CREDITO": "07010",
        "CONTA DEBITO": "6234567890123",
        "CONTA CREDITO": "7234567890123",
        campo: "TIPO_EVENTO",
        operador: "=",
        valor: "400",
    },
    {
        ...base,
        transtype: "TT004",
        DESCRICAO_TRANSTYPE: "AJUSTE CONTABIL",
        EMPRESA: "006/341",
        "DEPARTAMENTO DEBITO": "07010",
        "DEPARTAMENTO CREDITO": "07010",
        "CONTA DEBITO": "6234567890123",
        "CONTA CREDITO": "7234567890123",
        campo: "DATA",
        operador: ">=",
        valor: "01/03/2026",
    },
    {
        ...base,
        transtype: "TT004",
        DESCRICAO_TRANSTYPE: "AJUSTE CONTABIL",
        EMPRESA: "006/341",
        "DEPARTAMENTO DEBITO": "07010",
        "DEPARTAMENTO CREDITO": "07010",
        "CONTA DEBITO": "6234567890123",
        "CONTA CREDITO": "7234567890123",
        campo: "DATA",
        operador: "<=",
        valor: "31/03/2026",
    },
];

const demoDescriptions = [
    "ESTORNO DE VENDAS",
    "LIQUIDACAO DE TITULOS",
    "RECEBIMENTO DE JUROS",
    "PAGAMENTO DE COMISSOES",
    "RECOLHIMENTO DE IMPOSTOS",
    "TRANSFERENCIA ENTRE CONTAS",
    "PROVISAO DE DESPESAS",
    "BAIXA DE PROVISAO",
    "RECEBIMENTO DE ALUGUEL",
    "PAGAMENTO DE BENEFICIOS",
    "APROPRIACAO DE RECEITAS",
    "DESPESAS ADMINISTRATIVAS",
    "ACERTO DE DIFERENCAS",
    "RECUPERACAO DE CREDITO",
    "TARIFA DE MANUTENCAO",
    "AJUSTE DE CAMBIO",
    "RENDIMENTO DE APLICACOES",
    "PAGAMENTO DE PRESTADORES",
    "DEVOLUCAO DE VALORES",
    "COMPENSACAO DE SALDOS",
    "RECEBIMENTO DE SEGUROS",
    "PROVISAO DE TRIBUTOS",
    "BAIXA DE TITULOS",
    "RECLASSIFICACAO CONTABIL",
    "RATEIO DE CUSTOS",
    "COBRANCA DE SERVICOS",
    "RECEBIMENTO DE DIVIDENDOS",
    "DEVOLUCAO DE TARIFAS",
    "FECHAMENTO MENSAL",
];

// Exemplos adicionais para visualizar ordenação e quatro páginas de 10 registros.

for (let i = 5; i <= 33; i++) {
    const month = String(((i - 1) % 12) + 1).padStart(2, "0"),
        shared = {
            ...base,
            transtype: "TT" + String(i).padStart(3, "0"),
            DESCRICAO_TRANSTYPE: demoDescriptions[i - 5],
            EMPRESA: String(4 + (i % 3)).padStart(3, "0") + "/341",
            "DEPARTAMENTO DEBITO": String(5000 + i).padStart(5, "0"),
            "DEPARTAMENTO CREDITO": String(6000 + i).padStart(5, "0"),
            "CONTA DEBITO": String(1000000000000 + i),
            "CONTA CREDITO": String(2000000000000 + i),
        };
    demo.push(
        {
            ...shared,
            campo: "TIPO_EVENTO",
            operador: i % 3 === 0 ? "IN" : "=",
            valor:
                i % 3 === 0 ? i * 100 + ", " + (i * 100 + 1) : String(i * 100),
        },
        {
            ...shared,
            campo: "DATA",
            operador: ">=",
            valor: "01/" + month + "/2026",
        },
    );
    if (i % 4 === 0)
        demo.push({
            ...shared,
            campo: "CAMPO_VALOR",
            operador: "<=",
            valor: String(i * 1000),
        });
}

let parameterType = "",
    serviceCode = "";

const locationKeys = [
    "sourceDatabase",
    "sourceTable",
    "destinationDatabase",
    "destinationTable",
];

let parameterDetails = { squad: "", knowledgeBase: "" };

let integrationLocations = Object.fromEntries(
    locationKeys.map((key) => [key, ""]),
);

let data = demo.map((r) => ({ ...r })),
    editing = -1,
    workbook,
    raw = [];

const demoLayoutFields = [
    { campo_produto: "DATA", campo_dataprep: "DATA_EVENTO", tipo: "DATE" },
    {
        campo_produto: "TIPO_EVENTO",
        campo_dataprep: "COD_TIPO_EVENTO",
        tipo: "INT",
    },
    {
        campo_produto: "CAMPO_DATA",
        campo_dataprep: "DATA_CONTABIL",
        tipo: "DATE",
    },
    {
        campo_produto: "CAMPO_VALOR",
        campo_dataprep: "VALOR_LANCAMENTO",
        tipo: "DECIMAL",
    },
];

const layoutTypes = ["STRING", "INT", "DECIMAL", "DATE", "DATETIME"];

let layouts = [
        {
            id: "exemplo",
            name: "Layout de exemplo",
            fields: demoLayoutFields.map((f) => ({ ...f })),
        },
    ],
    selectedLayout = "exemplo",
    layoutWorkbook,
    layoutDraftRecord = null;

let projectLayoutApiAvailable = false,
    projectLayoutIds = new Set(),
    projectLayoutLoading = false;

let projects = [],
    projectsInitialized = false,
    currentProjectId = null,
    excludedTranstypes = new Set(),
    pilotTranstypes = new Set();

const sharedLabels = {
    transtype: "Transtype",
    DESCRICAO_TRANSTYPE: "Descrição Transtype",
    EMPRESA: "Empresa",
    ATRIBUTO_DATA: "Atributo data",
    ATRIBUTO_VALOR: "Atributo valor",
    "DEPARTAMENTO DEBITO": "Departamento débito",
    "DEPARTAMENTO CREDITO": "Departamento crédito",
    "CONTA DEBITO": "Conta débito",
    "CONTA CREDITO": "Conta crédito",
};

const ttColumns = [
    "transtype",
    "DESCRICAO_TRANSTYPE",
    "regra_sql",
    "EMPRESA",
    "ATRIBUTO_DATA",
    "ATRIBUTO_VALOR",
    "DEPARTAMENTO DEBITO",
    "DEPARTAMENTO CREDITO",
    "CONTA DEBITO",
    "CONTA CREDITO",
];

const tableState = {
    sortKey: "transtype",
    direction: "asc",
    page: 1,
    pageSize: 10,
};

const tableCollator = new Intl.Collator("pt-BR", {
    numeric: true,
    sensitivity: "base",
});

let ttDraft = null;

let openFieldPickerId = null;

let deletingLayoutId = null;

let deletingProjectId = null;

/** Hydrate existing saved projects without changing storage keys or record schemas. */
function hydratePortalState() {
    /** Application bootstrap: shared state, event bindings and initial rendering.
     * Domain operations and UI functions are declared in the preceding scripts. */

    try {
        const s = portalRepository.read("conecta-contabil-v1");
        if (s && Array.isArray(s.rows)) {
            data = s.rows;
            serviceCode = /^[0-9]{1,5}$/.test(String(s.serviceCode ?? ""))
                ? String(s.serviceCode)
                : "";
            parameterType = ["LK2", "VP8"].includes(s.parameterType)
                ? s.parameterType
                : "";
            $("fileName").textContent = s.name;
        }
    } catch {}

    try {
        const saved = portalRepository.read("conecta-layouts-v1");
        if (saved && Array.isArray(saved.layouts)) {
            layouts = saved.layouts.map((l) => ({
                ...l,
                fields: l.fields.map((f) =>
                    typeof f === "string"
                        ? {
                              campo_produto: fieldName(f),
                              campo_dataprep: fieldName(f),
                              tipo:
                                  (l.id === "exemplo"
                                      ? demoLayoutFields.find(
                                            (d) =>
                                                d.campo_produto ===
                                                fieldName(f),
                                        )?.tipo
                                      : undefined) || "STRING",
                          }
                        : {
                              campo_produto: fieldName(
                                  f.campo_produto ?? f.campo_origem,
                              ),
                              campo_dataprep: fieldName(f.campo_dataprep),
                              tipo: layoutType(f.tipo),
                          },
                ),
            }));
            selectedLayout = saved.selectedLayout;
        }
    } catch {}

    try {
        const saved = portalRepository.read("conecta-projects-v1");
        if (saved && Array.isArray(saved.projects)) {
            projects = saved.projects;
            projectsInitialized = true;
            currentProjectId = projects.some((p) => p.id === saved.selectedId)
                ? saved.selectedId
                : projects[0]?.id || null;
        }
    } catch {}
    if (!projectsInitialized) {
        const now = new Date().toISOString();
        projects = [
            {
                id: newRecordId(),
                name: "Projeto inicial",
                description:
                    "Parametrizações existentes e exemplo de demonstração.",
                rows: data,
                parameterType,
                serviceCode,
                integrationLocations: { ...integrationLocations },
                layoutId: selectedLayout,
                excluded: [],
                fileName: $("fileName").textContent,
                createdAt: now,
                updatedAt: now,
            },
        ];
        currentProjectId = projects[0].id;
    }
    for (const l of layouts)
        if (
            l.id === "demonstracao-4-tts" &&
            l.name === "Layout de demonstração (4 TTs)"
        )
            l.name = "Layout de demonstração (4 Transtypes)";
    restoreProject(currentProjectId);
}

let layoutReturnToParameter = false;

let projectEditActive = false;
const listPagination = { projects: { page: 1, size: 10 }, layouts: { page: 1, size: 10 } };

let projectReadOnly = false, layoutViewOnly = false, projectBaseline = '', layoutBaseline = '';
