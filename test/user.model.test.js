import assert from "node:assert/strict";
import { test } from "node:test";

import User, {
  USER_ROLES,
  USER_STATUSES,
  hashAccessKey,
} from "../src/modules/user/models/user.model.js";

test("creates a valid user with the requested field names", async () => {
  const user = new User({
    name: "Agent Name",
    email: "  AGENT@EXAMPLE.TEST ",
    accessKey: "authentication-adapter-reference",
  });

  await user.validate();

  assert.equal(user.name, "Agent Name");
  assert.equal(user.email, "agent@example.test");
  assert.equal(
    user.accessKey,
    hashAccessKey("authentication-adapter-reference")
  );
  assert.equal(user.role, "AGENT");
  assert.equal(user.status, "ACTIVE");
});

test("requires identity and credential fields", async () => {
  const error = await new User().validate().catch((validationError) => validationError);

  assert.ok(error.errors.name);
  assert.ok(error.errors.email);
  assert.ok(error.errors.accessKey);
});

test("restricts user role and status values", async () => {
  const user = new User({
    name: "Agent Name",
    email: "agent@example.test",
    accessKey: "authentication-adapter-reference",
    role: "CUSTOMER",
    status: "SUSPENDED",
  });
  const error = await user.validate().catch((validationError) => validationError);

  assert.deepEqual(USER_ROLES, ["ADMIN", "AGENT"]);
  assert.deepEqual(USER_STATUSES, ["ACTIVE", "INACTIVE"]);
  assert.ok(error.errors.role);
  assert.ok(error.errors.status);
});

test("never serializes the access key", () => {
  const user = new User({
    name: "Agent Name",
    email: "agent@example.test",
    accessKey: "authentication-adapter-reference",
  });
  const representation = user.toJSON();

  assert.equal(representation.name, "Agent Name");
  assert.equal(representation.email, "agent@example.test");
  assert.equal(representation.accessKey, undefined);
  assert.equal(representation._id, undefined);
  assert.equal(typeof representation.id, "string");
});

test("defines the unique email index and version key", () => {
  const loginIndex = User.schema
    .indexes()
    .find(([fields]) => fields.email === 1);

  assert.equal(loginIndex?.[1].unique, true);
  assert.equal(User.schema.options.versionKey, "version");
  assert.equal(User.schema.options.optimisticConcurrency, true);
  assert.equal(User.schema.path("accessKey").options.select, false);
  assert.equal(User.schema.path("refreshKeyHash").options.select, false);
});

test("does not hash an access key digest again in database queries", () => {
  const accessKeyHash = hashAccessKey("authentication-adapter-reference");
  const query = User.findOne({ accessKey: accessKeyHash });
  query.cast(User);

  assert.equal(query.getQuery().accessKey, accessKeyHash);
});
