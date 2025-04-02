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

test("newlines in <img alt>", async (t) => {
	let md = new MarkdownToHtml();

	assert.equal(await md.toMarkdown(`<img data-recalc-dims="1" loading="lazy" decoding="async" width="720" height="236" data-attachment-id="8293" data-permalink="https://blog.fontawesome.com/?attachment_id=8293" data-orig-file="https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?fit=1920%2C630&amp;ssl=1" data-orig-size="1920,630" data-comments-opened="1" data-image-meta="{&quot;aperture&quot;:&quot;0&quot;,&quot;credit&quot;:&quot;&quot;,&quot;camera&quot;:&quot;&quot;,&quot;caption&quot;:&quot;&quot;,&quot;created_timestamp&quot;:&quot;0&quot;,&quot;copyright&quot;:&quot;&quot;,&quot;focal_length&quot;:&quot;0&quot;,&quot;iso&quot;:&quot;0&quot;,&quot;shutter_speed&quot;:&quot;0&quot;,&quot;title&quot;:&quot;&quot;,&quot;orientation&quot;:&quot;0&quot;}" data-image-title="v7-announce-plans" data-image-description="" data-image-caption="" data-medium-file="https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?fit=1%2C1&amp;ssl=1" data-large-file="https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?fit=1%2C1&amp;ssl=1" src="https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?resize=720%2C236&#038;ssl=1" alt="Graphic of new Pro+ plans:\n\nPro Lite+: Everything in our online-only Pro Lite plan plus all our Pro+ icons and more custom icons, Kits,\nand pageviews.\n\nPro+: Everything in our Pro plan plus all our Pro+  icons and more custom icons, Kits, pageviews,\nand bandwidth.\n\nPro Max+: Everything in our Pro Max plan plus all our Pro+ icons, and even more pageviews and bandwidth." class="wp-image-8293" srcset="https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?w=1920&amp;ssl=1 1920w, https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?w=1440&amp;ssl=1 1440w" sizes="auto, (max-width: 720px) 100vw, 720px" />`, sampleEntry), `![Graphic of new Pro+ plans: Pro Lite+: Everything in our online-only Pro Lite plan plus all our Pro+ icons and more custom icons, Kits, and pageviews. Pro+: Everything in our Pro plan plus all our Pro+  icons and more custom icons, Kits, pageviews, and bandwidth. Pro Max+: Everything in our Pro Max plan plus all our Pro+ icons, and even more pageviews and bandwidth.](https://i0.wp.com/blog.fontawesome.com/wp-content/uploads/2025/03/v7-announce-plans-1.png?w=1440&ssl=1)`);
});

