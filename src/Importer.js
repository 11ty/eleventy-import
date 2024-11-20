import path from "node:path";
import { createRequire } from "node:module";
import fs from "graceful-fs";
import yaml from "js-yaml";
import kleur from "kleur";
import slugify from '@sindresorhus/slugify';

import { Logger } from "./Logger.js";
import { Fetcher } from "./Fetcher.js";
import { DirectoryManager } from "./DirectoryManager.js";
import { MarkdownToHtml } from "./MarkdownToHtml.js";
import { HtmlTransformer } from "./HtmlTransformer.js";
import { Persist } from "./Persist.js";

// Data Sources
import { DataSource } from "./DataSource.js";
import { YouTubeUser } from "./DataSource/YouTubeUser.js";
import { Atom } from "./DataSource/Atom.js";
import { Rss } from "./DataSource/Rss.js";
import { WordPressApi } from "./DataSource/WordPressApi.js";
import { BlueskyUser } from "./DataSource/BlueskyUser.js";
import { FediverseUser } from "./DataSource/FediverseUser.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// For testing
const MAX_IMPORT_SIZE = 0;

class Importer {
	#draftsFolder = "drafts";
	#outputFolder = ".";

	constructor() {
		this.startTime = new Date();
		this.sources = [];
		this.isVerbose = true;
		this.dryRun = false;
		this.safeMode = true;
		this.counts = {
			files: 0
		};

		this.markdownService = new MarkdownToHtml();
		this.htmlTransformer = new HtmlTransformer();
		this.directoryManager = new DirectoryManager();
		this.persistManager = new Persist();
		this.fetcher = new Fetcher();

		this.htmlTransformer.setFetcher(this.fetcher);

		this.fetcher.setDirectoryManager(this.directoryManager);
		this.fetcher.setPersistManager(this.persistManager);
	}

	getCounts() {
		return {
			...this.counts,
			...this.fetcher.getCounts(),
			...this.markdownService.getCounts(),
			...this.persistManager.getCounts()
		}
	}

	setSafeMode(safeMode) {
		this.safeMode = Boolean(safeMode);

		this.fetcher.setSafeMode(safeMode);
	}

	setDryRun(isDryRun) {
		this.dryRun = Boolean(isDryRun);

		this.fetcher.setDryRun(isDryRun);
		this.directoryManager.setDryRun(isDryRun);
		this.persistManager.setDryRun(isDryRun);
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);

		this.fetcher.setVerbose(isVerbose);
		this.markdownService.setVerbose(isVerbose);
		this.persistManager.setVerbose(isVerbose);

