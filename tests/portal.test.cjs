const vm = require("node:vm"),
    fs = require("node:fs"),
    assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const nodes = new Map();
function node(id) {
    if (!nodes.has(id))
        nodes.set(id, {
            value: "",
            textContent: "",
            innerHTML: "",
            hidden: false,
            files: [],
            style: {},
            dataset: {},
            setAttribute() {},
            querySelectorAll() {
                return [];
            },
            addEventListener() {},
            showModal() {
                this.open = true;
            },
            close() {
                this.open = false;
            },
            focus() {},
        });
    return nodes.get(id);
}
node("fileName").textContent = "Exemplo demonstrativo";
node("headerRow").value = "1";
node("filter").value = "all";
node("parameterView").hidden = true;
const storage = new Map(),
    ctx = {
        console,
        crypto: { randomUUID: () => require("node:crypto").randomUUID() },
        document: {
            getElementById: node,
            addEventListener() {},
            body: { appendChild() {}, classList: {values:new Set(), toggle(k,force){const next=force===undefined?!this.values.has(k):force;next?this.values.add(k):this.values.delete(k);return next;},contains(k){return this.values.has(k);}} },
            createElement() {
                return { click() {}, remove() {} };
            },
        },
        localStorage: {
            getItem: (k) => storage.get(k) || null,
            setItem: (k, v) => storage.set(k, v),
        },
        window: { addEventListener() {} },
        scrollTo() {},
        setTimeout() {},
        fetch: async () => ({ ok: false }),
        Blob,
        URL,
        Event: class {},
    };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "dist/xlsx.js"), "utf8"), ctx);
function loadPortal(context) {
    const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
        .map((match) => match[1].split("?")[0])
        .filter((source) => source !== "xlsx.js");
    for (const script of scripts) {
        vm.runInContext(
            fs.readFileSync(path.join(root, "dist", script), "utf8"),
            context,
            { filename: script },
        );
    }
}
loadPortal(ctx);
function run(s) {
    return vm.runInContext(s, ctx);
}
run("loadDemoTranstypes()");
assert.equal(run("ttRecords().length"), 33);
assert.equal(run("ttRecords().filter(r=>r.errors.length).length"), 0);
assert.equal(run("ttRecords().every(r=>/^TT\\d{3}$/.test(r.tt))"), true);
assert.equal(run('ttRecords().some(r=>r.sql.includes("`"))'), false);
assert.equal(
    run("presentationValue('1234567890123','CONTA DEBITO')"),
    "1234.567.890.123",
);
assert.equal(run("presentationValue('004.341','EMPRESA')"), "004/341");
assert.equal(run("data.find(r=>r.transtype==='TT002').EMPRESA"), "004.341");
assert.equal(
    run(
        "expression({...data[0],campo:'COD_TIPO_EVENTO',operador:'=',valor:'150'})",
    ),
    "COD_TIPO_EVENTO = 150",
);
assert.equal(
    run("!!fieldErrors({...data[0],campo:'INEXISTENTE'}).campo"),
    true,
);
run("excludedTranstypes.add('TT001');commitProjectEdit();$('filter').value='excluded'");
assert.equal(run("visibleTts().length"), 1);
run(
    "generateParameterization=generateParameterization; XLSX.writeFile=(wb)=>{globalThis.exported=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])};generateParameterization()",
);
assert.equal(run("exported[0].EXCLUIR"), "SIM");
assert.equal(run("exported[0].PROJETO"), "Projeto inicial");
// Connection metadata is isolated per project, survives reload, and preserves custom destinations.
run("$('typeLK2').onchange();render()");
assert.equal(
    node("destinationDatabase").value,
    "db_corp_repositoriosdedados_integracaovarejo_contabil_spec_01",
);
run("$('typeVP8').onchange();render()");
assert.equal(
    node("destinationDatabase").value,
    "db_corp_gestaodefinancas_integracao_recepcaocontabil_spec_01",
);
run(
    "integrationLocations.destinationDatabase='database_lk2_provisorio';commitProjectEdit();restoreProject(currentProjectId);commitProjectEdit();render()",
);
assert.equal(
    node("destinationDatabase").value,
    "db_corp_gestaodefinancas_integracao_recepcaocontabil_spec_01",
);
assert.equal(
    JSON.parse(storage.get("conecta-projects-v1")).projects[0]
        .integrationLocations.destinationDatabase,
    "db_corp_gestaodefinancas_integracao_recepcaocontabil_spec_01",
);
for (const [key, value] of Object.entries({
    sourceDatabase: "produto_db",
    sourceTable: "eventos",
    destinationDatabase: "destino_definitivo",
    destinationTable: "lancamentos",
})) {
    node(key).value = value;
    run(`$('${key}').oninput()`);
}
run("$('typeLK2').onchange();render()");
assert.equal(node("destinationDatabase").value, "destino_definitivo");
const metadata = JSON.parse(storage.get("conecta-projects-v1")).projects[0]
    .integrationLocations;
