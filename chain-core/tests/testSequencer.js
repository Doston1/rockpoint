// Custom test sequencer to run tests in specific order
const Sequencer = require("@jest/test-sequencer").default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define the order of test execution
    const order = [
      "auth.test.ts",
      "branches.test.ts",
      "categories.test.ts",
      "products.test.ts",
      "employees.test.ts",
      "inventory.test.ts",
      "sync-logs.test.ts",
      "integration.test.ts",
    ];

    return tests.sort((testA, testB) => {
      const aIndex = order.findIndex((name) => testA.path.includes(name));
      const bIndex = order.findIndex((name) => testB.path.includes(name));

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });
  }
}

module.exports = CustomSequencer;
