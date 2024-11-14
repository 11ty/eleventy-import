import path from "node:path";
import fs from "graceful-fs";
import TurndownService from "turndown";

import { Logger } from "./Logger.js";
import { Fetcher } from "./Fetcher.js";

const WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION = {
	jscript: "js"
};

class MarkdownToHtml {
	#outputFolder = ".";

	constructor() {
		this.assetsToKeep = new Set();
		this.assetsToDelete = new Set();
		this.isVerbose = true;
		this.counts = {
			cleaned: 0
		}
	}

	getCounts() {
		return this.counts;
	}

	setOutputFolder(dir) {
		this.#outputFolder = dir;
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);
	}

	recontextifyRelativeAssetPath(assetPath, contextPageUrl) {
		let contextPathname = Fetcher.getContextPathname(contextPageUrl);
		return path.join(contextPathname, assetPath);
	}

	// /small/jpeg/ 375w, /medium/jpeg/ 650w
	static getSrcsetUrls(srcsetAttr) {
		return (srcsetAttr || "").split(",").map(entry => {
			let [url, size] = entry.trim().split(" ");
			return url.trim();
		}).filter(url => Boolean(url)).reverse()
	}

	static getImageSrcUrls(srcsetAttr, srcAttr) {
		let s = new Set();
		for(let srcsetUrl of this.getSrcsetUrls(srcsetAttr) || []) {
			s.add(srcsetUrl);
		}
		if(srcAttr) {
			s.add(srcAttr);
		}
		return Array.from(s);
	}

	getTurndownService(contextPageUrl) {
		let ts = new TurndownService({
			headingStyle: "atx",
			bulletListMarker: "-",
			codeBlockStyle: "fenced",
			// preformattedCode: true,
		});

		ts.addRule("pre-without-code-to-fenced-codeblock", {
			filter: ["pre"],
			replacement: (content, node) => {
				let brush = (node.getAttribute("class") || "").split(";").filter(entry => entry.startsWith("brush:"))
				let language = (brush[0] || ":").split(":")[1].trim();

				return `\`\`\`${WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION[language] || language}
		${content}
		\`\`\``;
			}
		});

		// ts.addRule("picture-unsupported", {
		// 	filter: ["picture"],
		// 	replacement: (content, node) => {
		// 		Logger.warning( `<picture> node found, but not yet supported in markdown import.` );
		// 		return "";
		// 	}
		// });

		ts.addRule("source-cleanup", {
			filter: ["source"],
			replacement: (content, node) => {
				try {
					let srcset = node.getAttribute("srcset");
					if(node.parentNode.localName === "picture" && srcset) {
						let urls = MarkdownToHtml.getImageSrcUrls(srcset);
						for(let asset of urls) {
							this.assetsToDelete.add(this.recontextifyRelativeAssetPath(asset, contextPageUrl));
						}
					}
					return content;
				} catch(e) {
					// Otherwise errors get swallowed without feedback by Turndown
					console.error(e);
				}
			}
		});

		ts.addRule("prefer-highest-resolution-images", {
			filter: ["img"],
			replacement: (content, node, options) => {
				try {
					// prefer highest-resolution (first) srcset
					let [src, ...remainingUrls] = MarkdownToHtml.getImageSrcUrls(node.getAttribute("srcset"), node.getAttribute("src"));

					this.assetsToKeep.add(this.recontextifyRelativeAssetPath(src, contextPageUrl));

					for(let asset of remainingUrls) {
						this.assetsToDelete.add(this.recontextifyRelativeAssetPath(asset, contextPageUrl));
					}

					return `![${node.getAttribute("alt") || ""}](${src})`;
				} catch(e) {
					// Otherwise errors get swallowed without feedback by Turndown
					console.error(e);
				}
			}
		});

		return ts;
	}

	// Removes unnecessarily downloaded <picture> and `srcset` assets that didn’t end up in the markdown simplification
	cleanup() {
		// Don’t delete assets that are in both Sets
		for(let asset of this.assetsToKeep) {
			this.assetsToDelete.delete(asset);
		}

		for(let asset of this.assetsToDelete) {
			let assetLocation = path.join(this.#outputFolder, asset);
			if(fs.existsSync(assetLocation)) {
				if(this.isVerbose) {
					Logger.cleanup("unused asset", assetLocation);
				}

				this.counts.cleaned++;
				fs.unlinkSync(assetLocation);
			}
		}
	}

	async toMarkdown(html, viaUrl) {
		let ts = this.getTurndownService(viaUrl)
		return ts.turndown(html);
	}
}

export { MarkdownToHtml }
