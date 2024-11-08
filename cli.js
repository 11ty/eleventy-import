#!/usr/bin/env node

import { parseArgs } from "node:util";
import kleur from "kleur";

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
		}
	},
});

let [ type, target ] = positionals;
let { quiet, dryrun, output, help, version, overwrite } = values;

if(version) {
	const require = createRequire(import.meta.url);
	let pkg = require("./package.json");
	Logger.log(pkg.version);
	process.exit();
}

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

  # Change the output folder
  npx @11ty/import [type] [target] --output=dist

	# Allow overwriting existing files
  npx @11ty/import [type] [target] --overwrite
`);

	process.exit();
}

// Input checking
if(!type || !target) {
	console.error("Expected usage: npx @11ty/import [type] [target]");
	// TODO check valid types
	process.exit(1);
}

let start = new Date();
let importer = new Importer();

importer.setVerbose(!quiet);

// TODO wire these up to CLI
importer.setCacheDuration("4h");
importer.setDraftsFolder("drafts");
importer.setOutputFolder(output);

importer.setSafeMode(!overwrite);
importer.setDryRun(dryrun);
importer.addSource(type, target);

let entries = await importer.getEntries({
	// TODO wire this up to CLI
	contentType: "markdown"
});

importer.toFiles(entries);

// Log results
let { fetches, errors } = importer.getCounts();
let sourcesDisplay = importer.getSources().map(source => source.constructor.TYPE_FRIENDLY || source.constructor.TYPE).join(", ");

let content = [];
content.push(kleur.green("Imported"));
content.push(kleur.green(Logger.plural(entries.length, "document")));
content.push(kleur.green("and"));
content.push(kleur.green(Logger.plural(fetches.assets, "asset")));
content.push(kleur.green(`from ${sourcesDisplay}`));
content.push(kleur[errors > 0 ? "red" : "gray"](`(${Logger.plural(errors, "error")})`));
content.push(`in ${Logger.time(Date.now() - start)}`);

Logger.log(content.join(" "));
