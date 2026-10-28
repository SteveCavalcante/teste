/** Armazena no navegador e, ao executar pelo Python local, em dados/projetos/. */
class BrowserStorageRepository {
    constructor(storage) {
        this.storage = storage;
        this.keys = ["conecta-projects-v1", "conecta-layouts-v1", "conecta-contabil-v1"];
        this.browserUnavailable = false;
        try {
            if (!storage) throw Error("Armazenamento não disponível.");
            this.cache = Object.fromEntries(this.keys.map(key => [key, storage.getItem(key)]));
        } catch (error) {
            this.browserUnavailable = true;
            this.cache = Object.fromEntries(this.keys.map(key => [key, null]));
            this.storage = {
                getItem: () => null,
                setItem: () => { throw Error("Armazenamento bloqueado pelo navegador."); },
            };
        }
        this.local = false;
        this.blocked = false;
        this.revision = 0;
        this.message = this.browserUnavailable
            ? "O navegador bloqueou o acesso aos dados locais. Os menus estão disponíveis, mas o salvamento não está disponível nesta sessão. Abra o portal em uma aba normal ou use a versão Python."
            : "Dados salvos neste navegador. Para salvar em arquivo, execute python server.py no computador.";
        if (typeof location === "undefined" || !["localhost", "127.0.0.1"].includes(location.hostname) || typeof XMLHttpRequest === "undefined") return;
        try {
            const response = this.request("GET");
            if (response.status === 404) return;
            if (response.status !== 200) throw Error("Servidor não conseguiu ler os dados locais.");
            const snapshot = JSON.parse(response.responseText);
            if (!Number.isInteger(snapshot.revision) || !snapshot.values || typeof snapshot.values !== "object") throw Error("Resposta de armazenamento inválida.");
            this.local = true;
            this.revision = snapshot.revision;
            if (snapshot.revision > 0) {
                const conflict = ["conecta-projects-v1", "conecta-layouts-v1"].some(key => {
                    const current = this.storage.getItem(key);
                    return current && key in snapshot.values && current !== JSON.stringify(snapshot.values[key]);
                });
                if (conflict) {
                    this.blocked = true;
                    this.message = "Há dados diferentes neste navegador e no arquivo local. Nenhum foi substituído; preserve ambos antes de reconciliar.";
                    return;
                }
                for (const key of this.keys) {
                    if (!(key in snapshot.values)) continue;
                    const value = JSON.stringify(snapshot.values[key]);
                    this.cache[key] = value;
                }
            }
            this.message = "Armazenamento local ativo: dados/projetos/";
        } catch (error) {
            this.blocked = true;
            this.message = "Não foi possível verificar o arquivo local. Não há confirmação de salvamento: " + error.message;
        }
    }
    request(method, payload) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, "/api/projects", false);
        if (payload) xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(payload ? JSON.stringify(payload) : null);
        return xhr;
    }
    showStatus() {
        const target = typeof document !== "undefined" && document.getElementById("projectStorageStatus");
        if (target) target.textContent = this.message;
    }
    saveLocal() {
        if (!this.local || this.blocked) { this.showStatus(); return; }
        try {
            const values = {};
            for (const key of this.keys) {
                const raw = this.cache[key];
                if (raw !== null) values[key] = JSON.parse(raw);
            }
            const response = this.request("PUT", {revision: this.revision, values});
            const payload = JSON.parse(response.responseText);
            if (response.status !== 200) throw Error(payload.error || "Falha na gravação.");
            this.revision = payload.revision;
            for (const key of this.keys) this.storage.removeItem?.(key);
            this.message = "Alterações salvas no computador: dados/projetos/";
        } catch (error) {
            this.blocked = true;
            this.message = "Arquivo não salvo: " + error.message + " As alterações permanecem abertas nesta página; não recarregue sem preservá-las.";
        }
        this.showStatus();
    }
    read(key) { const raw = this.local && this.keys.includes(key) ? this.cache[key] : this.storage.getItem(key); return raw ? JSON.parse(raw) : null; }
    write(key, value) { this.writeRaw(key, JSON.stringify(value)); }
    readRaw(key) { return this.local && this.keys.includes(key) ? this.cache[key] : this.storage.getItem(key); }
    writeRaw(key, value) {
        if (this.local && this.keys.includes(key)) { this.cache[key] = value; this.saveLocal(); }
        else {
            try { this.storage.setItem(key, value); }
            catch (error) {
                this.message = "Não foi possível salvar no navegador. O armazenamento pode estar cheio ou indisponível. Os dados existentes foram mantidos. Use a versão Python para arquivos grandes.";
                this.showStatus();
                throw Error(this.message);
            }
        }
    }
}
function browserStorageAccess() {
    try { return localStorage; } catch { return null; }
}
const portalRepository = new BrowserStorageRepository(browserStorageAccess());
