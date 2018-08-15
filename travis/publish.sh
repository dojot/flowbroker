#!/bin/bash -ex

version="latest"
if [ ${TRAVIS_BRANCH} != "master" ] ; then
  version=${TRAVIS_BRANCH}
fi
context_manager_img=${TRAVIS_REPO_SLUG}-context-manager
tag=${TRAVIS_REPO_SLUG}:$version
context_manager_tag=${context_manager_img}:$version


docker login -u="${DOCKER_USERNAME}" -p="${DOCKER_PASSWORD}"
docker tag ${TRAVIS_REPO_SLUG} ${tag}
docker tag ${context_manager_img} ${context_manager_tag}
docker push $tag
docker push ${context_manager_tag}