assert.equal(metadata.sourceTable, "eventos");
assert.equal(metadata.destinationTable, "lancamentos");
run(
    "projects.push({id:'metadata-test',name:'Teste',rows:[]});openProject('metadata-test')",
);
assert.equal(node("sourceDatabase").value, "");
assert.equal(node("destinationDatabase").value, "");
run("openProject(projects[0].id)");
assert.equal(node("sourceDatabase").value, "produto_db");
assert.equal(node("destinationDatabase").value, "destino_definitivo");
run("projects=projects.filter(p=>p.id!=='metadata-test');commitProjectEdit()");
const initial = run("currentProjectId");
run(
    "projects.push({id:'second',name:'Segundo',description:'Teste',rows:[],layoutId:'',excluded:[]});openProject('second')",
);
assert.equal(run("data.length"), 0);
assert.equal(run("excludedTranstypes.size"), 0);
run(`openProject(${JSON.stringify(initial)})`);
assert.equal(run("ttRecords().length"), 33);
assert.equal(run("excludedTranstypes.has('TT001')"), true);
assert.equal(
    JSON.parse(storage.get("conecta-projects-v1")).projects[0].excluded[0],
    "TT001",
);
// Bulk flags apply to the entire project even when a filter and pagination are active.
run(
    "$('filter').value='excluded';tableState.pageSize=10;setAllMarkings('pilot',true);commitProjectEdit()",
);
assert.equal(run("pilotTranstypes.size"), 33);
assert.equal(run("excludedTranstypes.size"), 1);
assert.equal(
    JSON.parse(storage.get("conecta-projects-v1")).projects[0].pilot.length,
    33,
);
run("openProject('second')");
assert.equal(run("pilotTranstypes.size"), 0);
run(`openProject(${JSON.stringify(initial)})`);
assert.equal(run("pilotTranstypes.size"), 33);
run("setAllMarkings('excluded',true);setAllMarkings('pilot',false)");
assert.equal(run("excludedTranstypes.size"), 33);
assert.equal(run("pilotTranstypes.size"), 0);
run(
    "setAllMarkings('excluded',false);pilotTranstypes.add('TT001');excludedTranstypes.add('TT001');$('filter').value='excluded';commitProjectEdit();generateParameterization()",
);
assert.equal(run("exported[0].PILOTO"), "SIM");
assert.equal(run("exported[0].EXCLUIR"), "SIM");
assert.equal(run("ttRecords().length"), 33);

// The pilot filter combines with search and exports only marked records.
run("pilotTranstypes.add('TT002');$('filter').value='pilot';$('search').value='';tableState.page=3;$('filter').onchange()");
assert.equal(run("tableState.page"), 1);
assert.equal(run("visibleTts().map(record=>record.tt).join(',')"), "TT001,TT002");
run("$('search').value='TT002'");
assert.equal(run("visibleTts().map(record=>record.tt).join(',')"), "TT002");
run("generateParameterization()");
assert.equal(run("exported.length"), 1);
assert.equal(run("exported[0].TRANSTYPE"), "TT002");
assert.equal(run("exported[0].PILOTO"), "SIM");
run("pilotTranstypes.clear();$('search').value=''");
assert.equal(run("visibleTts().length"), 0);
run("pilotTranstypes.add('TT001');$('filter').value='all'");

