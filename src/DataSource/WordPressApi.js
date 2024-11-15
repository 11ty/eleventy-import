import "dotenv/config"

import { DataSource } from "../DataSource.js";
import { HostedWordPressApi } from "./HostedWordPressApi.js"

class WordPressApi extends DataSource {
	static TYPE = "wordpress";
	static TYPE_FRIENDLY = "WordPress";
	static IGNORED_CATEGORIES = ["Uncategorized"];

	constructor(url) {
		if(HostedWordPressApi.isValid(url)) {
			return new HostedWordPressApi(url);
		}

		super();
		this.url = url;
	}

	// some pagination errors just mean there are no more pages
	async isErrorWorthWorryingAbout(e) {
		if(e?.cause instanceof Response) {
			let errorData = await e.cause.json();
			if(errorData?.code === "rest_post_invalid_page_number") {
				return false;
			}
		}

		return true;
	}

	getType() {
		return "json";
	}

	#getSubtypeUrl(subtype, suffix = "") {
		let {pathname} = new URL(this.url);
		return (new URL(pathname + `wp-json/wp/v2/${subtype}/${suffix}`, this.url)).toString();
	}

	#getAuthorUrl(id) {
		return this.#getSubtypeUrl("users", id);
	}

	#getCategoryUrl(id) {
		return this.#getSubtypeUrl("categories", id);
	}

	#getTagsUrl(id) {
		return this.#getSubtypeUrl("tags", id);
	}

	getUrl() {
		// return function for paging
		return (pageNumber = 1) => {
			// status=publish,future,draft,pending,private
			// status=any

			let statusStr = "";
			// Only request Drafts if auth’d
			if(process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_PASSWORD) {
				// Commas are encoded
				statusStr = `&status=${encodeURIComponent("publish,draft")}`;
			}

			return this.#getSubtypeUrl("posts", `?page=${pageNumber}&per_page=100${statusStr}`);
		};
	}

	getHeaders() {
		if(process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_PASSWORD) {
			return {
				"Content-Type": "application/json",
				"Authorization": "Basic " + btoa(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_PASSWORD}`),
			}
		}

		return {};
	}

	getEntriesFromData(data) {
		if(Array.isArray(data)) {
			return data;
		}

		return [];
	}

	getUrlFromEntry(entry) {
		return entry.link;
	}

	getUniqueIdFromEntry(entry) {
		return `${DataSource.UUID_PREFIX}::${WordPressApi.TYPE}::${entry.guid.rendered}`;
	}

	// stock WordPress is single-author
	async #getAuthors(authorId) {
		try {
			// Warning: extra API call
			let authorData = await this.getData(this.#getAuthorUrl(authorId), this.getType());

			return [
				{
					// _wordpress_author_id: entry.author,
					name: authorData.name,
					url: authorData.url || authorData.link,
					avatarUrl: authorData.avatar_urls[Object.keys(authorData.avatar_urls).pop()],
				}
			];
		} catch(e) {
			// Fetch logs the error upstream
			return [];
		}
	}

	async #getTags(ids) {
		return Promise.all(ids.map(tagId => {
			// Warning: extra API call
			return this.getData(this.#getTagsUrl(tagId), this.getType()).then(tagData => {
				return tagData.name;
			});
		}));
	}

	async #getCategories(ids) {
		let categoryNames = await Promise.all(ids.map(categoryId => {
			// Warning: extra API call
			return this.getData(this.#getCategoryUrl(categoryId), this.getType()).then(categoryData => {
				return categoryData.name;
			});
		}));

		return categoryNames.filter(name => {
			return !WordPressApi.IGNORED_CATEGORIES.includes(name);
		});
	}

	// Supports: Title, Author, Published/Updated Dates
	async cleanEntry(entry, data) {
		let url = this.getUrlFromEntry(entry);
		let status = this.cleanStatus(entry.status)

		let metadata = {};
		if(entry.jetpack_featured_media_url) {
			metadata.featuredImage = await this.fetcher.fetchAsset(entry.jetpack_featured_media_url, this.outputFolder, {
				url,
				status
			});
		}

		let categories = await this.#getCategories(entry.categories);
		if(categories.length) {
			metadata.categories = categories;
		}

		let tags = await this.#getTags(entry.tags);
		if(tags.length) {
			metadata.tags = tags;
		}

		let obj = {
			uuid: this.getUniqueIdFromEntry(entry),
			type: WordPressApi.TYPE,
			title: entry.title?.rendered,
			url,
			authors: await this.#getAuthors(entry.author),
			date: entry.date_gmt,
			dateUpdated: entry.modified_gmt,
			content: entry.content.rendered,
			contentType: "html",
			status,
			metadata,
		};

		if(metadata.categories) {
			// map WordPress categories for use in Eleventy tags (not WordPress metadata tags, which are different)
			obj.tags = metadata.categories;
		}

		if(entry.og_image) {
			obj.metadata.opengraphImage = {
				width: entry.og_image?.width,
				height: entry.og_image?.height,
				src: entry.og_image?.url,
				mime: entry.og_image?.type,
			}
		}

		return obj;
	}
}

export { WordPressApi };
