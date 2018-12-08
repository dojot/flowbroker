
#!/bin/bash -ex
if [ $TRAVIS_PULL_REQUEST == false ] ; then
  version="latest"
  if [ ${TRAVIS_BRANCH} != "master" ] ; then
    version=${TRAVIS_BRANCH}
  fi

  username=$(echo ${TRAVIS_REPO_SLUG}  | sed  "s/\(.*\)\/.*/\1/")
  echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

  function buildPublish() {
    tag=${username}"/"$1:$version
    docker tag $1 ${tag}
    echo "Pushing tag ${tag}"
    docker push $tag
  }

  buildPublish "flowbroker"
  buildPublish "flowbroker-context-manager"
fi