run("$('filter').value='all';tableState.page=4");
assert.equal(run("paginateTts(visibleTts()).rows.length"), 3);
run("tableState.pageSize=50");
assert.equal(run("paginateTts(visibleTts()).rows.length"), 33);
// Real SheetJS round trip: heading on physical row 3, including blank row 2.
run(
    "workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['RELATORIO'],[],importKeys(),[...meta.map(k=>demo[0][k]), `DATA = DATE '2026-01-01' AND TIPO_EVENTO IN 150, 151`]]),'Dados');$('sheet').value='Dados';$('headerRow').value='3';readSheet()",
);
assert.equal(run("raw[2][0]"), "transtype");
assert.equal(run("headerIndex()"), 2);
run(
    "importKeys().forEach((k,i)=>$('map_'+i).value=String(i));$('upload').files=[{name:'teste.xlsx'}];$('confirmImport').onclick()",
);
assert.equal(run("ttRecords().length"), 1);
assert.equal(run("ttRecords()[0].errors.length"), 0);
assert.equal(run("data.length"), 2);
assert.equal(
    run("layoutLinks(selectedLayout).includes('Projeto inicial')"),
    true,
);
// Typed values and normalization retain only the imported conditions.
run(
    "layouts.push({id:'strings',name:'Texto',fields:[...demoLayoutFields,{campo_produto:'NOME',campo_dataprep:'NOME_NORMALIZADO',tipo:'STRING'}]});selectedLayout='strings'",
);
assert.equal(
    run(
        "expression({...base,campo:'NOME',operador:'=',valor:'Ação! @ São-Paulo'})",
    ),
    "NOME_NORMALIZADO = 'ACAO! @ SAO-PAULO'",
);
assert.equal(run("typeof ensurePositiveRules"), "undefined");
assert.equal(
    run(
        "data.some(r => r.campo === r.ATRIBUTO_VALOR && r.operador === '>' && r.valor === '0')",
    ),
    false,
);
const importedCount = run("data.length");
run("commitProjectEdit();render();openProject(currentProjectId)");
assert.equal(run("data.length"), importedCount);
console.log(
    "PASS: 33 Transtypes, mapped fields, SQL, formatting, project isolation, persisted exclusions, Excel output, header row 3, pagination and no generated conditions.",
);

// Legacy layouts remain readable; every new model and payload uses campo_produto.
assert.equal(
    run(
        "parseLayoutRecord({id:'antigo',name:'Antigo',fields:[{campo_origem:'EVENTO',campo_dataprep:'COD_EVENTO',tipo:'INT'}]}).fields[0].campo_produto",
    ),
    "EVENTO",
);
assert.equal(
    run(
        "parseLayoutText('campo_origem;campo_dataprep;tipo\\nEVENTO;COD_EVENTO;INT')[0].campo_produto",
    ),
    "EVENTO",
);
assert.equal(
    run(
        "parseLayoutText('campo_produto;campo_dataprep;tipo\\nEVENTO;COD_EVENTO;INT')[0].campo_produto",
    ),
    "EVENTO",
);
for (const header of ["campo_origem", "campo_produto"]) {
    run(
        `layoutWorkbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(layoutWorkbook,XLSX.utils.aoa_to_sheet([[${JSON.stringify(header)},'campo_dataprep','tipo'],['EVENTO','COD_EVENTO','INT']]),'Layout');$('layoutSheet').value='Layout';loadLayoutSheet()`,
    );
    assert.equal(run("$('layoutError').textContent"), "");
    assert.equal(
        run("$('layoutFields').value.startsWith('campo_produto;')"),
        true,
    );
}
run(
    "XLSX.writeFile=(wb)=>{globalThis.layoutHeaders=XLSX.utils.sheet_to_json(wb.Sheets.Layout,{header:1})[0]};$('layoutTemplate').onclick()",
);
assert.deepEqual(Array.from(run("layoutHeaders")), [
    "campo_produto",
    "campo_spec",
    "tipo",
]);
console.log(
    "PASS: campo_produto models and backwards compatibility for legacy JSON and Excel/CSV headers.",
);
const optional = run(
    "parseLayoutText(';campo_exemplo;STRING\\n;outro_campo;INT')",
);
assert.equal(optional.length, 2);
assert.equal(optional[0].campo_produto, "");
assert.equal(optional[0].campo_dataprep, "campo_exemplo");
assert.throws(
    () => run("parseLayoutText('PRODUTO;;STRING')"),
    /campo_spec/,
);
assert.throws(() => run("parseLayoutText(';CAMPO_EXEMPLO;')"), /tipo/);
run(
    "layoutWorkbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(layoutWorkbook,XLSX.utils.aoa_to_sheet([['campo_dataprep','tipo'],['CAMPO_EXEMPLO','STRING']]),'Layout');$('layoutSheet').value='Layout';loadLayoutSheet()",
);
assert.equal(run("$('layoutError').textContent"), "");
assert.equal(
    run("parseLayoutText($('layoutFields').value)[0].campo_produto"),
    "",
);
run(
    "layouts.push({id:'only-dataprep',name:'Somente DataPrep',fields:parseLayoutText(';CAMPO_EXEMPLO;STRING')});selectedLayout='only-dataprep'",
);
assert.equal(run("resolveField('')===undefined"), true);
assert.equal(run("selectableFields().length"), 1);
assert.equal(run("selectableFields()[0].origin"), "Spec");
assert.equal(
    run(
        "expression({...base,campo:'CAMPO_EXEMPLO',operador:'=',valor:'Ação!'})",
    ),
    "CAMPO_EXEMPLO = 'ACAO!'",
);
console.log(
    "PASS: optional campo_produto, multiple blank products, required DataPrep/type, Excel without product column and DataPrep-only SQL.",
);

