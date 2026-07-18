import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import { initDB, getDB } from "./db.js";
import { initLakehouse } from "./lakehouse.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import savedRecipeRoutes from "./routes/savedRecipeRoutes.js";
import commentRoutes from "./routes/commentsRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import analyticsRoutes from "./routes/analyticRoutes.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use("/uploads", express.static("uploads"));

// Routes
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", recipeRoutes);
app.use("/", followRoutes);
app.use("/", savedRecipeRoutes);
app.use("/", commentRoutes);
app.use("/", ratingRoutes);
app.use("/", analyticsRoutes);

async function start() {
    await initDB();
    const db = getDB();
    await initLakehouse(db);

    const port = process.env.PORT || 4000;

    app.listen(port, () =>
        console.log(`Savr backend listening on http://localhost:${port}`)
    );
}

start().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
});