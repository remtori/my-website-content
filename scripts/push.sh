#!/bin/sh

echo "Pushing to Github ..."
git config --global user.email "travis@travis-ci.org"
git config --global user.name "Travis CI"
git config --global push.default current
git stash
git checkout master
git stash pop
git add .
git commit -m "[travis-ci skip] Update generated/*"
git push https://${GITHUB_TOKEN}@github.com/remtori/my-website-content.git
echo "Done !"
