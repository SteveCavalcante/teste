import http from "node:http";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = existsSync(path.join(root, "dist", "index.html"))
    ? path.join(root, "dist")
    : root;
const layoutsDirectory = path.join(root, "layouts");
const port = Number(process.env.PORT || 8080);
const allowedTypes = new Set(["STRING", "INT", "DECIMAL", "DATE", "DATETIME"]);
await fs.mkdir(layoutsDirectory, { recursive: true });

function sendJson(res, status, value) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
}
function validateLayout(value, expectedId, requireCode = true) {
    if (
        !value ||
        typeof value !== "object" ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(value.id || "") ||
        (expectedId && value.id !== expectedId)
    )
        throw Error("Identificador inválido.");
    const name = String(value.name ?? "").trim();
    if (!name || name.length > 100)
        throw Error("Informe um nome com até 100 caracteres.");
    const code = String(value.code ?? "").trim();
    if (code.length > 100 || (requireCode && !code))
        throw Error("Preencha o código do layout com até 100 caracteres.");
    if (
        !Array.isArray(value.fields) ||
        !value.fields.length ||
        value.fields.length > 10000
    )
        throw Error("Informe entre 1 e 10.000 campos.");
    const seen = new Set(),
        targets = new Set();
    const fields = value.fields.map((field) => {
        const origin = String(
            field.campo_produto ?? field.campo_origem ?? "",
        ).trim();
        const target = String(field.campo_dataprep ?? "").trim();
        const type = String(field.tipo ?? "")
            .trim()
            .toUpperCase();
        if (
            (origin && !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(origin)) ||
            !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(target)
        )
            throw Error("Nome de campo inválido.");
        if (!allowedTypes.has(type)) throw Error("Tipo inválido: " + type);
        if (origin && seen.has(origin.toUpperCase()))
            throw Error("Campo de produto duplicado: " + origin);
        if (origin) seen.add(origin.toUpperCase());
        if (targets.has(target.toUpperCase()))
            throw Error("Campo DataPrep duplicado: " + target);
        targets.add(target.toUpperCase());
        return { campo_produto: origin, campo_dataprep: target, tipo: type };
    });
    if (
        fields.some((f) =>
            fields.some(
                (other) =>
                    other !== f &&
                    other.campo_produto.toUpperCase() ===
                        f.campo_dataprep.toUpperCase(),
            ),
        )
    )
        throw Error("Mapeamento de campos ambíguo.");
    return { schemaVersion: 3, id: value.id, name, code, fields };
}
function validDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? value
        : null;
}
async function listLayouts() {
    const layouts = [],
        errors = [],
        paths = new Map();
    for (const entry of (
        await fs.readdir(layoutsDirectory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        try {
            const filename = path.join(layoutsDirectory, entry.name);
            const stat = await fs.stat(filename);
            if (stat.size > 2 * 1024 * 1024)
                throw Error("Arquivo excede 2 MB.");
            const raw = JSON.parse(await fs.readFile(filename, "utf8"));
            const layout = validateLayout(raw, undefined, false);
            if (paths.has(layout.id))
                throw Error("Identificador duplicado: " + layout.id);
            paths.set(layout.id, filename);
            layouts.push({
                ...layout,
                createdAt: validDate(raw.createdAt),
                updatedAt: validDate(raw.updatedAt),
            });
        } catch (error) {
            errors.push(entry.name + ": " + error.message);
        }
    }
    return { layouts, errors, paths };
}
async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw Error("Conteúdo excede 2 MB.");
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
let writes = Promise.resolve();
async function storeLayout(payload, id) {
    const next = validateLayout(payload, id);
    const current = await listLayouts();
    const old = current.layouts.find((layout) => layout.id === id);
    if (
        current.layouts.some(
            (layout) => layout.id !== id && layout.name === next.name,
        )
    )
        throw Error("Já existe outro layout com esse nome.");
    const now = new Date().toISOString();
    const record = {
        ...next,
        createdAt: old ? old.createdAt : now,
        updatedAt: now,
    };
    const filename =
        current.paths.get(id) ||
        path.join(layoutsDirectory, "layout-" + id + ".json");
    // Do not overwrite an existing malformed/unrecognized JSON silently.
    if (!old && existsSync(filename))
        throw Error(
            "Já existe um arquivo inválido com esse identificador. Corrija-o antes de salvar.",
        );
    const temporary = path.join(layoutsDirectory, "." + randomUUID() + ".tmp");
    try {
        await fs.writeFile(temporary, JSON.stringify(record, null, 2) + "\n", {
            flag: "wx",
        });
        await fs.rename(temporary, filename);
    } finally {
        await fs.rm(temporary, { force: true });
    }
    return record;
}
const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
    try {
        const host = req.headers.host || "";
        if (!new Set(["localhost:" + port, "127.0.0.1:" + port]).has(host))
            return sendJson(res, 403, { error: "Host não permitido." });
        const url = new URL(req.url, "http://" + host);
        if (url.pathname === "/api/layouts" && req.method === "GET") {
            const { layouts, errors } = await listLayouts();
            return sendJson(res, 200, {
                storage: "project",
                directory: "layouts",
                layouts,
                errors,
            });
        }
        const match = /^\/api\/layouts\/([A-Za-z0-9_-]{1,100})$/.exec(
            url.pathname,
        );
        if (match && req.method === "DELETE") {
            if (req.headers.origin && req.headers.origin !== "http://" + host)
                return sendJson(res, 403, { error: "Origem não permitida." });
            if (
                !String(req.headers["content-type"]).startsWith(
                    "application/json",
                )
            )
                return sendJson(res, 415, { error: "Envie application/json." });
            const body = await readBody(req);
            if (body.confirmation !== "EXCLUIR")
                return sendJson(res, 400, {
                    error: "Digite exatamente EXCLUIR.",
                });
            const operation = writes.then(async () => {
                const current = await listLayouts();
                const filename = current.paths.get(match[1]);
                if (!filename) throw Error("Layout não encontrado.");
                await fs.unlink(filename);
            });
            writes = operation.catch(() => {});
            await operation;
            return sendJson(res, 200, { deleted: match[1] });
        }
        if (match && req.method === "PUT") {
            if (req.headers.origin && req.headers.origin !== "http://" + host)
                return sendJson(res, 403, { error: "Origem não permitida." });
            if (
                !String(req.headers["content-type"]).startsWith(
                    "application/json",
                )
            )
                return sendJson(res, 415, { error: "Envie application/json." });
            const body = await readBody(req);
            const operation = writes.then(() => storeLayout(body, match[1]));
            writes = operation.catch(() => {});
            const layout = await operation;
            return sendJson(res, 200, { layout });
        }
        if (url.pathname.startsWith("/api/"))
            return sendJson(res, 404, { error: "Rota não encontrada." });
        if (!["GET", "HEAD"].includes(req.method))
            return sendJson(res, 405, { error: "Método não permitido." });
        const decoded = decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
        );
        const filename = path.resolve(publicRoot, "." + decoded);
        const relative = path.relative(publicRoot, filename);
        if (
            relative.startsWith("..") ||
            path.isAbsolute(relative) ||
            relative.split(path.sep).some((part) => part.startsWith(".")) ||
            relative === "server.mjs" ||
            relative === "package.json" ||
            relative.startsWith("layouts" + path.sep)
        )
            return sendJson(res, 403, { error: "Arquivo não disponível." });
        const body = await fs.readFile(filename);
        res.writeHead(200, {
            "Content-Type":
                mime[path.extname(filename)] || "application/octet-stream",
            "Cache-Control": "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
        sendJson(res, error.code === "ENOENT" ? 404 : 400, {
            error: error.message,
        });
    }
});
server.listen(port, "127.0.0.1", () =>
    console.log(
        "Portal em http://localhost:" +
            port +
            " • layouts em " +
            layoutsDirectory,
    ),
);
