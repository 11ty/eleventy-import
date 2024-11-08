import { DataSource } from "../DataSource.js";

class Rss extends DataSource {
	static TYPE = "rss";
	static TYPE_FRIENDLY = "RSS";

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
		if(Array.isArray(data.rss?.channel?.item)) {
			return data.rss.channel.item;
		}

		if(data.rss?.channel?.item) {
			return [data.rss.channel.item];
		}

		return [];
	}

	getUniqueIdFromEntry(entry) {
		return `${DataSource.UUID_PREFIX}::${Rss.TYPE}::${entry.guid["#text"]}`;
	}

	cleanEntry(entry, data) {
		let authors = [];
		// https://www.rssboard.org/rss-profile#namespace-elements-dublin-creator
		if(Array.isArray(entry['dc:creator'])) {
			for(let name of entry['dc:creator']) {
				authors.push({ name });
			}
		} else if(entry['dc:creator']) {
			authors.push({ name: entry['dc:creator'] });
		} else {
			authors.push({
				name: data.rss.channel.title,
				url: data.rss.channel.link,
			});
		}

		return {
			uuid: this.getUniqueIdFromEntry(entry),
			type: Rss.TYPE,
			title: entry.title || this.toReadableDate(entry.pubDate),
			url: entry.link,
			authors,
			date: this.toIsoDate(entry.pubDate),
			// dateUpdated: entry.updated,
			content: entry["content:encoded"] || entry.content || entry.description,
			// contentType: "", // unknown
		}
	}
}

export {Rss};
