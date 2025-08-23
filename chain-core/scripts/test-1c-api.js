#!/usr/bin/env node

/**
 * 1C API Test Runner
 * Comprehensive test suite for 1C integration endpoints
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting 1C API Integration Tests...\n");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTests() {
  try {
    log("📋 Running 1C API Test Suite", "cyan");
    log("=".repeat(50), "blue");

    // Set test environment
    process.env.NODE_ENV = "test";

    // Run all tests
    log("\n🧪 Executing Jest test suite...", "yellow");

    const testCommand =
      "npx jest --verbose --coverage --detectOpenHandles --forceExit";

    log(`Command: ${testCommand}`, "blue");

    const result = execSync(testCommand, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    log("\n✅ All tests completed successfully!", "green");
    log("\n📊 Test Summary:", "cyan");
    log("- Authentication & Security Tests", "green");
    log("- Branch Management Tests", "green");
    log("- Product Management Tests", "green");
    log("- Employee Management Tests", "green");
    log("- Category Management Tests", "green");
    log("- Sync Logs Management Tests", "green");
    log("- End-to-End Integration Tests", "green");

    log("\n🎉 1C API is ready for production!", "green");
  } catch (error) {
    log("\n❌ Tests failed!", "red");
    log("Error details:", "red");
    console.error(error.stdout?.toString() || error.message);
    process.exit(1);
  }
}

// Test categories
const testCategories = [
  {
    name: "Authentication Tests",
    description: "API key validation, rate limiting, CORS",
    file: "tests/onec-api/auth.test.ts",
  },
  {
    name: "Branch Management Tests",
    description: "CRUD operations, server management, status monitoring",
    file: "tests/onec-api/branches.test.ts",
  },
  {
    name: "Product Management Tests",
    description: "Product CRUD, price updates, category relationships",
    file: "tests/onec-api/products.test.ts",
  },
  {
    name: "Employee Management Tests",
    description: "Employee CRUD, role management, branch assignments",
    file: "tests/onec-api/employees.test.ts",
  },
  {
    name: "Category Management Tests",
    description: "Category hierarchies, multi-language support",
    file: "tests/onec-api/categories.test.ts",
  },
  {
    name: "Sync Logs Tests",
    description: "Sync monitoring, performance tracking, cleanup",
    file: "tests/onec-api/sync-logs.test.ts",
  },
  {
    name: "Integration Tests",
    description: "End-to-end workflows, performance, data consistency",
    file: "tests/onec-api/integration.test.ts",
  },
];

// Display test information
function displayTestInfo() {
  log("\n📖 Test Coverage Overview:", "cyan");
  log("=".repeat(50), "blue");

  testCategories.forEach((category, index) => {
    log(`\n${index + 1}. ${category.name}`, "yellow");
    log(`   📄 ${category.file}`, "blue");
    log(`   📝 ${category.description}`, "reset");
  });

  log("\n🔧 Test Features:", "cyan");
  log("- Database setup/teardown", "green");
  log("- Mock data generation", "green");
  log("- API authentication testing", "green");
  log("- Data validation & sanitization", "green");
  log("- Error handling & rollback", "green");
  log("- Performance & concurrency", "green");
  log("- Multi-language support", "green");
  log("- Real-time sync logging", "green");
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--info")) {
    displayTestInfo();
    process.exit(0);
  }

  if (args.includes("--help")) {
    log("1C API Test Runner", "cyan");
    log("\nUsage:", "yellow");
    log("  npm run test:1c          # Run all tests");
    log("  npm run test:1c -- --info # Show test information");
    log("  npm run test:1c -- --help # Show this help");
    log("\nEnvironment:", "yellow");
    log("  NODE_ENV=test (automatically set)");
    log("  Database: Uses test database configuration");
    process.exit(0);
  }

  displayTestInfo();
  log("\n⏳ Starting tests in 3 seconds...", "yellow");

  setTimeout(() => {
    runTests();
  }, 3000);
}
