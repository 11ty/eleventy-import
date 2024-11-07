import kleur from "kleur";
import {filesize} from "filesize";

class Logger {
	static log(...messages) {
		console.log(...messages);
	}

	static importing(type, local, remote, options = {}) {
		let { size, dryRun } = options;
		let sizeStr = filesize(size, {
			spacer: ""
		});
		this.log(kleur.gray(`Importing ${type}`), local, kleur.gray(`(${sizeStr}${dryRun ? ", dry run" : ""})`), kleur.gray("from"), remote);
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