// Different-than works in both import formats, with implicit and explicit conjunctions.
assert.equal(run("ops.includes('<>')"), true);
assert.equal(
    run(
        "parseSqlCell(\"CAMPO_EXEMPLO <> 'AÇÃO' AND CAMPO_EXEMPLO = 'B'\")[0].operador",
    ),
    "<>",
);
assert.equal(
    run(
        "parseSqlCell(\"CAMPO_EXEMPLO = 'A' CAMPO_EXEMPLO <> 'B'\")[1].operador",
    ),
    "<>",
);
assert.equal(
    run(
        "expression({...base,campo:'CAMPO_EXEMPLO',operador:'<>',valor:'Ação!'})",
    ),
    "CAMPO_EXEMPLO <> 'ACAO!'",
);
run("selectedLayout='exemplo'");
assert.equal(
    run(
        "check({...base,campo:'TIPO_EVENTO',operador:'<>',valor:'150'},[{...base,campo:'TIPO_EVENTO',operador:'<>',valor:'150'}])",
    ),
    "",
);
assert.equal(
    run("expression({...base,campo:'TIPO_EVENTO',operador:'<>',valor:'150'})"),
    "COD_TIPO_EVENTO <> 150",
);
console.log(
    "PASS: <> operator in SQL parsing, column validation, numeric and normalized string output.",
);
// Display and Excel use the mapped DataPrep attributes, preserving editable references.
run(
    "selectedLayout='exemplo';loadDemoTranstypes();$('filter').value='all';$('search').value=''",
);
assert.equal(
    run("presentationValue('CAMPO_DATA','ATRIBUTO_DATA')"),
    "DATA_CONTABIL",
);
assert.equal(
    run("presentationValue('CAMPO_VALOR','ATRIBUTO_VALOR')"),
    "VALOR_LANCAMENTO",
);
assert.equal(run("data[0].ATRIBUTO_DATA"), "CAMPO_DATA");
assert.equal(
    run("presentationValue('DESCONHECIDO','ATRIBUTO_DATA')"),
    "DESCONHECIDO",
);
run(
    "XLSX.writeFile=wb=>{globalThis.exported=XLSX.utils.sheet_to_json(wb.Sheets.Parametrizacao)};generateParameterization()",
);
assert.equal(run("exported[0]['ATRIBUTO DATA']"), "DATA_CONTABIL");
assert.equal(run("exported[0]['ATRIBUTO VALOR']"), "VALOR_LANCAMENTO");
run("$('search').value='DATA_CONTABIL'");
assert.equal(run("visibleTts().length"), 33);
run("$('search').value=''");

// Mixed-case, hyphenated names survive CSV, Excel and JSON; lookup remains case-insensitive.
const priorLayout = run("selectedLayout");
run(
    "layouts.push({id:'mixed-case',name:'Mixed',fields:parseLayoutText('campo_produto;campo_dataprep;tipo\\nTipo-Evento;cod-Evento;int\\nDataProduto;DataContabil;date\\nValorProduto;ValorLancamento;decimal')});selectedLayout='mixed-case'",
);
assert.equal(run("activeLayout().fields[0].campo_produto"), "Tipo-Evento");
assert.equal(run("activeLayout().fields[0].campo_dataprep"), "cod-Evento");
assert.equal(run("resolveField('TIPO-EVENTO').campo_dataprep"), "cod-Evento");
assert.match(run("expression({...base,campo:'Tipo-Evento',operador:'=',valor:'150'})"), /Campo Spec.*sem hífen/);
assert.equal(
    run("parseSqlCell('`cod-Evento` = 150 AND Tipo-Evento <> 151')[0].campo"),
    "cod-Evento",
);
assert.equal(run("parseSqlCell('Tipo-Evento = 150')[0].campo"), "Tipo-Evento");
assert.equal(
    run(
        "parseLayoutRecord(layoutRecordPayload(activeLayout())).fields[0].campo_dataprep",
    ),
    "cod-Evento",
);
assert.equal(
    run(
        "expression({...base,campo:'DataProduto',operador:'=',valor:'01/01/2026'})",
    ),
    "DataContabil = DATE '2026-01-01'",
);
run(
    "layoutWorkbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(layoutWorkbook,XLSX.utils.aoa_to_sheet([['campo_produto','campo_dataprep','tipo'],['Tipo-Evento','cod-Evento','int']]),'Mixed');$('layoutSheet').value='Mixed';loadLayoutSheet()",
);
assert.equal(
    run("parseLayoutText($('layoutFields').value)[0].campo_dataprep"),
    "cod-Evento",
);
assert.throws(
    () => run("parseLayoutText('A;Destino;INT\\nB;destino;INT')"),
    /duplicado/,
);
run(`selectedLayout=${JSON.stringify(priorLayout)}`);

