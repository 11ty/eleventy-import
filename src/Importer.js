import path from "node:path";
import fs from "graceful-fs";
import yaml from "js-yaml";
import kleur from "kleur";

import { Logger } from "./Logger.js";
import { Fetcher } from "./Fetcher.js";
import { DirectoryManager } from "./DirectoryManager.js";
import { MarkdownToHtml } from "./MarkdownToHtml.js";
import { HtmlTransformer } from "./HtmlTransformer.js";
import { YouTubeUser } from "./DataSource/YouTubeUser.js";
import { Atom } from "./DataSource/Atom.js";
import { Rss } from "./DataSource/Rss.js";
import { WordPressApi } from "./DataSource/WordPressApi.js";
import { BlueskyUser } from "./DataSource/BlueskyUser.js";
import { FediverseUser } from "./DataSource/FediverseUser.js";

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
		this.fetcher = new Fetcher();

		this.htmlTransformer.setFetcher(this.fetcher);

		this.fetcher.setDirectoryManager(this.directoryManager);
	}

	setSafeMode(safeMode) {
		this.safeMode = Boolean(safeMode);

		this.fetcher.setSafeMode(safeMode);
	}

	setDryRun(isDryRun) {
		this.dryRun = Boolean(isDryRun);

		this.fetcher.setDryRun(isDryRun);
		this.directoryManager.setDryRun(isDryRun);
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);

		this.fetcher.setVerbose(isVerbose);

		for(let source of this.sources) {
			source.setVerbose(isVerbose);
		}
	}

	getCounts() {
		return {
			...this.counts,
			...this.fetcher.getCounts(),
		}
	}

	setDraftsFolder(dir) {
		this.#draftsFolder = dir;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
		this.htmlTransformer.setOutputFolder(dir);
	}

	setCacheDuration(duration) {
		if(duration) {
			this.fetcher.setCacheDuration(duration);
		}
	}

	addSource(type, options = {}) {
		type = type?.toLowerCase();

		let cls;
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
		} else {
			throw new Error(`${type} is not a supported type for addSource()`);
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
		// TODO add a CLI option for --importContentType?
		// TODO add another path to guess if content is HTML https://mimesniff.spec.whatwg.org/#identifying-a-resource-with-an-unknown-mime-type
		return entry.contentType === "html";
	}

	async getEntries(options = {}) {
		let entries = [];
		for(let source of this.sources) {
			for(let entry of await source.getEntries()) {
				entries.push(entry);
			}
		}

		if(MAX_IMPORT_SIZE) {
			entries = entries.slice(0, MAX_IMPORT_SIZE);
		}

		let promises = await Promise.allSettled(entries.map(async entry => {
			if(Importer.isHtml(entry)) {
				entry.content = await this.htmlTransformer.transform(entry.content, entry.url);

				if(options.contentType === "markdown") {
					entry.content = await this.markdownService.toMarkdown(entry.content, entry.url);
				}
			}

			if(options.contentType) {
				entry.contentType = options.contentType;
			}

			return entry;
		}));

		return promises.filter(entry => {
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

	getFilePath(entry) {
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
		let extension = entry.contentType === "markdown" ? ".md" : ".html";

		if(pathname.endsWith("/")) {
			return `${pathname.slice(0, -1)}${extension}`;
		}

		return `${pathname}${extension}`;
	}

	// TODO options.pathPrefix
	toFiles(entries = []) {
		let filepathConflicts = {};
		let filesWrittenCount = 0;

		for(let entry of entries) {
			let frontMatterData = Object.assign({}, entry);

			if(entry.status === "draft") {
				// Don’t write to file system in Eleventy
				frontMatterData.permalink = false;
				frontMatterData.draft = true;
			}

			// https://www.npmjs.com/package/js-yaml#dump-object---options-
			let frontMatter = yaml.dump(frontMatterData, {
				// sortKeys: true,
				noCompatMode: true,
				replacer: function(key, value) {
					// ignore these keys in front matter
					if(key === "content" || key === "contentType" || key === "dateUpdated") {
						return;
					}

					return value;
				}
			});

			let content = `---
${frontMatter}---
${entry.content}`

			let pathname = this.getFilePath(entry);
			if(pathname === false) {
				continue;
			}

			if(this.safeMode && fs.existsSync(pathname)) {
				if(this.isVerbose) {
					Logger.skipping("post", pathname, entry.url);
				}

				continue;
			}

			if(filepathConflicts[pathname]) {
				throw new Error(`Multiple entries attempted to write to the same place: ${pathname} (originally via ${filepathConflicts[pathname]})`);
			}
			filepathConflicts[pathname] = entry.url || true;

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

			filesWrittenCount++;
		}
	}

	logResults() {
		let counts = this.getCounts();
		let sourcesDisplay = this.getSources().map(source => source.constructor.TYPE_FRIENDLY || source.constructor.TYPE).join(", ");

		let content = [];
		content.push(kleur.green("Wrote"));
		content.push(kleur.green(Logger.plural(counts.files, "document")));
		content.push(kleur.green("and"));
		content.push(kleur.green(Logger.plural(counts.assets, "asset")));
		content.push(kleur.green(`from ${sourcesDisplay}`));
		content.push(kleur[counts.errors > 0 ? "red" : "gray"](`(${Logger.plural(counts.errors, "error")})`));
		if(this.startTime) {
			content.push(`in ${Logger.time(Date.now() - this.startTime)}`);
		}

		Logger.log(content.join(" "));
	}
}

export { Importer };
