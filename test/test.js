import test from 'node:test';
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

import { Importer } from "../src/Importer.js";

const require = createRequire(import.meta.url);

test("YouTube user", async (t) => {
	let importer = new Importer();

	importer.setVerbose(false);
	importer.setDryRun(true);

	importer.addSource("youtubeUser", "UCskGTioqrMBcw8pd14_334A");

	let stubContent = fs.readFileSync("./test/sources/youtube-user.xml");
	importer.addDataOverride("wordpress", "https://www.youtube.com/feeds/videos.xml?channel_id=UCskGTioqrMBcw8pd14_334A", stubContent);

	let entries = await importer.getEntries();
	assert.equal(entries.length, 15);

	let [post] = entries;
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "contentType", "date", "dateUpdated", "title", "type", "url", "uuid"]);
	assert.equal(post.content.length, 812);
	assert.equal(post.authors[0].name, "Eleventy");
});

test("WordPress import", async (t) => {

	let importer = new Importer();

	importer.setVerbose(false);
	importer.setDryRun(true);

	importer.addSource("wordpress", "https://blog.fontawesome.com/");

	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=1&per_page=100&status=publish%2Cdraft", require("./sources/blog-awesome-posts.json"));
	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=2&per_page=100&status=publish%2Cdraft", []);
	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/categories/1", require("./sources/blog-awesome-categories.json"));
	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/users/155431370", require("./sources/blog-awesome-author.json"));

	let entries = await importer.getEntries();
	assert.equal(entries.length, 1);

	let [post] = entries;
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "contentType", "date", "dateUpdated", "metadata", "status", "title", "type", "url", "uuid"]);
	assert.equal(post.content.length, 6144);
	assert.equal(post.authors[0].name, "Matt Johnson");
});
