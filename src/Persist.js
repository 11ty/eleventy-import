import { GitHubPublisher } from "github-publish";

import { Logger } from "./Logger.js";

class Persist {
	static SUPPORTED_TYPES = ["github"];
	static READABLE_TYPES = {
		github: "GitHub"
	};

	static parseTarget(target = "") {
		let [type, remainder] = target.split(":");
		let [username, repository] = remainder.split("/");
		let [repositoryName, repositoryBranch] = repository.split("#");

		return {
			type,
			username,
			repository: repositoryName,
			branch: repositoryBranch || undefined,
		}
	}

	#publisher;
	#verboseMode = true;
	#dryRun = false;

	constructor() {
		this.counts = {
			persist: 0
		};
	}

	getCounts() {
		return this.counts;
	}

	setVerbose(isVerbose) {
		this.#verboseMode = Boolean(isVerbose);
	}

	setDryRun(dryRun) {
		this.#dryRun = Boolean(dryRun);
	}

	// has setTarget been successful?
	canPersist() {
		return Boolean(this.type && this.username && this.repository);
	}

	setTarget(target) {
		// Must have a token to use this feature
		if(!process.env.GITHUB_TOKEN) {
			throw new Error("Missing GITHUB_TOKEN environment variable.");
		}

		let { type, username, repository, branch } = Persist.parseTarget(target);
		if(!Persist.SUPPORTED_TYPES.includes(type)) {
			throw new Error("Invalid persist type: " + type);
		}

		this.type = type;
		this.username = username;
		this.repository = repository;
		this.branch = branch;
	}

	get publisher() {
		if(!this.canPersist()) {
			throw new Error("Missing Persist target. Have you called setTarget()?");
		}

		if(!this.#publisher) {
			this.#publisher = new GitHubPublisher(process.env.GITHUB_TOKEN, this.username, this.repository, this.branch);
		}

		return this.#publisher;
	}

	persistFile(filePath, content, metadata = {}) {
		// safeMode is handled upstream, otherwise the file will always exist on the file system (because writes happen before persistence)
		if(this.#dryRun) {
			// Skipping, don’t log the skip
			return;
		}

		let options = {
			// Persist should not happen if safe mode is enabled and the file already exists
			force: true,
			message: `@11ty/import ${metadata.url ? `via ${metadata.url}` : ""}`,
			// sha: undefined // required for updating
		}

		this.counts.persist++;

		if(this.#verboseMode) {
			let readableType = Persist.READABLE_TYPES[this.type] || this.type;
			Logger.persisting(`${metadata.type ? `${metadata.type} ` : ""}to ${readableType}`, filePath, metadata.url, {
				size: content.length,
			});
		}

		return this.publisher.publish(filePath, content, options);
	}
}

export { Persist };