		for(let source of this.sources) {
			source.setVerbose(isVerbose);
		}
	}

	setAssetsFolder(folder) {
		this.fetcher.setAssetsFolder(folder);
	}

	setDraftsFolder(dir) {
		this.#draftsFolder = dir;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
		this.htmlTransformer.setOutputFolder(dir);
		this.markdownService.setOutputFolder(dir);
	}

	setCacheDuration(duration) {
		if(duration) {
			this.fetcher.setCacheDuration(duration);
		}
	}

	setPersistTarget(persistTarget) {
		this.persistManager.setTarget(persistTarget);
	}

	addSource(type, options = {}) {
		let cls;
		if(typeof type === "string") {
			type = type?.toLowerCase();

			if(type === "youtubeuser") {
				cls = YouTubeUser;
			} else if(type === "atom") {
				cls = Atom;
			} else if(type === "rss") {
				cls = Rss;
			} else if(type === "wordpress") {
				cls = WordPressApi;
			} else if(type === "bluesky") {
				cls = BlueskyUser; // RSS
			} else if(type === "fediverse") {
				cls = FediverseUser; // RSS
			}
		} else if(typeof type === "function") {
			cls = type;
		}

		if(!cls) {
			throw new Error(`${type} is not a supported type for addSource(). Requires a string type or a DataSource class.`);
		}

		let identifier;
		let label;
		let filepathFormat;

		if(typeof options === "string") {
			identifier = options;
		} else {
			identifier = options.url || options.id;
			label = options.label;
			filepathFormat = options.filepathFormat;
		}

		let source = new cls(identifier);

		if(!(source instanceof DataSource)) {
			throw new Error(`${cls?.name} is not a supported type for addSource(). Requires a string type or a DataSource class.`);
		}

		source.setFetcher(this.fetcher);
		source.setVerbose(this.isVerbose);

		if(this.#outputFolder) {
			source.setOutputFolder(this.#outputFolder);
		}

		if(label) {
			source.setLabel(label);
		}

		if(filepathFormat) {
			source.setFilepathFormatFunction(filepathFormat);
		}

		this.sources.push(source);
	}

	getSources() {
		return this.sources;
	}

	getSourcesForType(type) {
		return this.sources.filter(entry => entry.constructor.TYPE === type);
	}

	addDataOverride(type, url, data) {
		for(let source of this.getSourcesForType(type)) {
			source.setDataOverride(url, data);
		}
	}

	static isHtml(entry) {
		// TODO add a CLI override for --importContentType?
		// TODO add another path to guess if content is HTML https://mimesniff.spec.whatwg.org/#identifying-a-resource-with-an-unknown-mime-type
		return entry.contentType === "html";
	}

	async getEntries(options = {}) {
		let entries = [];
		for(let source of this.sources) {
			for(let entry of await source.getEntries()) {
				let contentType = entry.contentType;
				if(Importer.isHtml(entry) && options.contentType === "markdown") {
					contentType = "markdown";
				}

				entry.filePath = this.getFilePath(entry, contentType);

				entries.push(entry);
			}
		}

		if(MAX_IMPORT_SIZE) {
			entries = entries.slice(0, MAX_IMPORT_SIZE);
		}

		let promises = await Promise.allSettled(entries.map(async entry => {
			if(Importer.isHtml(entry)) {
				entry.content = await this.htmlTransformer.transform(entry.content, entry);

				if(options.contentType === "markdown") {
					entry.content = await this.markdownService.toMarkdown(entry.content, entry.url);
					entry.contentType = "markdown";
				}
			}

			return entry;
		}));

		if(!this.dryRun) {
			this.markdownService.cleanup();
		}

		return promises.filter(entry => {
			// Documents with errors
			return entry.status !== "rejected";
		}).map(entry => {
			return entry.value;
		}).sort((a, b) => {
			if(a.date < b.date) {
				return 1;
			}
			if(a.date > b.date) {
				return -1;
			}
			return 0;
		});
	}

	getFilePath(entry, contentType) {
		let { url } = entry;

		let source = entry.source;

		// prefer addSource specific override, then fallback to DataSource type default
		let fallbackPath;
		let hasFilePathFallback = typeof source?.constructor?.getFilePath === "function";
		if(hasFilePathFallback) {
			fallbackPath = source?.constructor?.getFilePath(url);
		} else {
			fallbackPath = (new URL(url)).pathname;
		}

		let outputOverrideFn = source?.getFilepathFormatFunction();
		if(outputOverrideFn && typeof outputOverrideFn === "function") { // entry override
			let pathname = outputOverrideFn(url, fallbackPath);
			if(pathname === false) {
				return false;
			}

			// does *not* add a file extension for you
			return path.join(this.#outputFolder, pathname);
		}

		// WordPress drafts only have a UUID query param e.g. ?p=ID_NUMBER
		if(fallbackPath === "/") {
			fallbackPath = Fetcher.createHash(entry.url);
		}

		let subdirs = [];
		if(this.#outputFolder) {
			subdirs.push(this.#outputFolder);
		}
		if(this.#draftsFolder && entry.status === "draft") {
			subdirs.push(this.#draftsFolder);
		}

		let pathname = path.join(".", ...subdirs, path.normalize(fallbackPath));
		let extension = contentType === "markdown" ? ".md" : ".html";

		if(pathname.endsWith("/")) {
			return `${pathname.slice(0, -1)}${extension}`;
		}

		return `${pathname}${extension}`;
	}

	static convertEntryToYaml(entry) {
		let data = {};
		data.title = entry.title;
		data.authors = entry.authors;
		data.date = entry.date;
		data.metadata = entry.metadata || {};
		data.metadata.uuid = entry.uuid;
		data.metadata.type = entry.type;
		data.metadata.url = entry.url;

		// Eleventy specific options
		if(entry.status === "draft") {
			// Don’t write to file system in Eleventy
			data.permalink = false;
			data.draft = true;

			// TODO map metadata.categories and/or metadata.tags to Eleventy `tags`
		}

		if(entry.tags) {
			if(!Array.isArray(entry.tags)) {
				entry.tags = [entry.tags];
			}

			// slugify the tags
			data.tags = entry.tags.map(tag => slugify(tag));
		}

		// https://www.npmjs.com/package/js-yaml#dump-object---options-
		let frontMatter = yaml.dump(data, {
			// sortKeys: true,
			noCompatMode: true,
		});

		return frontMatter;
	}

	// TODO options.pathPrefix
	async toFiles(entries = []) {
		let filepathConflicts = {};

		for(let entry of entries) {
			let pathname = entry.filePath;
			if(pathname === false) {
				continue;
			}

			if(filepathConflicts[pathname]) {
				throw new Error(`Multiple entries attempted to write to the same place: ${pathname} (originally via ${filepathConflicts[pathname]})`);
			}
			filepathConflicts[pathname] = entry.url || true;

			let frontMatter = Importer.convertEntryToYaml(entry);
			let content = `---
${frontMatter}---
${entry.content}`;

			// File system operations
			// TODO use https://www.npmjs.com/package/diff to compare file contents and skip
			if(this.safeMode && fs.existsSync(pathname)) {
				if(this.isVerbose) {
					Logger.skipping("post", pathname, entry.url);
				}
				continue;
			}

			if(this.isVerbose) {
				Logger.importing("post", pathname, entry.url, {
					size: content.length,
					dryRun: this.dryRun
				});
			}

			if(!this.dryRun) {
				this.counts.files++;

				this.directoryManager.createDirectoryForPath(pathname);

				fs.writeFileSync(pathname, content, { encoding: "utf8" });
			}

			// Happens independent of file system (--dryrun or --overwrite)
			// Don’t persist if post is a draft
			if(entry.status !== "draft" && this.persistManager.canPersist()) {
				await this.persistManager.persistFile(pathname, content, {
					url: entry.url,
					type: "post",
				});
			}
		}
	}

	logResults() {
		let counts = this.getCounts();
		let sourcesDisplay = this.getSources().map(source => source.constructor.TYPE_FRIENDLY || source.constructor.TYPE).join(", ");
		let content = [];
		content.push(kleur.green("Wrote"));
		content.push(kleur.green(`${counts.files} ${Logger.plural(counts.files, "document")}`));
		content.push(kleur.green("and"));
		content.push(kleur.green(`${counts.assets - counts.cleaned} ${Logger.plural(counts.assets - counts.cleaned, "asset")}`));
		if(counts.cleaned) {
			content.push(kleur.gray(`(${counts.cleaned} cleaned, unused)`));
		}
		content.push(kleur.green(`from ${sourcesDisplay}`));
		if(counts.persist) {
			content.push(kleur.blue(`(${counts.persist} persisted)`));
		}
		content.push(kleur[counts.errors > 0 ? "red" : "gray"](`(${counts.errors} ${Logger.plural(counts.errors, "error")})`));
		if(this.startTime) {
			content.push(`in ${Logger.time(Date.now() - this.startTime)}`);
		}

		content.push(`(v${pkg.version})`);

		Logger.log(content.join(" "));
	}
}

export { Importer };
