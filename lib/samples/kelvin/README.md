# About

This is a Dojot's flowbroker node that converts a Celsius temperature
measure into Kelvin.

In the kelvin node, you will find:

``` sh
.
├── Dockerfile              - file to build the docker container
├── package.json            - javascript dependencies
├── README.md               - README file
└── src
    ├── kelvin.html         - the node html
    ├── index.js            - the kelvin converts logic
    └── locales             - used by internationalization
```


# How to build and add it to Dojot

Build the docker image:
```sh
docker build -t <your dockerHub username>/kelvin:<image tag> .
```

Publish it on your DockerHub:
```sh
docker push <your dockerHub username>/kelvin:<image tag>
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

Note: the previous command requires the `jq` and `curl` command, you can install it on on Debian-based Linux distributions with the following command:
```
sudo apt-get install jq curl
```

Add the node to Dojot.
```sh
curl -H "Authorization: Bearer ${JWT}" http://localhost:8000/flows/v1/node -H 'content-type: application/json' -d '{"image": "<your dockerHub username>/kelvin:<image tag>", "id":"kelvin"}'
```

Now the Kelvin node will be available on `converters` category into the FlowBroker Dojot's interface.

Note: the DockerHub use is optional, you can use a private docker registry instead.

Note2: All commands considers that you are running Dojot locally, if it is not
the case, please, adapt them to reflect your scenario.
