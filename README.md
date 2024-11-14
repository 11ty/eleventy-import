# `@11ty/import`

A small utility (and CLI) to import content files from various content sources. Requires Node 18 or newer.

## Features

- Converts imported content as markdown files in your repository. Option to use HTML.
- Downloads all referenced assets (images, videos, stylesheets, scripts, etc) in content and co-locates the assets with the content.
- Works with a bunch of different data sources (see below).
- **Resumable**: Can stop and resume a large import later, reusing a local cache (with configurable cache duration)
- **Safe**: avoids overwriting existing files by default (unless you opt-in with `--overwrite`).
	- This allows you to continue using an import source for new content while editing the already imported content.
	- Use `--dryrun` for testing without writing any files.

## Usage

```sh
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

# EXPERIMENTAL: Persist *new* non-draft content
# - `github` persist type requires a `GITHUB_TOKEN` environment variable.
npx @11ty/import [type] [target] --persist=github:zachleat/wp-awesome
```

### Service Types

- `atom` (URL)
- `bluesky` (username)
- `fediverse` (username)
- `rss` (URL)
- `wordpress` (blog home page URL)
- `youtubeuser` (user id)

#### YouTube

```sh
# Import recent YouTube Videos for one user
npx @11ty/import youtubeuser UCskGTioqrMBcw8pd14_334A
```

#### WordPress

```sh
# Import *all* posts from the WordPress API
# Draft posts available when WORDPRESS_USERNAME and WORDPRESS_PASSWORD environment
# variables are supplied, read more: https://www.11ty.dev/docs/environment-vars/
npx @11ty/import wordpress https://blog.fontawesome.com
```

#### Atom Feeds

```sh
# Import Atom feed posts
npx @11ty/import atom https://www.11ty.dev/blog/feed.xml

# Import GitHub releases (via Atom)
npx @11ty/import atom https://github.com/11ty/eleventy/releases.atom
```

#### RSS Feeds

```sh
# Import RSS feed posts
npx @11ty/import rss https://fosstodon.org/users/eleventy.rss
```

#### Fediverse

```sh
# Import recent Mastodon posts (via RSS)
npx @11ty/import fediverse eleventy@fosstodon.org
```

#### Bluesky

```sh
# Import recent Bluesky posts (via RSS)
npx @11ty/import bluesky @11ty.dev
```
