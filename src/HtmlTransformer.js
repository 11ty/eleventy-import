import posthtml from "posthtml";
import urls from "posthtml-urls";

class HtmlTransformer {
	#outputFolder;
	#fetcher;

	constructor() {
		this.assetFetchPromises = [];
	}

	setFetcher(fetcher) {
		this.#fetcher = fetcher;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
	}

	async transform(content, pageUrl) {
		let options = {
		  eachURL: (rawUrl, attr, tagName) => {
				// See https://github.com/11ty/eleventy-posthtml-urls/blob/main/lib/defaultOptions.js
				if(tagName === "img" || tagName === "video" || tagName === "source" || tagName === "link" || tagName === "script" || tagName === "track") {
					// Sync
					let { url, promise } = this.#fetcher.fetchAsset(rawUrl, this.#outputFolder);

					// Async
					this.assetFetchPromises.push(promise);

					return url;
				}

				return rawUrl;
			}
		};

		let result = await posthtml()
		  .use(urls(options))
		  .process(content);

		await Promise.allSettled(this.assetFetchPromises);

		return result.html;
	}
}

export { HtmlTransformer }
