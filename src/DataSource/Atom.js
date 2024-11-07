import { DataSource } from "../DataSource.js";

class Atom extends DataSource {
	static TYPE = "atom";
	static TYPE_FRIENDLY = "Atom";

	constructor(url) {
		super();
		this.url = url;
	}

	getType() {
		return "xml";
	}

	getUrl() {
		return this.url;
	}

	getEntriesFromData(data) {
		if(Array.isArray(data.feed?.entry)) {
			return data.feed.entry;
		}

		if(data.feed?.entry) {
			return [data.feed.entry];
		}

		return [];
	}

	getUrlFromEntry(entry) {
		if(this.isValidHttpUrl(entry.id)) {
			return entry.id;
		}
		if(entry.link && entry.link["@_rel"] === "alternate" && entry.link["@_href"] && this.isValidHttpUrl(entry.link["@_href"])) {
			return entry.link["@_href"];
		}
		return entry.id;
	}

	getUniqueIdFromEntry(entry) {
		// id is a unique URL
		return `${DataSource.UUID_PREFIX}::${Atom.TYPE}::${entry.id}`;
	}

	cleanEntry(entry, data) {
		let authors = [];
		if(Array.isArray(entry?.author)) {
			authors = entry.author.map(author => ({ name: author }));
		} else {
			authors.push({
				name: entry?.author?.name || data.feed?.author?.name,
			});
		}

		return {
			uuid: this.getUniqueIdFromEntry(entry),
			type: Atom.TYPE,
			title: entry.title,
			url: this.getUrlFromEntry(entry),
			authors,
			date: entry.published || entry.updated,
			dateUpdated: entry.updated,
			content: entry.content["#text"],
		}
	}
}

export {Atom};
