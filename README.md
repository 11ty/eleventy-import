# `@11ty/import`

A small utility (and CLI) to import content files from various content sources. Requires Node 18 or newer.

## Usage

```sh
npx @11ty/import --help
npx @11ty/import --version

# Import content
npx @11ty/import [type] [target]

# Quietly
npx @11ty/import [type] [target] --quiet

# Change the output folder
npx @11ty/import [type] [target] --output=dist
```

### Service Types

* `atom` (URL)
* `bluesky` (username)
* `fediverse` (username)
* `rss` (URL)
* `wordpress` (blog home page URL)
* `youtubeuser` (user id)

```sh
# Import recent YouTube Videos for one user
npx @11ty/import youtubeuser UCskGTioqrMBcw8pd14_334A

# Import *all* blog posts from the WordPress API
# Draft posts available with WORDPRESS_USERNAME and WORDPRESS_PASSWORD environment variables.
npx @11ty/import wordpress https://blog.fontawesome.com

# Import Atom feed posts
npx @11ty/import atom https://www.11ty.dev/blog/feed.xml

# Import GitHub releases (via Atom feed)
npx @11ty/import atom https://github.com/11ty/eleventy/releases.atom

# Import Mastodon posts (via RSS feed)
npx @11ty/import fediverse eleventy@fosstodon.org

# Import RSS feed posts
npx @11ty/import rss https://fosstodon.org/users/eleventy.rss

# Import Bluesky posts (via RSS feed)
npx @11ty/import bluesky @11ty.dev
```
