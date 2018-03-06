#!/bin/bash -ex

version="latest"
if [ ${TRAVIS_BRANCH} != "master" ] ; then
  version=${TRAVIS_BRANCH}
fi
tag="dojot/flowbroker:${version}"

docker login -u="${DOCKER_USERNAME}" -p="${DOCKER_PASSWORD}"
docker tag dojot/flowbroker ${tag}
docker push ${tag}