// A misplaced quote must not swallow another condition or disappear on import.
const priorData = run("JSON.stringify(data)");
const priorSelectedLayout = run("selectedLayout");
const brokenRule =
    "valor_lancamento_contabil_seguros > 0\nand codigo_ramo_contabil_seguros = '71\nand codigo_grupo_susep = 001'\nand codigo_tipo_evento = '167'";
assert.throws(
    () => run(`parseSqlCell(${JSON.stringify(brokenRule)})`),
    /[Aa]spas/,
);
assert.throws(
    () => run('parseSqlCell("NOME = \'sem fechamento")'),
    /não fechadas/,
);
assert.equal(run("parseSqlCell(\"NOME = 'PAO E CAFE AND CHA'\").length"), 1);
assert.equal(
    run("parseSqlCell(\"NOME = 'D''AGUA' AND CODIGO = 1\").length"),
    2,
);
assert.throws(() => run("parseSqlCell('CODIGO = 1 OU OUTRO = 2')"), /OR\/OU/);
assert.throws(() => run("parseSqlCell('E = 1 OR AND = 2')"), /OR\/OU/);
assert.equal(run("parseSqlCell('CODIGO = 1 e OUTRO = 2').length"), 2);
assert.equal(
    run(
        "parseSqlCell(\"NOME IN ('AND', 'E', 'OR', 'OU') AND CODIGO = 1\").length",
    ),
    2,
);
run(
    `globalThis.badInput=${JSON.stringify(brokenRule)};data=expandSqlRows([{...base,transtype:'BROKEN',regra_sql:badInput},{...base,transtype:'VALID',regra_sql:'TIPO_EVENTO = 150 AND TIPO_EVENTO = 151 AND CAMPO_VALOR > 0'}]);selectedLayout='exemplo';parameterType='LK2';normalizeListRows(data);commitProjectEdit();render()`,
);
assert.equal(run("data.length"), 4);
assert.equal(run("data[0]._rawSql"), brokenRule);
assert.match(
    run("ttRecords().find(r => r.tt === 'BROKEN').errors.join(' ')"),
    /[Aa]spas/,
);
assert.equal(run("ttRecords().find(r => r.tt === 'BROKEN').sql"), brokenRule);
assert.equal(run("ttRecords().find(r => r.tt === 'VALID').errors.length"), 0);
assert.equal(
    run("ttRecords().find(r => r.tt === 'VALID').sql"),
    "COD_TIPO_EVENTO = 150\nAND COD_TIPO_EVENTO = 151\nAND VALOR_LANCAMENTO > 0",
);
run("restoreProject(currentProjectId)");
assert.equal(run("data[0]._rawSql"), brokenRule);
run("$('filter').value='error'");
assert.equal(run("visibleTts().length"), 1);
run("generateParameterization()");
assert.equal(run("exported[0].REGRA"), brokenRule);
assert.equal(run("exported[0]['REVISÃO']"), "Com alerta");
run(
    `data=JSON.parse(${JSON.stringify(priorData)});selectedLayout=${JSON.stringify(priorSelectedLayout)};$('filter').value='all';commitProjectEdit();render()`,
);
console.log(
    "PASS: misplaced and unclosed quotes, original invalid source retained, mixed valid/invalid import, persisted alerts, AND/E and OR/OU semantics and export.",
);

