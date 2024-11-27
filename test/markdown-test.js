import "dotenv/config";
import test from 'node:test';
import assert from "node:assert/strict";

import { MarkdownToHtml } from "../src/MarkdownToHtml.js";

const sampleEntry = {
	filePath: "/index.md"
};

test("Markdown Code", async (t) => {
	let md = new MarkdownToHtml();

	assert.equal(await md.toMarkdown(`&lt;div&gt;`, sampleEntry), `\\<div>`);
	assert.equal(await md.toMarkdown(`This is a &lt;div&gt;`, sampleEntry), `This is a \\<div>`);
	assert.equal(await md.toMarkdown(`<div>This is a test</div>`, sampleEntry), `This is a test`);
});

test("Markdown HTML", async (t) => {
	let md = new MarkdownToHtml();

	assert.equal(await md.toMarkdown(`This is a <del>test</del>`, sampleEntry), `This is a <del>test</del>`);
	assert.equal(await md.toMarkdown(`This is a <ins>test</ins>`, sampleEntry), `This is a <ins>test</ins>`);
	assert.equal(await md.toMarkdown(`<table><tbody><tr><td></td></tr></tbody></table>`, sampleEntry), `<table><tbody><tr><td></td></tr></tbody></table>`);
});
