/* global module */
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function install({ supabase, log }) {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "migrations", "001_init.sql"), "utf8");
    const { error } = await supabase.rpc("exec_sql", { sql }); // fallback if you have an exec_sql rpc
    if (error) {
      // If you don't have exec_sql RPC, run statements one-by-one via admin console or custom installer
      log("Failed to auto-run migration via exec_sql RPC. Please run modules/analytics/migrations/001_init.sql manually.");
      return { success: false, error: "manual migration required" };
    }
    return { success: true };
  } catch (e) {
    log(`Install error: ${e.message}`);
    return { success: false, error: e.message };
  }
};