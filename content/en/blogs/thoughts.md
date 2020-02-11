---
title: About the blogs architecture
description: Need to do a little brainstorm about the current architecture
tags: blog my-website thoughts
author: Remtori
---

# Blog #3

## About the blog id

Currently the id of the blog is whatever i come up with, after a while there will be a conflict id. So ... should i just use randomly generated id from the get go, or append a time string to the end of the id

The append string method seem promising but will be finding its later be more difficult. Currently, i don't think so, this afternoon (currently its 10:40pm for me) i learn about FlexSearch, a cool algorithm so i think i will use this format for the blog id

```
[title:16][hashed-time-string:8]
```

the title will be the title we using when we first create the blog and the time is also a time of creation, well to be more specific is the time when we submitting

## About the created and modified field

At first i though these would be super easy, just use some git command magic a boom, you done, right? ... right?

Actually no, after some googling git by itself doesn't store/apply timestamp so next thing up the list is github

Solution:

- Single json file database, horrible i known, when we go large scale i will improve its. (First tech debt, maybe?)

- Travis CI get git diff and compare with the database

	- if not found add its to the database and get set created and modified time as the commit time

	- if found update the modified time as the commit time

- Get commit time via github api v4 GraphQL

```
Query:
`{
  repository(owner: "remtori", name: "my-website") {
    ref(qualifiedName: "refs/heads/master") {
      target {
        ... on Commit {
          history(first: 1, path: "${pathToFile}") {
            edges {
              node {
                committedDate
              }
            }
          }
        }
      }
    }
  }
}`
```

Response path: data.repository.ref.target.history.edges[0].node.committedDate
