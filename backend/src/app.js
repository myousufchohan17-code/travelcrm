require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { initDatabase } = require("./config/db");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

let boot;

function ensureDb(req, res, next) {
  boot = boot || initDatabase();
  boot.then(() => next()).catch(next);
}

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads")));

app.use(ensureDb);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "travelcrm-api" });
});

app.use("/api", routes);
app.use(errorHandler);

module.exports = app;
