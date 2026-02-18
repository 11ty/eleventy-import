import fs from "graceful-fs";
import path from "node:path";

class DirectoryManager {
	static getDirectory(pathname) {
		let dir = path.dirname(pathname);
		// Return empty string for root directory to maintain backward compatibility
		// (original code returned "" for "/test.html", not "/")
		if (dir === "/" || dir === "\\") {
			return "";
		}
		return dir;
	}

	constructor() {
		this.created = new Set();
		this.dryRun = false;
	}

	setDryRun(isDryRun) {
		this.dryRun = Boolean(isDryRun);
	}

	createDirectoryForPath(pathname) {
		if(this.dryRun) {
			return;
		}

		let dir = DirectoryManager.getDirectory(pathname);
		if(dir && !this.created.has(dir)) {
			fs.mkdirSync(dir, { recursive: true })

			this.created.add(dir);
		}
	}
}

export { DirectoryManager };
