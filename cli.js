#!/usr/bin/env node

import { parseArgs } from "node:util";

import { Importer } from "./src/Importer.js";
import { Logger } from "./src/Logger.js";
import { createRequire } from "node:module";

let { positionals, values } = parseArgs({
	allowPositionals: true,
	strict: true,
	tokens: true,
	options: {
		type: {
			type: "string",
		},
		target: {
			type: "string",
		},
		output: {
			type: "string",
			default: ".",
		},
		quiet: {
			type: "boolean",
			default: false,
		},
		dryrun: {
			type: "boolean",
			default: false,
		},
		help: {
			type: "boolean",
			default: false,
		},
		version: {
			type: "boolean",
			default: false,
		},
		overwrite: {
			type: "boolean",
			default: false,
		},
		cacheduration: {
			type: "string",
			default: "24h",
		},
		format: {
			type: "string",
			default: "markdown",
		},
		persist: {
			type: "string",
			default: "",
		},
		assetrefs: {
			type: "string",
			default: "relative",
		},
	},
});

let [ type, target ] = positionals;
let { quiet, dryrun, output, help, version, overwrite, cacheduration, format, persist, assetrefs } = values;

if(version) {
	const require = createRequire(import.meta.url);
	let pkg = require("./package.json");
	Logger.log(pkg.version);
	process.exit();
}

// If you modify this, maybe also add the instructions to README.md too?
if(help) {
	Logger.log(`Usage:

  npx @11ty/import --help
  npx @11ty/import --version

  # Import content
  npx @11ty/import [type] [target]

  # Dry run (don’t write files)
  npx @11ty/import [type] [target] --dryrun

  # Quietly (limit console output)
  npx @11ty/import [type] [target] --quiet

  # Change the output folder (default: ".")
  npx @11ty/import [type] [target] --output=dist

  # Allow overwriting existing files
  npx @11ty/import [type] [target] --overwrite

  # Change local fetch cache duration (default: 24h)
  npx @11ty/import [type] [target] --cacheduration=20m

  # Change output format (default: markdown)
  npx @11ty/import [type] [target] --format=html

  # Change asset reference URLs: relative (default), absolute, colocate
  npx @11ty/import [type] [target] --assetrefs=relative
  npx @11ty/import [type] [target] --assetrefs=absolute
  npx @11ty/import [type] [target] --assetrefs=colocate
`);

	process.exit();
}

// Input checking
if(!type || !target) {
	console.error("Expected usage: npx @11ty/import [type] [target]");
	process.exit(1);
} else if(format !== "markdown" && format !== "html") {
	console.error("Invalid --format, expected `markdown` or `html`");
	process.exit(1);
}

let importer = new Importer();

importer.setOutputFolder(output);
importer.setCacheDuration(cacheduration);
importer.setVerbose(!quiet);
importer.setSafeMode(!overwrite);
importer.setDryRun(dryrun);
importer.addSource(type, target);

// TODO wire these up to CLI
importer.setDraftsFolder("drafts");
importer.setAssetsFolder("assets");
importer.setAssetReferenceType(assetrefs);

if(persist) {
	importer.setPersistTarget(persist);
}

let entries = await importer.getEntries({
	contentType: format,
});

await importer.toFiles(entries);

importer.logResults();

