# @dojot/flow-node

[![NPM](https://nodei.co/npm/@dojot/flow-node.png?mini=true)](https://npmjs.org/package/@dojot/flow-node)

A NodeJS library that allows you to integrate your own node on Dojot's [FlowBroker](https://github.com/dojot/flowbroker).

This library is published at npm as [@dojot/flow-node](https://npmjs.org/package/@dojot/flow-node).

## How to build your own node

1) You need to create a class that extends the `DataHandlerBase` class, that will be responsible for your node's behaviors. The following methods
__must be__ implemented:
  - getNodeRepresentationPath
  - getMetadata
  - getLocalesPath
  - handleMessage

2) Is necessary to create a `.html` file that describes your node. You can find how to create it using the [NodeRed documentation](https://nodered.org/docs/creating-nodes/). Dojot's FlowBroker uses the [NodeRed](https://nodered.org/) frontend.


3) You need to encapsulate your code into a docker container.

4) Publish your container in some public repository like [DockerHub](https://hub.docker.com/) or in a private one based on [DockerRegistry](https://docs.docker.com/registry).

5) Call the FlowBroker endpoint to add a new node. Please check the [latest FlowBroker documentation](https://dojot.github.io/flowbroker/apiary_latest.html) to check
how this endpoint works.


__NOTE THAT__ to deploy your newly-created remote node, you must beforehand either deploy dojot via `docker-compose` or via `Kubernetes`. Check the [dojot documentation](https://dojotdocs.readthedocs.io) for more information on installation methods.

This lib has been developed and tested using node v8.14.x

## Internationalization

The `getLocalesPath` method should return the full path to the __message catalog__ file. Example: `myNode/locales/__language__.json`.

The locales directory must be in the same directory as the node’s .js file.
The __language__ part of the path identifies the language the corresponding files provide. Eg.: 'en-US'.

A example of content in a  __Message Catalog__:

```json
{
     "myNode" : {
         "message1": "This is my first message",
         "message2": "This is my second message"
     }
 }
```

#### Using i18n messages

##### Runtime
The runtime part of a node can access messages using the RED._() function. For example:

```javascript
console.log(RED._("myNode.message1"));
```

With namespace, the namespace will be the __id__ of node
```javascript
console.log(RED._("__id__:myNode.message1"));
```

##### Editor

When you need to use text from the __Message Catalog__, you can specify a ``data-i18n`` attribute to provide the message. For example:


```html
<span data-i18n="myNode.label.foo"></span>

<input type="text" data-i18n="[placeholder]myNode.placeholder.foo">

<a href="#" data-i18n="[title]myNode.label.linkTitle;myNode.label.linkText"></a>
```

## Samples

The [`samples`](./samples) directory contains two examples of nodes: one that converts a Celsius temperature into Kelvin and the other calculates the arithmetic mean using the *Flowbroker Context Manager*. They can be used as references when building a new node.

We will explain the node structure using [samples/kevin](./samples/kevin) node. There, you will find:

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

### How to build your own node and add in to Dojot

This section explains how to build the nodes in a generic way.


Build the docker image:
```sh
docker build -t <your dockerHub username>/<image name>:<image tag> .
```

Publish it on your DockerHub:
```sh
docker push <your dockerHub username>/<image name>:<image tag>
```

Acquire a Dojot's token:
```sh
JWT=$(curl -s -X POST http://localhost:8000/auth \
-H 'Content-Type:application/json' \
-d '{"username": "admin", "passwd" : "admin"}' | jq -r ".jwt")
```

Note: the previous command requires the `jq` and `curl` command, you can install it on Debian-based Linux distributions with the following command:
```
sudo apt-get install jq curl
```

How to add a node to Dojot:

```sh
curl -H "Authorization: Bearer ${JWT}" http://localhost:8000/flows/v1/node -H 'content-type: application/json' -d '{"image": "<your dockerHub username>/<node name>:<image tag>", "id":"<node name>"}'
```
Now the node will be available on the FlowBroker Dojot's interface.

#### Live Reloading your node

**Note:** If you need to change the source code of the node and seeing them reflected, you need to: **rebuild the container**; **push it to the registry again with a new tag**; **remove the node from dojot via api**; **and add the node to dojot again**. Always change the `<image tag>` of the docker image, to force the update and see your changes reflected.

How to remove a node from Dojot:

```sh
curl -X DELETE -H "Authorization: Bearer ${JWT}" http://localhost:8000//flows/v1/node/<node name> -H 'content-type: application/json'
```

#### **ATTENTION**: Avoiding problems with `id` and `name`

To facilitate adding the node to the flowbroker, try to follow these intrusions:

##### **When adding the node via API**

The `id` when request `/flows/v1/node` must be the same as `name` and `id` defined in `getMetadata` in the class that extends `dojot.DataHandlerBase`.

##### **When creating the node front end - html**

When creating tThe html called in the `getNodeRepresentationPath` method also in the class that extends `dojot.DataHandlerBase`) the references within this html listed below must have the same `id`/`name`.

- `data-template-name=...`
- `data-help-name=...`
- `registerType(..`
- `RED._("...`

#### Tip: To view the logs from your remote node run

```sh
sudo docker logs -f -t $(sudo docker ps -aqf "ancestor=<your dockerHub username>/<node name>:<unique-id>")
```

Note: the DockerHub use is optional, you can use a private docker registry instead.

Note2: All commands considers that you are running Dojot locally, if it is not
the case, please, adapt them to reflect your scenario.