// Layout code is required for writes; old records remain editable and code keeps leading zeros.
run(
    "$('layoutName').value='Layout com código';$('layoutEditSelect').value='';layoutDraftRecord=null;$('layoutFields').value='Produto;DataPrep;INT';$('layoutCode').value=''",
);
assert.throws(() => run("makeLayoutDraft()"), /código do layout/);
run("$('layoutCode').value='   '");
assert.throws(() => run("makeLayoutDraft()"), /código do layout/);
run("$('layoutCode').value='0007'");
assert.equal(run("makeLayoutDraft().code"), "0007");
assert.equal(
    run("parseLayoutRecord(layoutRecordPayload(makeLayoutDraft())).code"),
    "0007",
);
assert.equal(
    run(
        "parseLayoutRecord({id:'legacy-code',name:'Antigo',fields:[{campo_produto:'A',campo_dataprep:'B',tipo:'INT'}]}).code",
    ),
    "",
);
// Extra parameterization metadata is isolated and persisted per project.
run(
    "$('parameterSquad').value='Squad Contábil';$('parameterSquad').oninput();$('parameterKnowledgeBase').value='https://intranet/base-contabil';$('parameterKnowledgeBase').oninput();commitProjectEdit()",
);
const detailsSaved = JSON.parse(
    storage.get("conecta-projects-v1"),
).projects.find((project) => project.id === initial).parameterDetails;
assert.equal(detailsSaved.squad, "Squad Contábil");
assert.equal(detailsSaved.knowledgeBase, "https://intranet/base-contabil");
run("openProject('second')");
assert.equal(node("parameterSquad").value, "");
assert.equal(node("parameterKnowledgeBase").value, "");
run(`openProject(${JSON.stringify(initial)})`);
assert.equal(node("parameterSquad").value, "Squad Contábil");
assert.equal(
    node("parameterKnowledgeBase").value,
    "https://intranet/base-contabil",
);
console.log(
    "PASS: required layout code, legacy readability, JSON round trip and isolated squad/knowledge-base persistence.",
);

// A large import is governed by file size, not by a condition count.
assert.equal(run("expandSqlRows(Array.from({length:4000}, (_,i)=>({...base,transtype:'TT'+i,regra_sql:'TIPO_EVENTO = 1 AND TIPO_EVENTO = 2 AND TIPO_EVENTO = 3 AND TIPO_EVENTO = 4'}))).length"), 16000);
const projectsBefore = run("projects.length"),
    layoutsBefore = run("layouts.length");
assert.throws(
    () => run("removeProject('second','excluir tudo')"),
    /excluir para confirmar/,
);
assert.equal(run("projects.length"), projectsBefore);
run("removeProject('second','eXcLuIr')");
assert.equal(run("projects.length"), projectsBefore - 1);
assert.equal(run("ttRecords().length"), 33);
assert.equal(run("layouts.length"), layoutsBefore);
run(`removeProject(${JSON.stringify(initial)},'EXCLUIR')`);
assert.equal(run("projects.length"), 0);
assert.equal(run("data.length"), 0);
assert.equal(run("currentProjectId"), null);
assert.equal(run("layouts.length"), layoutsBefore);
assert.equal(JSON.parse(storage.get("conecta-projects-v1")).projects.length, 0);
const restarted = { ...ctx };
vm.createContext(restarted);
loadPortal(restarted);
assert.equal(vm.runInContext("projects.length", restarted), 0);
assert.equal(vm.runInContext("data.length", restarted), 0);
console.log(
    "PASS: DataPrep table/export/search, confirmed project deletion, layout retention and empty-project persistence after restart.",
);

// Produto livre e mapeamento múltiplo preservam os destinos Spec.
run(`layouts.push({id:'multi',name:'Múltiplo',fields:[{campo_produto:'Nome; "especial"',campo_dataprep:'spec_a',tipo:'STRING'},{campo_produto:'Nome; "especial"',campo_dataprep:'spec_b',tipo:'STRING'}]});selectedLayout='multi'`);
assert.equal(run("validateLayoutFields(activeLayout().fields).length"), 2);
assert.equal(run("parseLayoutText(layoutText(activeLayout().fields))[0].campo_produto"), 'Nome; "especial"');
assert.equal(run("resolveField('Nome; \"especial\"') === undefined"), true);
assert.equal(run("selectableFields().filter(f=>f.origin==='Produto').map(f=>f.value).join(',')"), 'spec_a,spec_b');
assert.match(run("fieldErrors({...base,campo:'spec_a',operador:'=',valor:'X',_connector:'OR'}).operador_logico"), /OR/);
assert.equal(run("expandSqlRows([{...base,regra_sql:'spec_a = 1 OR spec_b = 2'}])[0]._sqlImportError.includes('OR/OU')"), true);

assert.equal(run("removeAccents('Descrição São José')"), 'Descricao Sao Jose');
assert.equal(run("typedLiteral(\"ação d'água!\",'STRING').sql"), "'ACAO D''AGUA!'");

