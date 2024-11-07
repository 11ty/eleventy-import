import test from 'node:test';
import assert from "node:assert/strict";
import { Importer } from '../src/Importer.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "date", "dateUpdated", "metadata", "status", "title", "type", "url", "uuid"]);
	assert.equal(post.content.length, 7734);
	assert.equal(post.authors[0].name, "Matt Johnson");
});
