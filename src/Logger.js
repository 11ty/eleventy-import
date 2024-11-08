import kleur from "kleur";
import {filesize} from "filesize";

class Logger {
	static log(...messages) {
		console.log(...messages);
	}

	static _logFsOperation(label, type, local, remote, options = {}) {
		let { size, dryRun } = options;

		let extras = [];
		if(label === "Skipping") {
			extras.push("overwrites disabled");
		} else {
			if(size) {
				extras.push(filesize(size, {
					spacer: ""
				}));
			}
			if(dryRun) {
				extras.push("dry run");
			}
		}
		let extrasStr = extras.length ? `(${extras.join(", ")}) ` : "";
		this.log(kleur.gray(`${label} ${type}`), local, kleur.gray(`${extrasStr}from`), remote);
	}

	static importing(type, local, remote, options = {}) {
		this._logFsOperation("Importing", type, local, remote, options);
	}

	static skipping(type, local, remote, options = {}) {
		this._logFsOperation("Skipping", type, local, remote, options);
	}

	// alias for log
	static message(...messages) {
		this.log(...messages);
	}

	static warning(...messages) {
		this.message(...(messages.map(msg => kleur.yellow(msg))));
	}

	static error(...messages) {
		this.message(...(messages.map(msg => kleur.red(msg))));
	}

	static time(ms) {
		if(ms > 1000) {
			return `${(ms/1000).toFixed(2)}s`;
		}
		return `${ms}ms`;
	}

	static plural(num, singular, plural) {
		if(!plural) {
			plural = singular + "s";
		}
		return `${num} ${num !== 1 ? plural : singular}`;
	}
}

export { Logger }
