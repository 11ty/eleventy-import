import TurndownService from "turndown";

import { Logger } from "./Logger.js";

const WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION = {
	jscript: "js"
};

class MarkdownToHtml {
	#turndownService;
	#outputFolder;
	#fetcher;

	constructor() {
		this.outputImages = new Set();
		this.imageFetchPromises = [];
	}

	setFetcher(fetcher) {
		this.#fetcher = fetcher;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
	}

	get turndownService() {
		if(!this.#turndownService) {
			this.#turndownService = new TurndownService({
				headingStyle: "atx",
				bulletListMarker: "-",
				codeBlockStyle: "fenced",
				// preformattedCode: true,
			});

			this.#turndownService.addRule("pre-without-code-to-fenced-codeblock", {
				filter: ["pre"],
				replacement: function(content, node) {
					let brush = (node.getAttribute("class") || "").split(";").filter(entry => entry.startsWith("brush:"))
					let language = (brush[0] || ":").split(":")[1].trim();

					return `\`\`\`${WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION[language] || language}
			${content}
			\`\`\``;
				}
			});

			this.#turndownService.addRule("raw-picture", {
				filter: ["picture"],
				replacement: function(content, node) {
					Logger.warning( `<picture> node found, but not yet supported in markdown import.` );
					return "";
				}
			});

			this.#turndownService.addRule("raw-image", {
				filter: ["img"],
				replacement: (content, node, options) => {
					// prefer highest-resolution (first) srcset
					let srcset = node.getAttribute("srcset")?.split(" ")?.reverse()?.pop();
					let attrs = {
						src: srcset || node.getAttribute("src"),
						alt: node.getAttribute("alt"),
					}

					let { url, promise } = this.#fetcher.fetchImage(attrs.src, this.#outputFolder);
					this.imageFetchPromises.push(promise);

					return `![${attrs.alt}](${url})`;
				}
			});
		}

		return this.#turndownService;
	}

	async toHtml(html, viaUrl) {
		let content = this.turndownService.turndown(html);

		try {
			await Promise.allSettled(this.imageFetchPromises);
		} catch(e) {
			Logger.error(`>> Error fetching images${viaUrl ? ` for ${viaUrl}` : ""}`);
		}

		return content;
	}
}

export { MarkdownToHtml }