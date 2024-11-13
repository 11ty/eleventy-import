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

// TODO use `type: "parsed-xml" type from Eleventy Fetch
const xmlParser = new XMLParser({
	attributeNamePrefix : "@_",
	ignoreAttributes: false,
	allowBooleanAttributes: true,
	parseAttributeValue: true,
});

class Fetcher {
	static USER_AGENT = "Eleventy Import v1.0.0";

	static getFilenameFromSrc(src, contentType = "") {
		let {pathname} = new URL(src);
		let hash = this.createHash(src);

		let filename = pathname.split("/").pop();
		let lastDot = filename.lastIndexOf(".");

		if(lastDot > -1) {
			let filenameWithoutExtension = filename.slice(0, Math.min(lastDot, MAXIMUM_URL_FILENAME_SIZE));
			let extension = filename.slice(lastDot + 1);
			return `${filenameWithoutExtension}-${hash}.${extension}`;
		}

		let [, fileExtensionFallback] = contentType.split("/");
		// No known file extension
		return `${filename.slice(0, MAXIMUM_URL_FILENAME_SIZE)}-${hash}${fileExtensionFallback ? `.${fileExtensionFallback}` : ""}`;
	}

	static createHash(str) {
		let base64Hash = createHash("sha256").update(str).digest("base64");

		return base64Hash.replace(/[^A-Z0-9]/gi, "").slice(0, HASH_FILENAME_MAXLENGTH);
	}

	#cacheDuration = "0s";
	#directoryManager;
	#assetsFolder = "assets";

	constructor() {
		this.fetchedUrls = new Set();
		this.writtenAssetFiles = new Set();
		this.errors = new Set();
		this.isVerbose = true;
		this.dryRun = false;
		this.safeMode = true;
		this.counts = {
			assets: 0,
		};
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);
	}

	setDryRun(isDryRun) {
		this.dryRun = Boolean(isDryRun);
	}

	setSafeMode(safeMode) {
		this.safeMode = Boolean(safeMode);
	}

	setAssetsFolder(folder) {
		this.#assetsFolder = folder;
	}

	getCounts() {
		return {
			assets: this.counts.assets,
			errors: this.errors.size,
		}
	}

	setCacheDuration(duration) {
		this.#cacheDuration = duration;
	}

	setDirectoryManager(manager) {
		this.#directoryManager = manager;
	}

	async fetchAsset(url, outputFolder) {
		// TODO move this upstream as a Fetch `alias` feature.
		return this.fetch(url, {
			type: "buffer",
			returnType: "response",
		},
		{
			verbose: true,
			showErrors: true,
		}).then(result => {
			let filename = Fetcher.getFilenameFromSrc(url, result.headers?.["content-type"]);
			let assetUrlLocation = path.join(this.#assetsFolder, filename);
			let fullOutputLocation = path.join(outputFolder, assetUrlLocation);
			let urlValue = `/${assetUrlLocation}`;

			if(this.writtenAssetFiles.has(fullOutputLocation)) {
				return urlValue;
			}

			this.writtenAssetFiles.add(fullOutputLocation);

			if(this.safeMode && fs.existsSync(fullOutputLocation)) {
				if(this.isVerbose) {
					Logger.skipping("asset", fullOutputLocation, url);
				}
				return urlValue;
			}

			if(this.#directoryManager) {
				this.#directoryManager.createDirectoryForPath(fullOutputLocation);
			}

			if(this.isVerbose) {
				Logger.importing("asset", fullOutputLocation, url, {
					size: result.body.length,
					dryRun: this.dryRun
				});
			}

			if(!this.dryRun) {
				this.counts.assets++;

				fs.writeFileSync(fullOutputLocation, result.body);
			}

			return urlValue;
		}, error => {
			// Logging the error happens in .fetch() upstream
			// Fetching the asset failed but we don’t want to fail the upstream document promise
			return "";
		});
	}

	async fetch(url, options = {}, verbosity = {}) {
		let { verbose, showErrors } = Object.assign({
			verbose: true, // whether to log the initial fetch request
			showErrors: true, // whether to show if a request has an error.
		}, verbosity);

		let opts = Object.assign({
			duration: this.#cacheDuration,
			type: "text",
			verbose: false, // don’t use Fetch logging—we’re handling it ourself
			fetchOptions: {},
		}, options);

		if(!opts.fetchOptions.headers) {
			opts.fetchOptions.headers = {};
		}
		Object.assign(opts.fetchOptions.headers, {
			"user-agent": Fetcher.USER_AGENT
		});

		if(!this.fetchedUrls.has(url) && this.isVerbose && verbose) {
			let logAdds = [];
			if(Boolean(options?.fetchOptions?.headers?.Authorization)) {
				logAdds.push(kleur.blue("Auth"));
			}
			if(opts.duration) {
				logAdds.push(kleur.green(`(${opts.duration} cache)`));
			}

			Logger.log(kleur.gray("Fetching"), url, logAdds.join(" ") );
		}

		this.fetchedUrls.add(url);

		return EleventyFetch(url, opts).then(result => {
			if(opts.type === "xml") {
				return xmlParser.parse(result);
			}

			return result;
		}, error => {
			this.errors.add(url);

			if(this.isVerbose && showErrors) {
				Logger.log(kleur.red(`Error fetching`), url, kleur.red(error.message));
			}

			return Promise.reject(error);
		});
	}
}

export { Fetcher };
