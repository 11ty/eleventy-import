import "dotenv/config";
import test from 'node:test';
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

import { Importer } from "../src/Importer.js";
import { DataSource } from "../src/DataSource.js";
import { Persist } from "../src/Persist.js";
import { Fetcher } from "../src/Fetcher.js";

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
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "contentType", "date", "dateUpdated", "filePath", "title", "type", "url", "uuid"]);
	assert.equal(post.content.length, 812);
	assert.equal(post.authors[0].name, "Eleventy");
});

test("WordPress import", async (t) => {

	let importer = new Importer();

	importer.setVerbose(false);
	importer.setDryRun(true);

	importer.addSource("wordpress", "https://blog.fontawesome.com/");

	if(process.env.WORDPRESS_USERNAME) {
		importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=1&per_page=100&status=publish%2Cdraft", require("./sources/blog-awesome-posts.json"));
		importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=2&per_page=100&status=publish%2Cdraft", []);
	} else {
		importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=1&per_page=100", require("./sources/blog-awesome-posts.json"));
		importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/posts/?page=2&per_page=100", []);
	}

	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/categories/1", require("./sources/blog-awesome-categories.json"));
	importer.addDataOverride("wordpress", "https://blog.fontawesome.com/wp-json/wp/v2/users/155431370", require("./sources/blog-awesome-author.json"));

	let entries = await importer.getEntries();
	assert.equal(entries.length, 1);

	let [post] = entries;
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "contentType", "date", "dateUpdated", "filePath", "metadata", "status", "title", "type", "url", "uuid"]);
	assert.equal(post.content.length, 6134);
	assert.equal(post.authors[0].name, "Matt Johnson");
});

test("addSource using DataSource", async (t) => {
	let importer = new Importer();

	importer.setVerbose(false);
	importer.setDryRun(true);

	class MySource extends DataSource {
		static TYPE = "arbitrary";
		static TYPE_FRIENDLY = "Arbitrary";

		getData() {
			return [{
				lol: "hi",
				url: "https://example.com/test/"
			}];
		}
	}

	importer.addSource(MySource);

	let entries = await importer.getEntries();
	assert.equal(entries.length, 1);
});

test("addSource needs to use DataSource", async (t) => {
	let importer = new Importer();

	importer.setVerbose(false);
	importer.setDryRun(true);

	assert.throws(() => {
		importer.addSource(class MySource {});
	}, {
		message: "MySource is not a supported type for addSource(). Requires a string type or a DataSource class."
	})
});

test("Persist parseTarget", async (t) => {
	assert.deepEqual(Persist.parseTarget("github:11ty/eleventy"), {
		type: "github",
		username: "11ty",
		repository: "eleventy",
		branch: undefined,
	});

	assert.deepEqual(Persist.parseTarget("github:11ty/eleventy#main"), {
		type: "github",
		username: "11ty",
		repository: "eleventy",
		branch: "main",
	});
});

test("Persist constructor (no token)", async (t) => {
	let p = new Persist();

	assert.throws(() => p.setTarget("gitlab:11ty/eleventy"), {
		// message: "Invalid persist type: gitlab"
		message: "Missing GITHUB_TOKEN environment variable."
	});
});

test("Persist constructor (gitlab)", async (t) => {
	let p = new Persist();
	process.env.GITHUB_TOKEN = "FAKE_TOKEN";

	assert.throws(() => p.setTarget("gitlab:11ty/eleventy"), {
		message: "Invalid persist type: gitlab"
	});
});

test("Fetcher asset location tests (relative)", async (t) => {
	let f = new Fetcher();

	let relative1 = f.getAssetLocation("https://example.com/test.png", "image/png", { filePath: "/test.html" });
	assert.deepEqual(relative1, {
		filePath: "assets/test-NzhbK6MSYu2g.png",
		url: "assets/test-NzhbK6MSYu2g.png",
	});

	let relativeNoExt = f.getAssetLocation("https://example.com/test", "image/png", { filePath: "/test.html" });
	assert.deepEqual(relativeNoExt, {
		filePath: "assets/test-m4HI5oTdgEt4.png",
		url: "assets/test-m4HI5oTdgEt4.png",
	});

	let relative2 = f.getAssetLocation("https://example.com/subdir/test.png", "image/png", { filePath: "localsubdirectory/test.html" });
	assert.deepEqual(relative2, {
		filePath: "localsubdirectory/assets/test-slaK8pecO8QR.png",
		url: "assets/test-slaK8pecO8QR.png",
	});
});

test("Fetcher asset location tests (absolute)", async (t) => {
	let f = new Fetcher();
	f.setUseRelativeAssetPaths(false);

	let abs1 = f.getAssetLocation("https://example.com/test.png", "image/png");
	assert.deepEqual(abs1, {
		filePath: "assets/test-NzhbK6MSYu2g.png",
		url: "/assets/test-NzhbK6MSYu2g.png",
	});
});
