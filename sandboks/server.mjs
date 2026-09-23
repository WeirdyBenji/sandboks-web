import { createServer } from "node:http";
import { createReadStream, createWriteStream, existsSync, linkSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = resolve(__filename, "..");
const indexPath = join(rootDir, "index.html");
const uploadsDir = join(rootDir, "uploads");
const port = Number(process.env.PORT || 3000);
const configuredMaxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES);
const maxUploadBytes = Number.isFinite(configuredMaxUploadBytes) && configuredMaxUploadBytes > 0
    ? configuredMaxUploadBytes
    : 2 * 1024 * 1024 * 1024;

if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
}

readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(".upload-") && entry.name.endsWith(".part"))
    .forEach((entry) => unlinkSync(join(uploadsDir, entry.name)));

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
};

const vendorFiles = new Map([
    ["/vendor/qrcode-generator.js", join(rootDir, "node_modules", "qrcode-generator", "qrcode.js")],
    ["/vendor/JsBarcode.all.min.js", join(rootDir, "node_modules", "jsbarcode", "dist", "JsBarcode.all.min.js")],
    ["/vendor/pdf-lib.min.js", join(rootDir, "node_modules", "pdf-lib", "dist", "pdf-lib.min.js")],
]);

const commonSecurityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
};

const pageSecurityHeaders = {
    ...commonSecurityHeaders,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

const sendJson = (response, statusCode, payload) => {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        ...commonSecurityHeaders,
    });
    response.end(body);
};

const sanitizeFileName = (value) => {
    const cleaned = (value || "upload.bin")
        .replace(/[\\/]/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 120);

    return !cleaned || cleaned === "." || cleaned === ".." ? "upload.bin" : cleaned;
};

const numberedFileName = (originalName, counter) => {
    const safeName = sanitizeFileName(originalName);
    const extension = extname(safeName);
    const baseName = extension ? safeName.slice(0, -extension.length) : safeName;
    const suffix = counter ? `-${counter}` : "";
    const availableBaseLength = Math.max(1, 120 - extension.length - suffix.length);
    return `${baseName.slice(0, availableBaseLength)}${suffix}${extension}`.slice(0, 120);
};

const commitUpload = (temporaryPath, originalName) => {
    let counter = 0;

    while (true) {
        const fileName = numberedFileName(originalName, counter);
        const filePath = join(uploadsDir, fileName);

        try {
            linkSync(temporaryPath, filePath);
            unlinkSync(temporaryPath);
            return { fileName, filePath, renamed: counter > 0 };
        } catch (error) {
            if (!(error instanceof Error) || error.code !== "EEXIST") throw error;
            counter += 1;
        }
    }
};

const getUploadPath = (fileName) => {
    if (!fileName || sanitizeFileName(fileName) !== fileName) {
        return null;
    }

    return join(uploadsDir, fileName);
};

const serveFile = async (response, absolutePath, headers = {}) => {
    const extension = extname(absolutePath);
    const contentType = contentTypes[extension] || "application/octet-stream";
    const fileStat = statSync(absolutePath);

    response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": fileStat.size,
        ...commonSecurityHeaders,
        ...headers,
    });
    await pipeline(createReadStream(absolutePath), response);
};

const createUploadLimiter = (maximumBytes) => {
    let receivedBytes = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            receivedBytes += chunk.length;
            if (receivedBytes > maximumBytes) {
                const error = new Error("Upload too large");
                error.code = "PAYLOAD_TOO_LARGE";
                callback(error);
                return;
            }
            callback(null, chunk);
        },
    });
};

