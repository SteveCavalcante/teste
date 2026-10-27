/** Repository: transport for the local layout API, independent of DOM updates. */
class LayoutApiRepository {
    constructor(baseUrl = "/api/layouts") {
        this.baseUrl = baseUrl;
    }

    async request(url, options = {}) {
        const response = await fetch(url, { cache: "no-store", ...options });
        let payload;
        try {
            payload = await response.json();
        } catch {
            throw Error(
                "Servidor local indisponível. A operação não foi confirmada.",
            );
        }
        if (!response.ok) {
            throw Error(
                payload.error ||
                    "Não foi possível acessar os layouts do projeto.",
            );
        }
        return payload;
    }

    list() {
        return this.request(this.baseUrl);
    }

    save(record) {
        return this.request(
            this.baseUrl + "/" + encodeURIComponent(record.id),
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(record),
            },
        );
    }

    delete(id) {
        return this.request(this.baseUrl + "/" + encodeURIComponent(id), {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmation: "EXCLUIR" }),
        });
    }
}

const layoutApiRepository = new LayoutApiRepository();
