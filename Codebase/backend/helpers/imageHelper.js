import fs from "fs";
import path from "path";

export function getImageMimeType(buffer) {
    if (!buffer || buffer.length < 12) {
        return "application/octet-stream";
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }

    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return "image/png";
    }

    if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46
    ) {
        return "image/gif";
    }

    if (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "image/webp";
    }

    return "application/octet-stream";
}

export function cleanupUploadedFiles(files = []) {
    for (const file of files) {
        if (!file.path) continue;

        try {
            fs.unlinkSync(file.path);
        } catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Failed to clean up uploaded file:", file.path, err);
            }
        }
    }
}

export function cleanupUploadedPaths(mediaUrls = []) {
    const uploadsRoot = path.resolve(process.cwd(), "uploads");

    for (const mediaUrl of mediaUrls) {
        if (!mediaUrl || typeof mediaUrl !== "string") continue;

        const relativePath = mediaUrl.replace(/^\/+/, "");
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
            console.error("Skipped cleanup outside uploads directory:", mediaUrl);
            continue;
        }

        try {
            fs.unlinkSync(absolutePath);
        } catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Failed to clean up uploaded file:", absolutePath, err);
            }
        }
    }
}
