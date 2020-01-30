# Content repo for my-website

## Structure

Optional config per md/html file:

- isFullPage: Boolean - Is it a full fletched page (If it is just copy its over)

- title: String

- author: String

- description: String

- public: Boolean - Will it show on listing page and/or search result

- tags: String[]

Generated field (via Travis CI):

- created: time-string

- modified: time-string

## Travis CI:

On commit generate & commit:

- re-render.json: paths to content file to re-render

- blog-indexes.json: list of all blog with some description