assert.equal(run("isDeleteConfirmation('excluir')"),true);
assert.equal(run("isDeleteConfirmation('EXCLUIR')"),true);
assert.equal(run("isDeleteConfirmation('excluir tudo')"),false);

// Consult lists expose editing/deletion without a separate consultation action.
run("projects.push({id:'consult-list',name:'Teste',description:'Teste',rows:[]});renderProjects()");
assert.match(run("$('projectList').innerHTML"), /data-open-project/);
assert.match(run("$('projectList').innerHTML"), /data-delete-project/);
assert.doesNotMatch(run("$('projectList').innerHTML"), /data-consult-project/);
run("showMainView('layoutListView');renderLayoutList()");
assert.equal(run("$('layoutListView').hidden"), false);
assert.equal(run("$('projectsView').hidden"), true);
assert.match(run("$('layoutList').innerHTML"), /data-edit-layout/);
assert.match(run("$('layoutList').innerHTML"), /data-delete-layout/);
run("openLayoutAction('edit','multi')");
assert.equal(run("$('layoutDialog').hidden"), false);
assert.equal(run("$('layoutEditSelect').value"), 'multi');
run("closeLayoutEditor()");
assert.equal(run("$('layoutListView').hidden"), false);
assert.equal(run("$('layoutDialog').hidden"), true);

// A draft is only persisted by Salvar. Voltar discards it, including after a previous save.
run("openProject('consult-list');parameterDetails.squad='rascunho';persist()");
assert.notEqual(run("currentProject().parameterDetails?.squad"), 'rascunho');
run("showProjects();openProject('consult-list')");
assert.notEqual(run("parameterDetails.squad"), 'rascunho');
run("data=[{...base,transtype:'EDIT',campo:'TIPO_EVENTO',operador:'=',valor:'1'}];commitProjectEdit();data[0].valor='2';persist()");
assert.equal(run("currentProject().rows[0].valor"), '1');
run("showProjects();openProject('consult-list')");
assert.equal(run("data[0].valor"), '1');
run("showProjects()");
for (const size of [10,50,100]) {
 run(`listPagination.projects={page:1,size:${size}}`);
 assert.equal(run("paginateList(Array.from({length:125},(_,i)=>i),'projects').length"), size);
}
run("bindPortalEvents();$('projectName').value=' TESTE ';$('projectDescription').value='Duplicado';$('projectForm').onsubmit({preventDefault(){}})");
assert.match(run("$('projectFormError').textContent"), /Já existe/);

// Boot must not write browser storage or leave menus unbound when old names repeat or quota is full.
const legacyStore = JSON.stringify({selectedId:'legacy1',projects:[
 {id:'legacy1',name:'Teste',rows:[]}, {id:'legacy2',name:'TESTE',rows:[]}
]});
let bootWrites = 0;
const quotaBoot = {...ctx, localStorage: {
 getItem: key => key === 'conecta-projects-v1' ? legacyStore : null,
 setItem() { bootWrites++; throw Error('QuotaExceededError'); },
}};
vm.createContext(quotaBoot);
assert.doesNotThrow(() => loadPortal(quotaBoot));
assert.equal(bootWrites, 0);
assert.equal(vm.runInContext('projects.length',quotaBoot),2);
assert.equal(vm.runInContext("typeof $('navLayoutCreate').onclick",quotaBoot),'function');
assert.doesNotThrow(()=>vm.runInContext("$('navHome').onclick()",quotaBoot));
console.log('PASS: menus initialize with full browser storage and legacy duplicate names without writing or deleting saved data.');

// Every static action button must have a handler or an explicitly bound form.
run('bindPortalEvents()');
const staticHtml = fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const submitForms = {confirmDeleteLayout:'deleteLayoutForm',confirmDeleteProject:'deleteProjectForm'};
const actionIds = [...staticHtml.matchAll(/<button\b([^>]+)>/g)]
 .map(m=>/\bid="([^"]+)"/.exec(m[1])?.[1]).filter(Boolean);
for (const id of actionIds) {
 const expression = submitForms[id] ? `typeof $('${submitForms[id]}').onsubmit` : `typeof $('${id}').onclick`;
 assert.equal(run(expression),'function',`Unbound action button: ${id}`);
}

