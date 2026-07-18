import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = req.user.id;
        let folder = "misc";

        if (file.fieldname === "recipeImage") {
            folder = "recipes";
        }
        else if (file.fieldname.includes("ingredients")) {
            folder = "ingredients";
        }
        else if (file.fieldname.includes("step_image")) {
            folder = "steps";
        }

        const uploadPath = path.join(
            "uploads",
            `user_${userId}`,
            folder
        );

        fs.mkdirSync(uploadPath, {
            recursive: true
        });

        cb(null, uploadPath);
    },

    filename: function (req, file, cb) {
        cb(
            null,
            `${Date.now()}-${file.originalname}`
        );
    },
});

const upload = multer({
    storage,
});

export default upload;