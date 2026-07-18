import multer from "multer";

const profileImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2 MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Profile image must be a JPG, PNG, WEBP, or GIF file"));
        }

        cb(null, true);
    },
});

export default profileImageUpload;