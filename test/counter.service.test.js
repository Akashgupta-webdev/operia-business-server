import assert from "node:assert/strict";
import test from "node:test";

import Counter, {
  counterSchema,
} from "../src/modules/common/models/counter.model.js";
import { createCountId } from "../src/modules/common/services/counter.service.js";

test("counter schema normalizes names and applies its configured default", () => {
  const counter = new Counter({ name: " Company " });

  assert.equal(counter.name, "company");
  assert.equal(counter.count, 1000);
  assert.equal(counterSchema.path("name").options.immutable, true);
});

test("createCountId atomically increments and returns the allocated count", async () => {
  const originalFindOneAndUpdate = Counter.findOneAndUpdate;
  let receivedFilter;
  let receivedUpdate;
  let receivedOptions;

  Counter.findOneAndUpdate = (filter, update, options) => {
    receivedFilter = filter;
    receivedUpdate = update;
    receivedOptions = options;

    return {
      async exec() {
        return { name: "company", count: 7 };
      },
    };
  };

  try {
    const count = await createCountId(" Company ");

    assert.equal(count, 7);
    assert.deepEqual(receivedFilter, { name: "company" });
    assert.deepEqual(receivedUpdate, { $inc: { count: 1 } });
    assert.deepEqual(receivedOptions, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });
  } finally {
    Counter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("createCountId rejects an invalid counter name before persistence", async () => {
  await assert.rejects(() => createCountId("   "), {
    name: "TypeError",
    message: "Counter name cannot be empty.",
  });

  await assert.rejects(() => createCountId(null), {
    name: "TypeError",
    message: "Counter name must be a string.",
  });
});