const blockedBrowser = {...ctx};
Object.defineProperty(blockedBrowser,'localStorage',{get(){throw Error('SecurityError: storage blocked');},configurable:true});
vm.createContext(blockedBrowser);
assert.doesNotThrow(()=>loadPortal(blockedBrowser));
assert.equal(vm.runInContext('portalRepository.browserUnavailable',blockedBrowser),true);
assert.doesNotThrow(()=>vm.runInContext("$('navHome').onclick()",blockedBrowser));
assert.doesNotThrow(()=>vm.runInContext("$('navLayoutCreate').onclick()",blockedBrowser));
assert.throws(()=>vm.runInContext("portalRepository.write('test',{name:'not saved'})",blockedBrowser),/Não foi possível salvar/);
console.log(`PASS: ${actionIds.length} static buttons bound; menu works when browser blocks localStorage entirely.`);

run("projects=[{id:'dup-a',name:'Teste',rows:[]},{id:'dup-b',name:'TESTE',rows:[]},{id:'dup-c',name:'Teste',rows:[]}];currentProjectId='dup-a';projectEditActive=false;restoreProject('dup-a');removeProject('dup-b','excluir')");
assert.equal(run('projects.length'),2);
assert.equal(run("projects.some(p=>p.id==='dup-b')"),false);
run("projectEditActive=false;data=[{...base,transtype:'TRANSFER',campo:'spec_a',operador:'=',valor:'X'}];selectedLayout='multi';globalThis.transfer=projectTransferSnapshot();globalThis.originalTransferId=currentProjectId;globalThis.newTransfer=importProjectPayload({format:'integrai-parametrizacao',version:1,project:transfer},true)");
assert.notEqual(run('newTransfer.id'),run('originalTransferId'));
assert.match(run('newTransfer.name'),/Cópia/);
assert.equal(run('data[0].transtype'),'TRANSFER');
run("data[0].valor='EDITED'");
assert.equal(run('transfer.rows[0].valor'),'X');
assert.throws(()=>run("importProjectPayload({project:{}})"),/exportado pelo Roteirizou!/);
const countBeforeCopyDialog = run('projects.length');
run('copyProject()');
assert.equal(run('projects.length'),countBeforeCopyDialog);
assert.throws(()=>run("importProjectPayload({format:'integrai-parametrizacao',version:1,project:transfer},true,projects[0].name)"),/Já existe/);
run("importProjectPayload({format:'integrai-parametrizacao',version:1,project:transfer},true,'Nome escolhido para a cópia')");
assert.equal(run('currentProject().name'),'Nome escolhido para a cópia');

run("$('projectsSortKey').value='name';$('projectsSortDirection').value='asc'");
assert.equal(run("sortConsultation([{name:'Zulu'},{name:'Água'}],'projects')[0].name"),'Água');
run("$('projectsSortKey').value='updatedAt';$('projectsSortDirection').value='desc'");
assert.equal(run("sortConsultation([{name:'Antigo',updatedAt:'2026-01-01'},{name:'Novo',updatedAt:'2026-10-01'},{name:'Sem data'}],'projects')[0].name"),'Novo');

assert.throws(()=>run("parseSqlCell('A == 1')"),/operador == inválido.*Use =/);
assert.throws(()=>run("parseSqlCell('A => 1')"),/operador => inválido.*Use >=/);
assert.throws(()=>run("parseSqlCell('A IN (1, 2')"),/fechamento|parênteses/);
assert.equal(run("parseSqlCell('A NOT IN (1, 2)').length"),1);
run("projectReadOnly=false;projectEditActive=true;projectBaseline=projectDraftKey();$('parameterView').hidden=false;$('layoutDialog').hidden=true;parameterDetails.squad='ALTERADO';window.confirm=()=>false");
assert.equal(run('hasUnsavedChanges()'),true);
assert.equal(run('permitNavigation()'),false);
run("window.confirm=()=>true");
assert.equal(run('permitNavigation()'),true);
run("projectReadOnly=true;applyProjectMode()");
assert.equal(run("$('saveProject').hidden"),true);
run("projectReadOnly=false;projectEditActive=false;applyProjectMode()");
assert.equal(run("$('saveProject').hidden"),false);

const staticIds = new Set([...staticHtml.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for (const folder of ['controllers','views','services','utils']) {
 for (const file of fs.readdirSync(path.join(root,'dist/js',folder)).filter(f=>f.endsWith('.js'))) {
  const text=fs.readFileSync(path.join(root,'dist/js',folder,file),'utf8');
  for (const match of text.matchAll(/\$\("([^"$]+)"\)/g)) {
   if (!match[1].startsWith('tt_') && !match[1].startsWith('map_')) assert.ok(staticIds.has(match[1]),`Missing HTML control ${match[1]} in ${file}`);
  }
 }
}
