import "dotenv/config";
import test from 'node:test';
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

import { Importer } from "../src/Importer.js";
import { DataSource } from "../src/DataSource.js";
import { Persist } from "../src/Persist.js";

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
	assert.deepEqual(Object.keys(post).sort(), ["authors", "content", "contentType", "date", "dateUpdated", "metadata", "status", "title", "type", "url", "uuid"]);
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
			return [{ lol: "hi" }];
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

test("Persist constructor", async (t) => {
	let p = new Persist();
	assert.throws(() => p.setTarget("gitlab:11ty/eleventy"), {
		message: "Invalid persist type: gitlab"
	});
});
