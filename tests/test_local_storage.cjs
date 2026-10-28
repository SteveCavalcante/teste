const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('dist/js/repositories/browser-storage-repository.js', 'utf8');
let disk = {revision: 0, values: {}};
function tab(initial = {}, hostname = 'localhost', quota = false) {
    const map = new Map(Object.entries(initial));
    const storage = {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k,v) => {if(quota) throw Error('QuotaExceededError'); map.set(k,v);}};
    class XHR {
        open(method) {this.method = method;}
        setRequestHeader() {}
        send(body) {
            if (this.method === 'GET') {this.status=200; this.responseText=JSON.stringify(disk); return;}
            const request = JSON.parse(body);
            if (request.revision !== disk.revision) {this.status=409; this.responseText=JSON.stringify({error:'conflito'}); return;}
            disk={revision:disk.revision+1,values:request.values}; this.status=200;this.responseText=JSON.stringify(disk);
        }
    }
    const context=vm.createContext({localStorage:storage, location:{hostname}, XMLHttpRequest:XHR, document:{getElementById:()=>null}});
    vm.runInContext(source,context);
    return {repo:vm.runInContext('portalRepository',context),map};
}
const key='conecta-projects-v1';
const initial={schemaVersion:1, projects:[{name:'Contabilidade', rows:[{transtype:'TT001'}]}]};
const first=tab({[key]:JSON.stringify(initial)});
first.repo.write(key,initial);
assert.equal(disk.values[key].projects[0].name,'Contabilidade');
const anonymous=tab();
assert.equal(anonymous.repo.read(key).projects[0].rows[0].transtype,'TT001');
const stale=tab();
anonymous.repo.write(key,{projects:[{name:'Atualizado'}]});
stale.repo.write(key,{projects:[{name:'Não sobrescrever'}]});
assert.equal(stale.repo.blocked,true);
assert.equal(disk.values[key].projects[0].name,'Atualizado');
assert.equal(stale.repo.read(key).projects[0].name,'Não sobrescrever');
const conflicting=tab({[key]:JSON.stringify({projects:[{name:'Dados anteriores'}]})});
assert.equal(conflicting.repo.blocked,true);
assert.equal(conflicting.repo.read(key).projects[0].name,'Dados anteriores');
console.log('PASS: migration, file recovery in new browser, concurrency and conflict protection.');

disk = {revision: 0, values: {}};
const fullBrowser = tab({}, 'localhost', true);
const huge = {projects: Array.from({length:4000}, (_, i) => ({name:'TT'+i, regra:'CONDICAO '.repeat(100)}))};
fullBrowser.repo.write(key, huge);
assert.equal(fullBrowser.repo.blocked, false);
assert.equal(disk.values[key].projects.length, 4000);
assert.equal(tab({}, 'localhost', true).repo.read(key).projects.length, 4000);
console.log('PASS: 4000 long records save and recover even when browser storage quota is exceeded.');
