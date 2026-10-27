/** utils/formatters.js — focused functions used by the application controller. */
function newRecordId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return (
        "id-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 12)
    );
}

function formatLayoutDate(value) {
    return value
        ? new Date(value).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              dateStyle: "short",
              timeStyle: "short",
          })
        : "Não registrado";
}

function esc(s) {
    return String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
}

function normalizedText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function fieldName(value) {
    return String(value ?? "").trim();
}

/** Case-insensitive comparison without changing imported field spelling. */
function fieldKey(value) {
    return fieldName(value).toUpperCase();
}

function sqlIdentifier(value) {
    const name = fieldName(value);
    return name.includes("-") ? "\x60" + name + "\x60" : name;
}

function normalizedOp(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}

function norm(s) {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function attributeDisplayValue(value, key) {
    const text = String(value ?? "");
    return ["ATRIBUTO_DATA", "ATRIBUTO_VALOR"].includes(key)
        ? resolveField(text)?.campo_dataprep || text
        : text;
}

function presentationValue(value, key) {
    const text = attributeDisplayValue(value, key);
    if (
        ["CONTA DEBITO", "CONTA CREDITO"].includes(key) &&
        /^\d{13}$/.test(text)
    )
        return text.replace(/^(\d{4})(\d{3})(\d{3})(\d{3})$/, "$1.$2.$3.$4");
    if (key === "EMPRESA" && /^\d{3}[./]\d{3}$/.test(text))
        return text.replace(".", "/");
    return text;
}

function headerIndex() {
    return Math.max(
        0,
        Math.min(9999, (parseInt($("headerRow").value, 10) || 1) - 1),
    );
}
