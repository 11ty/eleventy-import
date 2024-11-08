import path from "node:path";
import fs from "graceful-fs";
import { createHash } from "node:crypto";
import kleur from "kleur";
import { XMLParser } from "fast-xml-parser";

import EleventyFetch from "@11ty/eleventy-fetch";
import { Logger } from "./Logger.js";

// 255 total (hash + url + extension)
const HASH_FILENAME_MAXLENGTH = 12;
const MAXIMUM_URL_FILENAME_SIZE = 30;

const xmlParser = new XMLParser({
	attributeNamePrefix : "@_",
	ignoreAttributes: false,
	allowBooleanAttributes: true,
	parseAttributeValue: true,
});

class Fetcher {
	static USER_AGENT = "Eleventy Import v1.0.0";

	static getFilenameFromSrc(src) {
		let {pathname} = new URL(src);
		let hash = this.createHash(src);

		let filename = pathname.split("/").pop();
		let lastDot = filename.lastIndexOf(".");

		if(lastDot > -1) {
			let filenameWithoutExtension = filename.slice(0, Math.min(lastDot, MAXIMUM_URL_FILENAME_SIZE));
			let extension = filename.slice(lastDot + 1);
			return `${filenameWithoutExtension}-${hash}.${extension}`;
		}

		return `${filename.slice(0, MAXIMUM_URL_FILENAME_SIZE)}-${hash}`;
	}

	static createHash(str) {
		let base64Hash = createHash("sha256").update(str).digest("base64");

		return base64Hash.replace(/[^A-Z0-9]/gi, "").slice(0, HASH_FILENAME_MAXLENGTH);
	}

	#cacheDuration = "0s";
	#directoryManager;

	constructor() {
		this.fetchedUrls = new Set();
		this.writtenAssetFiles = new Set();
		this.errors = new Set();
		this.isVerbose = true;
		this.dryRun = false;
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);
	}

	setDryRun(isDryRun) {
		this.dryRun = Boolean(isDryRun);
	}

	getCounts() {
		let total = this.fetchedUrls.size;
		let assets = this.writtenAssetFiles.size;

		return {
			fetches: {
				data: total - assets,
				assets,
			},
			errors: this.errors.size,
		}
	}

	setCacheDuration(duration) {
		this.#cacheDuration = duration;
	}

	setDirectoryManager(manager) {
		this.#directoryManager = manager;
	}

	fetchAsset(url, outputFolder, urlPath = "assets") {
		let filename = Fetcher.getFilenameFromSrc(url);
		let assetUrlLocation = path.join(urlPath, filename);
		let fullOutputLocation = path.join(outputFolder, assetUrlLocation);

		let promise;
		if(!this.writtenAssetFiles.has(fullOutputLocation)) {
			this.writtenAssetFiles.add(fullOutputLocation);

			if(this.#directoryManager) {
				this.#directoryManager.createDirectoryForPath(fullOutputLocation);
			}

			// async, but we don’t need to wait
			promise = this.fetch(url, {
				type: "buffer",
			},
			{
				verbose: true,
				showErrors: true
			}).then(result => {
				if(result) {
					if(this.isVerbose) {
						Logger.importing("asset", fullOutputLocation, url, {
							size: result.length,
							dryRun: this.dryRun
						});
					}

					if(!this.dryRun) {
						fs.writeFileSync(fullOutputLocation, result);
					}
				}
			});
		}

		return {
			file: fullOutputLocation,
			url: `/${assetUrlLocation}`,
			promise: promise || Promise.resolve(),
		};
	}

	async fetch(url, options = {}, verbosity = {}) {
		let { verbose, showErrors } = Object.assign({
			showErrors: true,
			verbose: true, // log the fetch request?
		}, verbosity);

		let opts = Object.assign({
			duration: this.#cacheDuration,
			type: "text",
			verbose: false, // we’re doing our own logging
			fetchOptions: {},
		}, options);

		if(!this.fetchedUrls.has(url)) {
			let logAdds = [];
			if(Boolean(options?.fetchOptions?.headers?.Authorization)) {
				logAdds.push(kleur.blue("Auth"));
			}
			if(opts.duration) {
				logAdds.push(kleur.green(`(${opts.duration} cache)`));
			}
			if(this.isVerbose && verbose) {
				Logger.log(kleur.gray("Fetching"), url, logAdds.join(" ") );
			}
			this.fetchedUrls.add(url);
		}

		if(!opts.fetchOptions.headers) {
			opts.fetchOptions.headers = {};
		}
		Object.assign(opts.fetchOptions.headers, {
			"user-agent": Fetcher.USER_AGENT
		});

		try {
			let result = await EleventyFetch(url, opts);

			if(opts.type === "xml") {
				return xmlParser.parse(result);
			}

			return result;
		} catch(e) {
			this.errors.add(url);

			// if(this.isVerbose && showErrors) {
			if(showErrors) {
				Logger.log(kleur.red(`Error fetching`), url, kleur.red(e.message));
			}

			return Promise.reject(e);
		}
	}
}

export { Fetcher };
