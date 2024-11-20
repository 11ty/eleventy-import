import path from "node:path";

class Utils {
	static pathJoin(...refs) {
		return path.join(...refs).split(path.sep).join("/");
	}
}

export { Utils }
