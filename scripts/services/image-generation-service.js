/**
 * Image Generation Service
 * Handles generating images for actors using OpenAI's DALL-E 3 (or compatible API)
 */

export async function generateAndSetActorImage(actor, apiKey, { prompt, size, background, partialImages, saveDir, storageSrc }) {
    const OPENAI_MODEL = "gpt-image-1"; // Using the model from the macro

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            prompt,
            size,
            background,
            stream: true,
            partial_images: partialImages,
            n: 1
        })
    });

    if (!resp.ok && resp.status !== 200) {
        const text = await resp.text().catch(() => "");
        throw new Error(`OpenAI error ${resp.status}: ${text || resp.statusText}`);
    }

    if (!resp.body || !resp.headers.get("content-type")?.includes("text/event-stream")) {
        // Fallback: non-streaming JSON
        const data = await resp.json();
        const item = data?.data?.[0];
        const b64 = item?.b64_json;
        const url = item?.url;
        const blob = b64 ? b64ToBlob(b64, "image/png") : await (await fetch(url)).blob();
        await saveAndSetActor(actor, blob, "final", saveDir, storageSrc);
        return;
    }

    // Parse SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "", partialIndex = 0, finalDone = false;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
            const lines = part.split("\n").map(l => l.trim()).filter(Boolean);
            const dataLines = lines.filter(l => l.startsWith("data:")).map(l => l.slice(5).trim());
            if (!dataLines.length) continue;

            const joined = dataLines.join("");
            if (joined === "[DONE]") { finalDone = true; continue; }

            let payload;
            try { payload = JSON.parse(joined); } catch { continue; }

            let b64 =
                payload?.data?.[0]?.b64_json ??
                payload?.b64_json ??
                payload?.image_base64 ?? null;

            const isPartial =
                (payload?.type && String(payload.type).includes("partial")) ||
                lines.some(l => l.toLowerCase().includes("event:") && l.toLowerCase().includes("partial"));

            const isFinal =
                (payload?.type && (String(payload.type).includes("complete") || String(payload.type).includes("final"))) ||
                (payload?.data && payload?.data?.[0] && !isPartial);

            if (!b64) continue;

            const blob = b64ToBlob(b64, "image/png");

            if (isPartial) {
                partialIndex++;
                await saveAndSetActor(actor, blob, `p${partialIndex}`, saveDir, storageSrc);
            } else if (isFinal) {
                await saveAndSetActor(actor, blob, "final", saveDir, storageSrc);
                finalDone = true;
            }
        }
    }
}

export async function saveAndSetActor(actor, blob, tag, saveDir, storageSrc) {
    const filenameSlug = (s) => s?.toLowerCase?.().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "token";
    const base = filenameSlug(actor.name);
    const filename = `${base}-${Date.now()}-${tag}.png`;

    const filePath = await uploadBlobToFoundry(blob, filename, saveDir, storageSrc, "image/png");

    // Update Actor image and Prototype Token image
    await actor.update({
        "img": filePath,
        "prototypeToken.texture.src": filePath
    });

    // Also update any active tokens for this actor
    if (actor.isToken) {
        // If the actor is a token actor (unlinked), update its token
        await actor.token.update({ "texture.src": filePath });
    } else {
        // If it's a real actor, find tokens on the canvas
        const tokens = actor.getActiveTokens();
        for (const token of tokens) {
            await token.document.update({ "texture.src": filePath });
        }
    }

    return filePath;
}

export async function uploadBlobToFoundry(blob, filename, directory, source = "data", mime = "image/png") {
    directory = directory.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/(^\/|\/$)/g, "");
    const file = new File([blob], filename, { type: mime });
    await ensureDirectoryExists(source, directory);
    const result = await FilePicker.upload(source, directory, file, { notify: false });
    if (!result?.path) throw new Error("Upload failed: no path returned.");
    return result.path;
}

export async function ensureDirectoryExists(source, dir) {
    const segments = dir.split("/").filter(Boolean);
    let current = "";
    for (const seg of segments) {
        const next = current ? `${current}/${seg}` : seg;
        let exists = true;
        try { await FilePicker.browse(source, next); }
        catch { exists = false; }
        if (!exists) {
            await FilePicker.createDirectory(source, next).catch(async () => {
                await FilePicker.browse(source, next);
            });
        }
        current = next;
    }
}

export function b64ToBlob(b64Data, contentType = "image/png") {
    const byteChars = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteChars.length; offset += 1024) {
        const slice = byteChars.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
}
