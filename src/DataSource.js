import kleur from 'kleur';

import { Logger } from "./Logger.js";

class DataSource {
	static UUID_PREFIX = "11ty/import";

	#fetcher;
	#fetchDataOverrides = {};
	#outputFolder = ".";

	constructor() {
		this.isVerbose = true;
	}

	setVerbose(isVerbose) {
		this.isVerbose = isVerbose;
	}

	setFetcher(fetcher) {
		this.#fetcher = fetcher;
	}

	get fetcher() {
		if(!this.#fetcher) {
			throw new Error("Missing Fetcher instance.");
		}
		return this.#fetcher;
	}

	// For testing
	setDataOverride(url, data) {
		this.#fetchDataOverrides[url] = data;
	}

	setLabel(label) {
		this.label = label;
	}

	setFilepathFormatFunction(format) {
		if(typeof format !== "function") {
			throw new Error("filepathFormat option expected to be a function.");
		}
		this.filepathFormat = format;
	}

	getFilepathFormatFunction() {
		return this.filepathFormat;
	}

	isValidHttpUrl(url) {
		try {
			new URL(url);
			return url.startsWith("https://") || url.startsWith("http://");
		} catch(e) {
			// invalid url OR local path
			return false;
		}
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
	}

	get outputFolder() {
		return this.#outputFolder;
	}

	toIsoDate(dateStr) {
		return (new Date(Date.parse(dateStr))).toISOString();
	}

	toReadableDate(dateStr, locale = 'en-US', options = {}) {
		options = Object.assign({
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
			timeZoneName: "short",
		}, options);

		let date = (new Date(Date.parse(dateStr)));
		return new Intl.DateTimeFormat(locale, options).format(date)
	}

	getHeaders() {
		return {};
	}

	getUniqueIdFromEntry() {
		return "";
	}

	// Thanks to https://stackoverflow.com/questions/7467840/nl2br-equivalent-in-javascript/7467863#7467863
	static nl2br(str) {
		if (typeof str === 'undefined' || str === null) {
			return "";
		}
		return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
	}

	async getData(url, type, showErrors = true) {
		// For testing, all urls must be stubbed
		if(Object.keys(this.#fetchDataOverrides).length > 0) {
			if(this.#fetchDataOverrides[url]) {
				return this.#fetchDataOverrides[url];
			}

			throw new Error("Testing error, missing data override url: " + url);
		}

		return this.fetcher.fetch(url, {
			type,
			fetchOptions: {
				headers: this.getHeaders(),
			},
		}, {
			verbose: true,
			showErrors
		});
	}

	async getCleanedEntries(data) {
		// data should be iterable
		let dataEntries = data;
		if(typeof this.getEntriesFromData === "function") {
			dataEntries = this.getEntriesFromData(data) || [];
		}

		let entries = [];
		for(let entry of dataEntries) {
			if(typeof this.cleanEntry === "function") {
				let cleaned = await this.cleanEntry(entry, data);
				entries.push(cleaned);
			} else {
				entries.push(entry)
			}
		}

		return entries;
	}

	async getEntries() {
		let entries = [];
		if(typeof this.getUrl === "function") {
			let url = this.getUrl();
			if(typeof url === "function") {
				let pageNumber = 1;
				let pagedUrl;

				try {
					while(pagedUrl = url(pageNumber)) {
						let found = 0;
						let data = await this.getData(pagedUrl, this.getType(), false);
						for(let entry of await this.getCleanedEntries(data)) {
							entries.push(entry);
							found++;
						}

						if(found === 0) {
							break;
						}

						pageNumber++;
					}
				} catch(e) {
					let shouldWorry = await this.isErrorWorthWorryingAbout(e);
					if(shouldWorry) {
						Logger.error(kleur.red(`Error: ${e.message}`), e);
						throw e;
					}
				}
			} else if(typeof url === "string" || url instanceof URL) {
				let data = await this.getData(url, this.getType(), true);
				for(let entry of await this.getCleanedEntries(data) || []) {
					entries.push(entry);
				}
			}
		} else if(typeof this.getData === "function") {
			let data = this.getData() || {};
			for(let entry of await this.getCleanedEntries(data) || []) {
				entries.push(entry);
			}
		}

		return entries.map(entry => {
			// TODO check uuid uniqueness

			if(this.label) {
				entry.sourceLabel = this.label;
			}

			// create Date objects
			if(entry.date) {
				entry.date = new Date(Date.parse(entry.date));
			}

			if(entry.dateUpdated) {
				entry.dateUpdated = new Date(Date.parse(entry.dateUpdated));
			}

			Object.defineProperty(entry, "source", {
				enumerable: false,
				value: this,
			});

			return entry;
		});
	}

	cleanStatus(status) {
		// WordPress has draft/publish
		// For future use
		return status;
	}
}

export { DataSource };
