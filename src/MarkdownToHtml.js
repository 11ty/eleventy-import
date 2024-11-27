import path from "node:path";
import fs from "graceful-fs";
import TurndownService from "turndown";
import * as prettier from "prettier";
import prettierSync from "@prettier/sync";
import striptags from "striptags";
import * as entities from "entities";

import { Logger } from "./Logger.js";
import { DirectoryManager } from "./DirectoryManager.js";
import { WordPressApi } from "./DataSource/WordPressApi.js";
import { HostedWordPressApi } from "./DataSource/HostedWordPressApi.js";

const WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION = {
	jscript: "js",
	markup: "html",
};

class MarkdownToHtml {
	#prettierLanguages;
	#initStarted;

	constructor() {
		this.assetsToKeep = new Set();
		this.assetsToDelete = new Set();
		this.isVerbose = true;
		this.counts = {
			cleaned: 0
		}
	}

	async asyncInit() {
		if(this.#initStarted) {
			return;
		}

		this.#initStarted = true;

		/* Sample output language
		{
			language: {
				linguistLanguageId: 50,
				name: 'CSS',
				type: 'markup',
				tmScope: 'source.css',
				aceMode: 'css',
				codemirrorMode: 'css',
				codemirrorMimeType: 'text/css',
				color: '#563d7c',
				extensions: [ '.css', '.wxss' ],
				parsers: [ 'css' ],
				vscodeLanguageIds: [ 'css' ]
			}
		}
		*/

		let map = {
			// extension without dot => array of parser types
		};

		let supportInfo = await prettier.getSupportInfo();
		for(let language of supportInfo.languages) {
			for(let ext of language.extensions) {
				if(language.parsers.length > 0) {
					map[ext.slice(1)] = language.parsers;
				}
			}
		}

		this.#prettierLanguages = map;
	}

	getCounts() {
		return this.counts;
	}

	setVerbose(isVerbose) {
		this.isVerbose = Boolean(isVerbose);
	}

	recontextifyRelativeAssetPath(assetPath, filePath) {
		if(path.isAbsolute(assetPath) || assetPath.startsWith("https:") || assetPath.startsWith("http:")) {
			return false;
		}

		let dir = DirectoryManager.getDirectory(filePath);
		return path.join(dir, assetPath);
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

	get prettierLanguages() {
		if(!this.#prettierLanguages) {
			throw new Error("Internal error: missing this.prettierLanguages—did you call asyncInit()?");
		}

		return this.#prettierLanguages;
	}

	static outputMarkdownCodeBlock(content, language) {
		return `\`\`\`${language || ""}\n${content.trim()}\n\`\`\`\n\n`
	}

	getTurndownService(options = {}) {
		let { filePath, type } = options;
		let isFromWordPress = type === WordPressApi.TYPE || type === HostedWordPressApi.TYPE;

		let ts = new TurndownService({
			headingStyle: "atx",
			bulletListMarker: "-",
			codeBlockStyle: "fenced",

			// Intentionally opt-out
			// preformattedCode: true,
		});

		ts.keep([
			"abbr",
			"address",
			"audio",
			"cite",
			"dd",
			"del",
			"details",
			// "dialog",
			"dfn",
			// "figure",
			"form",
			"iframe",
			"ins",
			"kbd",
			"object",
			"q",
			"sub",
			"s",
			"samp",
			"svg",
			"table",
			"time",
			"var",
			"video",
			"wbr",
		]);

		ts.addRule("pre-without-code-to-fenced-codeblock", {
			filter: ["pre"],
			replacement: (content, node) => {
				try {
					let cls = node.getAttribute("class") || "";
					let clsSplit = cls.split(" ");
					let isPreformattedWordPressBlock = clsSplit.includes("wp-block-preformatted");
					if(isPreformattedWordPressBlock && isFromWordPress) {
						return content;
					}

					let languageClass = clsSplit.find(className => className.startsWith("language-"));
					let language;
					if(languageClass) {
						language = languageClass.slice("language-".length).trim();
					} else if(isFromWordPress) {
						// WordPress specific
						let brush = cls.split(";").filter(entry => entry.startsWith("brush:"));
						language = (brush[0] || ":").split(":")[1].trim();
					}

					let finalLanguage = language;

					// WordPress-only options
					if(isFromWordPress) {
						finalLanguage = WORDPRESS_TO_PRISM_LANGUAGE_TRANSLATION[language] || language;

						// TODO customizable
						// Questionable default: for code blocks bookended with ` (unnecessarily)
						let trimmed = content.trim();
						if(trimmed.startsWith("`") && trimmed.endsWith("`")) {
							content = trimmed.slice(1, -1);
						}
					}

					try {
						if(isFromWordPress && language === "markup" && !content.trimStart().startsWith("<") || !this.prettierLanguages[finalLanguage]) {
							// Mislabeled as "markup" (hi WordPress) or no-parser found for prettier
							content = entities.decodeHTML(striptags(""+node.outerHTML));
						} else if (this.prettierLanguages[finalLanguage]) {
							// Attempt to format the code with Prettier
							let parserName = this.prettierLanguages[finalLanguage][0];
							content = prettierSync.format(content, { parser: parserName });
						}
					} catch(e) {
						console.error(`Error running code formatting on code block from ${filePath}. Returning unformatted code.`, e);
					}

					return MarkdownToHtml.outputMarkdownCodeBlock(content, finalLanguage);
				} catch(e) {
					// Otherwise errors get swallowed without feedback by Turndown
					console.error(`Error processing code block from ${filePath}`, e);

					return MarkdownToHtml.outputMarkdownCodeBlock(content);
				}
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
							this.assetsToDelete.add(this.recontextifyRelativeAssetPath(asset, filePath));
						}
					}
					return content;
				} catch(e) {
					// Otherwise errors get swallowed without feedback by Turndown
					console.error(`Error processing <source> on ${filePath}`, e);
					return content;
				}
			}
		});

		ts.addRule("prefer-highest-resolution-images", {
			filter: ["img"],
			replacement: (content, node, options) => {
				try {
					// prefer highest-resolution (first) srcset
					let [src, ...remainingUrls] = MarkdownToHtml.getImageSrcUrls(node.getAttribute("srcset"), node.getAttribute("src"));

					this.assetsToKeep.add(this.recontextifyRelativeAssetPath(src, filePath));

					for(let asset of remainingUrls) {
						this.assetsToDelete.add(this.recontextifyRelativeAssetPath(asset, filePath));
					}

					return `![${node.getAttribute("alt") || ""}](${src})`;
				} catch(e) {
					// Otherwise errors get swallowed without feedback by Turndown
					console.error(`Error processing high-resolution images on ${filePath}`, e);
					return content;
				}
			}
		});

		return ts;
	}

	// Removes unnecessarily downloaded <picture> and `srcset` assets that didn’t end up in the markdown simplification
	cleanup() {
		// Don’t delete assets that are in both Sets
		for(let asset of this.assetsToKeep) {
			if(asset) {
				this.assetsToDelete.delete(asset);
			}
		}

		for(let asset of this.assetsToDelete) {
			if(!asset) {
				continue;
			}

			if(fs.existsSync(asset)) {
				if(this.isVerbose) {
					Logger.cleanup("unused asset", asset);
				}

				this.counts.cleaned++;
				fs.unlinkSync(asset);
			}
		}
	}

	async toMarkdown(html, entry) {
		let ts = this.getTurndownService({
			type: entry.type,
			filePath: entry.filePath,
		});

		return ts.turndown(html);
	}
}

export { MarkdownToHtml }
