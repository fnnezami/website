module.exports = async function uninstall({ supabase }) {
  console.log("Uninstalling REST Tester module...");
  // Cleanup data (keep schema)
  const { error } = await supabase.from("rest_requests").delete().neq("id", null);
  if (error) {
    console.error("Uninstallation cleanup failed:", error);
    return { success: false, error: error.message };
  }
  console.log("REST Tester module uninstalled successfully");
  return { success: true };
};