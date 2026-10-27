/** Armazena no navegador e, ao executar pelo Python local, em dados/portal.json. */
class BrowserStorageRepository {
    constructor(storage) {
        this.storage = storage;
        this.keys = [
            "conecta-projects-v1",
            "conecta-layouts-v1",
            "conecta-contabil-v1",
        ];
        this.local = false;
        this.blocked = false;
        this.revision = 0;
        this.message =
            "Dados salvos neste navegador. Para salvar em arquivo, execute python server.py no computador.";
        if (
            typeof location === "undefined" ||
            !["localhost", "127.0.0.1"].includes(location.hostname) ||
            typeof XMLHttpRequest === "undefined"
        )
            return;
        try {
            const response = this.request("GET");
            if (response.status === 404) return;
            if (response.status !== 200)
                throw Error("Servidor não conseguiu ler os dados locais.");
            const snapshot = JSON.parse(response.responseText);
            if (
                !Number.isInteger(snapshot.revision) ||
                !snapshot.values ||
                typeof snapshot.values !== "object"
            )
                throw Error("Resposta de armazenamento inválida.");
            this.local = true;
            this.revision = snapshot.revision;
            if (snapshot.revision > 0) {
                const conflict = [
                    "conecta-projects-v1",
                    "conecta-layouts-v1",
                ].some((key) => {
                    const current = this.storage.getItem(key);
                    return (
                        current &&
                        key in snapshot.values &&
                        current !== JSON.stringify(snapshot.values[key])
                    );
                });
                if (conflict) {
                    this.blocked = true;
                    this.message =
                        "Há dados diferentes neste navegador e no arquivo local. Nenhum foi substituído; preserve ambos antes de reconciliar.";
                    return;
                }
                for (const key of this.keys) {
                    if (!(key in snapshot.values)) continue;
                    const value = JSON.stringify(snapshot.values[key]);
                    const current = this.storage.getItem(key);
                    if (current && current !== value)
                        this.storage.setItem(
                            "conecta-backup-anterior-" + key,
                            current,
                        );
                    this.storage.setItem(key, value);
                }
            }
            this.message = "Armazenamento local ativo: dados/portal.json";
        } catch (error) {
            this.blocked = true;
            this.message =
                "Não foi possível verificar o arquivo local. Não há confirmação de salvamento: " +
                error.message;
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
        const target =
            typeof document !== "undefined" &&
            document.getElementById("projectStorageStatus");
        if (target) target.textContent = this.message;
    }
    saveLocal() {
        if (!this.local || this.blocked) {
            this.showStatus();
            return;
        }
        try {
            const values = {};
            for (const key of this.keys) {
                const raw = this.storage.getItem(key);
                if (raw !== null) values[key] = JSON.parse(raw);
            }
            const response = this.request("PUT", {
                revision: this.revision,
                values,
            });
            const payload = JSON.parse(response.responseText);
            if (response.status !== 200)
                throw Error(payload.error || "Falha na gravação.");
            this.revision = payload.revision;
            this.message = "Alterações salvas no computador: dados/portal.json";
        } catch (error) {
            this.blocked = true;
            this.message =
                "Arquivo não salvo: " +
                error.message +
                " As alterações permanecem neste navegador; preserve-as antes de recarregar.";
        }
        this.showStatus();
    }
    read(key) {
        const raw = this.storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    write(key, value) {
        this.storage.setItem(key, JSON.stringify(value));
        if (this.keys.includes(key)) this.saveLocal();
    }
    readRaw(key) {
        return this.storage.getItem(key);
    }
    writeRaw(key, value) {
        this.storage.setItem(key, value);
        if (this.keys.includes(key)) this.saveLocal();
    }
}
const portalRepository = new BrowserStorageRepository(localStorage);
