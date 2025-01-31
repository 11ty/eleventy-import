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

test("Keep <i> elements with `fa-` classes", async (t) => {
	let md = new MarkdownToHtml();

	assert.equal(await md.toMarkdown(`This is an icon  <i class="fas fa-sparkles"></i>`, sampleEntry), `This is an icon<i class="fas fa-sparkles"></i>`);
	assert.equal(await md.toMarkdown(`This is an icon <i class="fas fa-sparkles"></i>`, sampleEntry), `This is an icon<i class="fas fa-sparkles"></i>`);
	assert.equal(await md.toMarkdown(`This is an icon<i class="fas fa-sparkles"></i>`, sampleEntry), `This is an icon<i class="fas fa-sparkles"></i>`);
	assert.equal(await md.toMarkdown(`<i class="fas fa-sparkles"></i>  This is an icon`, sampleEntry), `<i class="fas fa-sparkles"></i>This is an icon`);
	assert.equal(await md.toMarkdown(`<i class="fas fa-sparkles"></i> This is an icon`, sampleEntry), `<i class="fas fa-sparkles"></i>This is an icon`);
	assert.equal(await md.toMarkdown(`<i class="fas fa-sparkles"></i>This is an icon`, sampleEntry), `<i class="fas fa-sparkles"></i>This is an icon`);
});

test("Keep <i> elements with `fa-` classes (nested) in an empty parent", async (t) => {
	let md = new MarkdownToHtml();

	assert.equal(await md.toMarkdown(`<p class="has-text-align-center has-text-color has-link-color has-x-large-font-size wp-elements-007b58a50552546af72f2ebf87b1b426" style="color:#e599f7"><i class="fas fa-sparkles"></i></p>`, sampleEntry), `<i class="fas fa-sparkles"></i>`);

	assert.equal(await md.toMarkdown(`<div><p class="has-text-align-center has-text-color has-link-color has-x-large-font-size wp-elements-007b58a50552546af72f2ebf87b1b426" style="color:#e599f7"><i class="fas fa-sparkles"></i></p></div>`, sampleEntry), `<i class="fas fa-sparkles"></i>`);
});

test("If the <i> has content, italics takes precedence", async (t) => {
	let md = new MarkdownToHtml();
	assert.equal(await md.toMarkdown(`<i class="fas fa-sparkles">Testing</i>`, sampleEntry), `_Testing_`);
});

test("Preserve other classes", async (t) => {
	let md = new MarkdownToHtml();
	md.addPreservedSelector(".c-button--primary");

	assert.equal(await md.toMarkdown(`<a href="https://www.podcastawesome.com/" class="c-button c-button--primary" class="wp-block-fontawesome-blog-icon-button"><i class="fas fa-arrow-right c-button__icon"></i>Listen to the Full Episode!</a>`, sampleEntry), `<a href="https://www.podcastawesome.com/" class="c-button c-button--primary"><i class="fas fa-arrow-right c-button__icon"></i>Listen to the Full Episode!</a>`);
});