const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

        if (request.method === "GET" && url.pathname === "/") {
            await serveFile(response, indexPath, pageSecurityHeaders);
            return;
        }

        if (request.method === "GET" && (url.pathname === "/favicon.ico" || url.pathname === "/favicon.svg")) {
            await serveFile(response, join(rootDir, "favicon.svg"), { "Content-Type": "image/svg+xml" });
            return;
        }

        if (request.method === "GET" && vendorFiles.has(url.pathname)) {
            await serveFile(response, vendorFiles.get(url.pathname), { "Cache-Control": "public, max-age=31536000, immutable" });
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/files") {
            const files = readdirSync(uploadsDir, { withFileTypes: true })
                .filter((entry) => entry.isFile() && !entry.name.startsWith(".upload-"))
                .map((entry) => {
                    const fileStat = statSync(join(uploadsDir, entry.name));
                    return {
                        name: entry.name,
                        size: fileStat.size,
                        updatedAt: fileStat.mtime.toISOString(),
                        url: `files/${encodeURIComponent(entry.name)}`,
                    };
                })
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

            sendJson(response, 200, { ok: true, files });
            return;
        }

        if (request.method === "GET" && url.pathname.startsWith("/files/")) {
            const fileName = decodeURIComponent(url.pathname.slice("/files/".length));
            const filePath = getUploadPath(fileName);

            if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
                sendJson(response, 404, { ok: false, error: "File not found" });
                return;
            }

            await serveFile(response, filePath, {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            });
            return;
        }

        if (request.method === "GET" && url.pathname.startsWith("/api/files/") && url.pathname.endsWith("/compressed")) {
            const encodedName = url.pathname.slice("/api/files/".length, -"/compressed".length);
            const fileName = decodeURIComponent(encodedName);
            const filePath = getUploadPath(fileName);

            if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
                sendJson(response, 404, { ok: false, error: "File not found" });
                return;
            }

            if (/\.(?:gz|tgz)$/i.test(fileName)) {
                await serveFile(response, filePath, {
                    "Content-Type": "application/gzip",
                    "Content-Disposition": `attachment; filename="${fileName}"`,
                    "Cache-Control": "no-store",
                });
                return;
            }

            response.writeHead(200, {
                "Content-Type": "application/gzip",
                "Content-Disposition": `attachment; filename="${fileName}.gz"`,
                "Cache-Control": "no-store",
                ...commonSecurityHeaders,
            });
            await pipeline(createReadStream(filePath), createGzip(), response);
            return;
        }

        if (request.method === "DELETE" && url.pathname.startsWith("/api/files/")) {
            const fileName = decodeURIComponent(url.pathname.slice("/api/files/".length));
            const filePath = getUploadPath(fileName);

            if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
                sendJson(response, 404, { ok: false, error: "File not found" });
                return;
            }

            unlinkSync(filePath);
            sendJson(response, 200, { ok: true });
            return;
        }

        if (request.method === "POST" && url.pathname === "/upload") {
            const fileName = url.searchParams.get("name") || "upload.bin";
            const contentLength = Number(request.headers["content-length"] || 0);
            if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
                request.resume();
                sendJson(response, 413, { ok: false, error: "Upload too large", maxUploadBytes });
                return;
            }

            const temporaryPath = join(uploadsDir, `.upload-${randomUUID()}.part`);
            let savedUpload;
            try {
                const writer = createWriteStream(temporaryPath, { flags: "wx" });
                await pipeline(request, createUploadLimiter(maxUploadBytes), writer);
                savedUpload = commitUpload(temporaryPath, fileName);
            } catch (error) {
                if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
                if (error instanceof Error && error.code === "PAYLOAD_TOO_LARGE") {
                    sendJson(response, 413, { ok: false, error: "Upload too large", maxUploadBytes });
                    return;
                }
                throw error;
            }

            const savedStat = statSync(savedUpload.filePath);
            sendJson(response, 201, {
                ok: true,
                fileName: savedUpload.fileName,
                renamed: savedUpload.renamed,
                size: savedStat.size,
                savedTo: `uploads/${savedUpload.fileName}`,
                url: `files/${encodeURIComponent(savedUpload.fileName)}`,
            });
            return;
        }

        sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
        if (response.headersSent) {
            response.destroy();
            return;
        }
        sendJson(response, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

server.listen(port, () => {
    console.log(`Upload server listening on http://localhost:${port}`);
});
