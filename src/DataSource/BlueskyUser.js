import path from "node:path";
import { Rss } from "./Rss.js";

class BlueskyUser extends Rss {
	static TYPE = "bluesky";
	static TYPE_FRIENDLY = "Bluesky";

	#username;

	constructor(username) {
		super(`https://bsky.app/profile/${username}/rss`);
		this.username = username;
	}

	set username(username) {
		if(username.startsWith("@")) {
			this.#username = username.slice(1);
		} else {
			this.#username = username;
		}
	}

	get username() {
		return this.#username;
	}

	static getFilePath(url) {
		let {pathname} = new URL(url);
		let [empty, profile, username, post, id] = pathname.split("/");
		return path.join(username, id);
	}

	cleanEntry(entry, data) {
		let obj = super.cleanEntry(entry, data);
		obj.type = BlueskyUser.TYPE;
		obj.contentType = "text";

		return obj;
	}
}

export { BlueskyUser };
