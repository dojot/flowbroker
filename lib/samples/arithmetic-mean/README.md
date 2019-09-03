# About

This is a Dojot's flowbroker node that calculates the arithmetic mean.

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
```sh
JWT=$(curl -s -X POST http://localhost:8000/auth \
-H 'Content-Type:application/json' \
-d '{"username": "admin", "passwd" : "admin"}' | jq -r ".jwt")
```

Note: the previous command requires the `jq` command, you can install it on ubuntu
with the following command:
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