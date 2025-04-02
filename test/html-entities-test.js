import test from 'node:test';
import assert from "node:assert/strict";
import * as entities from "entities";

test("Escape an attribute", async (t) => {
	assert.equal(entities.escapeAttribute("test"), `test`);
	assert.equal(entities.escapeAttribute("test\ntest"), `test\ntest`);
});
