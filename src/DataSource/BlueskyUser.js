import path from "node:path";
import { DataSource } from "../DataSource.js";

class BlueskyUser extends DataSource {
	static TYPE = "bluesky";
	static TYPE_FRIENDLY = "Bluesky";

	#username;

	constructor(username) {
		super();
		this.username = username;
	}

	set username(username) {
		if(username.startsWith("@")) {
			this.#username = username.slice(1);
		} else {
			this.#username = username;
		}
	}

	get username() {
		return this.#username;
	}

	getType() {
		return "xml";
	}

	getUrl() {
		return `https://bsky.app/profile/${this.username}/rss`
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
		return `${DataSource.UUID_PREFIX}::${BlueskyUser.TYPE}::${entry.link}`;
	}

	static getFilePath(url) {
		let {pathname} = new URL(url);
		let [empty, profile, username, post, id] = pathname.split("/");
		return path.join(username, id);
	}

	cleanEntry(entry, data) {
		return {
			uuid: this.getUniqueIdFromEntry(entry),
			type: BlueskyUser.TYPE,
			title: this.toReadableDate(entry.pubDate),
			url: entry.link,
			authors: [
				{
					name: data.rss.channel.title,
					url: data.rss.channel.link,
				}
			],
			date: this.toIsoDate(entry.pubDate),
			content: entry.description,
			contentType: "text",
		}
	}
}

export { BlueskyUser };
