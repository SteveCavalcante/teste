function uniqueProjectName(name, records = projects) {
    const base = String(name || 'Parametrização').trim().slice(0, 80);
    let result = base, count = 2;
    while (records.some(p => nameKey(p.name) === nameKey(result))) result = `${base} (${count++})`;
    return result;
}

function projectTransferSnapshot() {
    const project = currentProject();
    if (!project) throw Error('Selecione uma parametrização.');
    return JSON.parse(JSON.stringify({...project, rows: data, parameterType, serviceCode,
        integrationLocations, parameterDetails, layoutId: selectedLayout,
        excluded: [...excludedTranstypes], pilot: [...pilotTranstypes],
        fileName: $('fileName').textContent, layoutSnapshot: activeLayout() || null}));
}

function exportProjectJson() {
    try {
        const project = projectTransferSnapshot();
        const blob = new Blob([JSON.stringify({format:'integrai-parametrizacao',version:1,project},null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = project.name.replace(/[^a-zA-Z0-9_-]/g,'_') + '.parametrizacao.json';
        link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
        toast('JSON exportado com os dados atuais e o layout da parametrização.');
    } catch(error) { toast(error.message); }
}

function importProjectPayload(payload, copy = false, requestedName = null) {
    if (!payload || payload.format !== 'integrai-parametrizacao' || payload.version !== 1)
        throw Error('Use um JSON exportado pelo Roteirizou!.');
    const source = payload.project;
    if (!source || typeof source.name !== 'string' || !source.name.trim() || !Array.isArray(source.rows))
        throw Error('Parametrização inválida: nome e registros são obrigatórios.');
    if (source.rows.some(r => !r || typeof r !== 'object' || Array.isArray(r) || typeof r.transtype !== 'string'))
        throw Error('O JSON contém registros de Transtype inválidos.');
    if (requestedName !== null) {
        requestedName = String(requestedName).trim();
        if (!requestedName || requestedName.length > 100) throw Error('Informe um nome com até 100 caracteres.');
        if (projects.some(p => nameKey(p.name) === nameKey(requestedName))) throw Error('Já existe uma parametrização com esse nome.');
    }
    const now = new Date().toISOString();
    const project = {id:newRecordId(),name:requestedName ?? uniqueProjectName(source.name + (copy ? ' - Cópia' : '')),
        description:String(source.description || ''),rows:JSON.parse(JSON.stringify(source.rows)),
        parameterType:['LK2','VP8'].includes(source.parameterType) ? source.parameterType : '',
        serviceCode:String(source.serviceCode || ''),
        integrationLocations:Object.fromEntries(locationKeys.map(k=>[k,String(source.integrationLocations?.[k] || '')])),
        parameterDetails:{squad:String(source.parameterDetails?.squad || ''),knowledgeBase:String(source.parameterDetails?.knowledgeBase || '')},
        excluded:Array.isArray(source.excluded) ? source.excluded.filter(v=>typeof v === 'string') : [],
        pilot:Array.isArray(source.pilot) ? source.pilot.filter(v=>typeof v === 'string') : [],
        layoutId:'',fileName:String(source.fileName || ''),createdAt:now,updatedAt:now};
    if (source.layoutSnapshot) {
        const layout = parseLayoutRecord(source.layoutSnapshot);
        const existing = layouts.find(l => l.code === layout.code && JSON.stringify(l.fields) === JSON.stringify(layout.fields));
        if (existing) project.layoutId = existing.id;
        else {
            layout.id = newRecordId(); layout.name = uniqueProjectName(layout.name,layouts);
            project.layoutSnapshot = layout; project.layoutId = layout.id;
        }
    } else if (source.layoutId && layouts.some(l=>l.id===source.layoutId)) project.layoutId = source.layoutId;
    projects.push(project);
    try { saveProjectStore(); }
    catch(error) { projects = projects.filter(p=>p!==project); throw error; }
    openProject(project.id);
    return project;
}

function copyProject() {
    if (!currentProject()) { toast('Selecione uma parametrização.'); return; }
    $('copyProjectName').value = uniqueProjectName(currentProject().name + ' - Cópia');
    $('copyProjectError').textContent = '';
    $('copyProjectDialog').showModal();
    $('copyProjectName').focus();
}

function confirmProjectCopy(event) {
    event.preventDefault();
    try {
        importProjectPayload({format:'integrai-parametrizacao',version:1,project:projectTransferSnapshot()},true,$('copyProjectName').value);
        $('copyProjectDialog').close();
        toast('Cópia criada. A parametrização original foi mantida.');
    } catch(error) { $('copyProjectError').textContent = error.message; }
}

async function importProjectJson(file) {
    if (!file) return;
    try {
        if (file.size > 200*1024*1024) throw Error('O arquivo excede 200 MB.');
        importProjectPayload(JSON.parse(await file.text()));
        toast('Parametrização importada como um novo cadastro.');
    } catch(error) { toast('Não foi possível importar: ' + error.message); }
    finally { $('projectJsonFile').value = ''; }
}
