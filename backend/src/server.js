const app = require("./app");
const { initDatabase } = require("./config/db");

const port = Number(process.env.PORT || 4000);

async function start() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`Travel CRM API running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
