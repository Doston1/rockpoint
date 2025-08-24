import { DatabaseManager } from "./src/database/manager.js";

async function debugBranchAuth() {
  try {
    await DatabaseManager.connect();

    console.log("Checking test branch server...");
    const result = await DatabaseManager.query(
      `
      SELECT 
        bs.id, 
        bs.branch_id,
        bs.server_name,
        bs.api_key,
        bs.status,
        bs.is_active,
        b.code as branch_code,
        b.name as branch_name,
        b.is_active as branch_is_active
      FROM branch_servers bs
      JOIN branches b ON bs.branch_id = b.id
      WHERE bs.api_key = $1
    `,
      ["test_branch_server_api_key_123"]
    );

    console.log("Query result:", result.rows);

    if (result.rows.length > 0) {
      const data = result.rows[0];
      console.log("Branch server status:", data.status);
      console.log("Branch server is_active:", data.is_active);
      console.log("Branch is_active:", data.branch_is_active);
      console.log("Status check (maintenance):", data.status === "maintenance");
    } else {
      console.log("No branch server found with the test API key");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await DatabaseManager.disconnect();
  }
}

debugBranchAuth();
