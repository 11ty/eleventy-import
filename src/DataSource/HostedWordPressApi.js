import { DataSource } from "../DataSource.js";

class HostedWordPressApi extends DataSource {
	static TYPE = "wordpressapi-hosted";
	static TYPE_FRIENDLY = "Hosted WordPress";

	static #getHostname(url) {
		try {
			let u = new URL(url);
			return u.hostname;
		} catch(e) {}
		return "";
	}

	static isValid(url) {
		let hostname = this.#getHostname(url);
		return hostname.endsWith(".wordpress.com");
	}

	constructor(url) {
		super();
		this.url = url;

		if(!HostedWordPressApi.isValid(url)) {
			throw new Error("HostedWordPressApi expects a .wordpress.com URL, if you’re looking to use a self-hosted WordPress API please use the `wordpress` type (`WordPressApi` class).");
		}

		this.hostname = HostedWordPressApi.#getHostname(url);
	}

	getType() {
		return "json";
	}

	getUrl() {
		// return function for paging
		return (pageNumber = 1) => {
			// DRAFTS NOT SUPPORTED
			return `https://public-api.wordpress.com/rest/v1.1/sites/${this.hostname}/posts/?page=${pageNumber}&per_page=100`;
		};
	}

	getEntriesFromData(data) {
		return data.posts || [];
	}

	getUrlFromEntry(entry) {
		return entry.URL;
	}

	getUniqueIdFromEntry(entry) {
		return `${DataSource.UUID_PREFIX}::${HostedWordPressApi.TYPE}::${entry.guid}`;
	}

	// stock WordPress is single-author
	#getAuthorData(author) {
		return [
			{
				name: author.name,
				url: author.profile_URL,
				avatarUrl: author.avatar_URL,
			}
		];
	}

	async cleanEntry(entry, data) {
		let metadata = {
			categories: Object.keys(entry.categories),
			tags: Object.keys(entry.tags),
		};

		if(entry.featured_image) {
			// TODO opengraphImage: { width, height, src, mime }
			let featuredImage = this.fetcher.fetchImage(entry.featured_image, this.outputFolder);
			metadata.featuredImage = featuredImage.url;
		}

		return {
			uuid: this.getUniqueIdFromEntry(entry),
			type: HostedWordPressApi.TYPE,
			title: entry.title,
			url: this.getUrlFromEntry(entry),
			authors: this.#getAuthorData(entry.author),
			date: entry.date,
			dateUpdated: entry.modified,
			content: entry.content,
			status: this.cleanStatus(entry.status),
			metadata,
		}
	}
}

export { HostedWordPressApi };
