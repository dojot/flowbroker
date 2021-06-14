# About

This is a Dojot's flowbroker node that calculates the arithmetic mean.
This node uses the Flowbroker Context Manager that allows a given set of data to persist beyond the life of the event.

# How to build and add it to Dojot

Build the docker image:
```sh
docker build -t <your dockerHub username>/arithmetic-mean .
```

Publish it on your DockerHub:
```sh
docker push <your dockerHub username>/arithmetic-mean
```

Acquire a Dojot's token:

__Note__ You need to enable the `dev-test-cli` client in the keycloak. For security reasons it is disabled by default, after use it is recommended to disable it again.


```sh
JWT=$(curl --location --request POST http://localhost:8000/auth/realms/admin/protocol/openid-connect/token \
--data-urlencode 'username=admin' \
--data-urlencode 'password=admin' \
--data-urlencode 'client_id=dev-test-cli' \
--data-urlencode 'grant_type=password' 2>/dev/null | jq -r '.access_token')
```

Note: the previous command requires the `jq` command, you can install it on on Debian-based Linux distributions with the following command:
```
sudo apt-get install jq
```

Add the node to Dojot.
```sh
curl -H "Authorization: Bearer ${JWT}" http://localhost:8000/flows/v1/node \
-H 'content-type: application/json' \
-d '{"image": "<your dockerHub username>/arithmetic-mean", "id":"arithmetic-mean"}'
```

Now the Arithmetic Mean node will be available on `function` category into the FlowBroker Dojot's interface.

Note: the DockerHub use is optional, you can use a private docker registry instead.

Note2: All commands considers that you are running Dojot locally, if it is not
the case, please, adapt them to refect your scenario.
