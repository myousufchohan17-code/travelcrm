const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const mysql = require("mysql2/promise");
const schemaPg = require("../schemaPg");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "travel_crm",
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 1 : 10,
  dateStrings: true,
  multipleStatements: true,
};

let pool;
let pgSql;
let ready;
let dialect = "mysql";

function connectionUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.MYSQL_URL || "";
}

function isPostgres() {
  const url = connectionUrl();
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function neonUrl() {
  return connectionUrl()
    .replace(/&channel_binding=require/gi, "")
    .replace(/\?channel_binding=require&?/gi, "?")
    .replace(/\?$/, "");
}

function mysqlToPg(sql) {
  return sql
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/gi, "to_char($1, 'YYYY-MM')")
    .replace(/DATE_SUB\(NOW\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(NOW() - INTERVAL '$1 day')")
    .replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(CURRENT_DATE - INTERVAL '$1 day')")
    .replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+MONTH\)/gi, "(CURRENT_DATE - INTERVAL '$1 month')")
    .replace(/YEAR\(([^)]+)\) = YEAR\(CURDATE\(\)\)/gi, "EXTRACT(YEAR FROM $1) = EXTRACT(YEAR FROM CURRENT_DATE)")
    .replace(/CURDATE\(\)/gi, "CURRENT_DATE")
    .replace(/IFNULL\(/gi, "COALESCE(");
}

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function splitSql(sql) {
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return cleaned
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeParams(params) {
  return (params || []).map((value) => (value === "" ? null : value));
}

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function runPg(text, params = []) {
  if (typeof pgSql.query === "function") {
    return asRows(await pgSql.query(text, params));
  }
  return asRows(await pgSql(text, params));
}

async function initDatabase() {
  if (ready) return ready;
  ready = (async () => {
    if (isPostgres()) {
      dialect = "postgres";
      const { neon } = require("@neondatabase/serverless");
      pgSql = neon(neonUrl());
      for (const statement of splitSql(schemaPg)) {
        await runPg(statement);
      }
      return;
    }

    dialect = "mysql";
    if (!connectionUrl() && !process.env.VERCEL) {
      const bootstrap = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        multipleStatements: true,
      });
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await bootstrap.end();
    }

    pool = mysql.createPool({
      ...config,
      ...(connectionUrl() ? { uri: connectionUrl() } : {}),
    });
    const fs = require("fs");
    const path = require("path");
    const schemaPath = [
      path.join(__dirname, "..", "..", "schema.sql"),
      path.join(process.cwd(), "backend", "schema.sql"),
      path.join(process.cwd(), "schema.sql"),
    ].find((file) => fs.existsSync(file));
    if (!schemaPath) throw new Error("schema.sql was not found");
    const schema = fs
      .readFileSync(schemaPath, "utf8")
      .split("\n")
      .filter((line) => !/^\s*CREATE DATABASE/i.test(line) && !/^\s*USE /i.test(line))
      .join("\n");
    await pool.query(schema);
    await pool.query("ALTER TABLE agents ADD COLUMN image MEDIUMTEXT NULL").catch(() => {});
    await pool.query("ALTER TABLE destinations MODIFY image MEDIUMTEXT NULL").catch(() => {});
    await pool.query("ALTER TABLE travel_packages MODIFY image MEDIUMTEXT NULL").catch(() => {});
    await pool.query("ALTER TABLE users MODIFY avatar MEDIUMTEXT NULL").catch(() => {});
    await pool.query("ALTER TABLE settings MODIFY logo MEDIUMTEXT NULL").catch(() => {});
    await pool.query(`
      INSERT INTO users (full_name, email, password_hash, role)
      SELECT 'Travel Manager', 'admin@miaholidays.test', '', 'admin'
      FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)
    `).catch(() => {});
  })();
  return ready;
}

function getPool() {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }
  return pool;
}

async function query(sql, params = []) {
  const values = normalizeParams(params);
  if (dialect === "postgres") {
    let text = mysqlToPg(sql);
    const isInsert = /^\s*insert\s+/i.test(text) && !/returning\s+/i.test(text);
    if (isInsert) text += " RETURNING id";
    text = toPgPlaceholders(text);
    const rows = await runPg(text, values);
    if (isInsert) {
      return { insertId: rows[0]?.id, affectedRows: rows.length };
    }
    return rows;
  }
  const [rows] = await getPool().execute(sql, values);
  return rows;
}

module.exports = { initDatabase, getPool, query };
