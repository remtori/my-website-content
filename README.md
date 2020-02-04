# Content repo for my-website

## Structure

Optional config per md/html file:

- isFullPage: Boolean - Is it a full fletched page (If it is just copy its over)

- title: String

- author: String

- description: String

- public: Boolean - Will it show on listing page and/or search result

- tags: String - Each tag is space-separated

Generated field (via Travis CI):

- created: time-string

- modified: time-string

## Travis CI:

On commit generate & commit:

- re-render.json: paths to content file to re-render

- index.json: list of all content with some metadata

index.json example layout

```json
[
	{
		"id": "first-test-hash123",
		"language": "en",
		"content": "blogs/first-test-hash123",
		"title": "First blog for testing purpose",
		"description": "A really nice description because i just has a terrible night",
		"tags": "first-blog blog first fuck im-sad",
		"author": "Remtori",
		"created": "2020-02-04T16:44:07.160Z",
		"modified": "2020-02-04T16:44:07.160Z"
	}
]
```
