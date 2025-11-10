module.exports = async function install({ supabase }) {
  console.log("Installing REST Tester module...");
  // Verify table exists
  const { error } = await supabase.from("rest_requests").select("id").limit(1);
  if (error) {
    console.error("Installation verification failed:", error);
    return { success: false, error: error.message };
  }
  console.log("REST Tester module installed successfully");
  return { success: true };
};