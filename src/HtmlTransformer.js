import posthtml from "posthtml";
import urls from "posthtml-urls";

class HtmlTransformer {
	#outputFolder = ".";
	#fetcher;

	setFetcher(fetcher) {
		this.#fetcher = fetcher;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
	}

	async transform(content, pageUrl) {
		let options = {
		  eachURL: async (rawUrl, attr, tagName) => {
				// See https://github.com/11ty/eleventy-posthtml-urls/blob/main/lib/defaultOptions.js
				if(tagName === "img" || tagName === "video" || tagName === "source" || tagName === "link" || tagName === "script" || tagName === "track") {
					return this.#fetcher.fetchAsset(rawUrl, this.#outputFolder, pageUrl);
				}

				return rawUrl;
			}
		};

		let result = await posthtml()
		  .use(urls(options))
		  .process(content);

		return result.html;
	}
}

export { HtmlTransformer }
