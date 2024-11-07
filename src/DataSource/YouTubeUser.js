import { DataSource } from "../DataSource.js";

class YouTubeUser extends DataSource {
	static TYPE = "youtube";
	static TYPE_FRIENDLY = "YouTube";

	constructor(channelId) {
		super();
		this.channelId = channelId;
	}

	getType() {
		return "xml";
	}

	getUrl() {
		return `https://www.youtube.com/feeds/videos.xml?channel_id=${this.channelId}`
	}

	getEntriesFromData(data) {
		return data.feed?.entry || [];
	}

	getUniqueIdFromEntry(entry) {
		return `${DataSource.UUID_PREFIX}::${YouTubeUser.TYPE}::${entry['yt:videoId']}`;
	}

	static getFilePath(url) {
		let { searchParams } = new URL(url);
		return searchParams.get("v");
	}

	cleanEntry(entry) {
		return {
			uuid: this.getUniqueIdFromEntry(entry),
			type: YouTubeUser.TYPE,
			title: entry.title,
			url: `https://www.youtube.com/watch?v=${entry['yt:videoId']}`,
			authors: [
				{
					name: entry.author.name,
					url: entry.author.uri,
				}
			],
			date: entry.published,
			dateUpdated: entry.updated,
			// TODO linkify, nl2br
			content: entry['media:group']['media:description'],
		}
	}
}

export {YouTubeUser};
