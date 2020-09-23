# @dojot/flow-node

[![NPM](https://nodei.co/npm/@dojot/flow-node.png?mini=true)](https://npmjs.org/package/@dojot/flow-node)

A NodeJS library that allows you to integrate your own node on Dojot's [FlowBroker](https://github.com/dojot/flowbroker).

This library are published at npm as [@dojot/flow-node](https://npmjs.org/package/@dojot/flow-node).

## How to build your own node

1) You need to create a class that extends the `DataHandlerBase` class, this
class is the responsible by implements your node behavior. The following methods
__must be__ implemented:
  - getNodeRepresentationPath
  - getMetadata
  - getLocalesPath
  - handleMessage

2) Is necessary to create a `.html` file that describes your node. You can find how to create it using the [NodeRed documentation](https://nodered.org/docs/creating-nodes/). Dojot's FlowBroker uses the [NodeRed](https://nodered.org/) frontend.


3) You need to encapsulate your code into a docker container.

4) Publish your container in some public repository like [DockerHub](https://hub.docker.com/) or some private based on [DockerRegistry](https://docs.docker.com/registry).

5) Call the FlowBroker endpoint to add a new node. Please check the [Latest FlowBroker documentation](https://dojot.github.io/flowbroker/apiary_latest.html) to check
how this endpoint works.

Note: To deploy a remote node, you must deploy to `docker-compose` or `kubernetes`, dojot provides these. Consult the
[dojot documentation](https://dojotdocs.readthedocs.io)
for more information on installation methods.

## Internationalization

The method `getLocalesPath`  should return the full path (`myNode/locales` ),
where there're __Message Catalog__ (`myNode/locales/__language__.json` ).

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

Any HTML element provided in the node template can specify a data-i18n attribute to provide the message identify to use. For example:

```html
<span data-i18n="myNode.label.foo"></span>

<input type="text" data-i18n="[placeholder]myNode.placeholder.foo">

<a href="#" data-i18n="[title]myNode.label.linkTitle;myNode.label.linkText"></a>
```

## Samples

The directory samples contains two examples of nodes. One that converts a Celcius temperature measure into Kelvin and another one that calculates the arithmetic mean using *Flowbroker Context Manager*. They can be used as reference to build your own node.

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

Note: the previous command requires the `jq`and `curl` command, you can install it on Debian-based Linux distributions with the following command:
```
sudo apt-get install jq
sudo apt-get install curl
```

How to add a node to Dojot:

```sh
curl -H "Authorization: Bearer ${JWT}" http://localhost:8000/flows/v1/node -H 'content-type: application/json' -d '{"image": "<your dockerHub username>/<node name>:<image tag>", "id":"<node name>"}'
```
Now the node will be available on the FlowBroker Dojot's interface.

#### Making changes to the source code of the node and seeing them reflected

**Note:** If you need to the source code of the node and seeing them reflected, you need to: **rebuild the container**; **push it to the registry again with a new tag**; **remove the node from dojot via api**; **and add the node to dojot again**. Always change the `<image tag>` of the docker image, to force the update and see your changes reflected.

How to remove a node from Dojot:

```sh
curl -X DELETE -H "Authorization: Bearer ${JWT}" http://localhost:8000//flows/v1/node/<node name> -H 'content-type: application/json'
```

**ATTENTION**: The `id` to add the node via API (when request `/flows/v1/node`) must be the same as `name` and `id` defined in `getMetadata` in the class that extends `dojot.DataHandlerBase`. And within the html called in the `getNodeRepresentationPath` method also in the class that extends `dojot.DataHandlerBase`, the references inside the html `data-template-name=`, `data-help-name=`, `registerType(..` ,  and `RED._("...` must have this same `id`/`name`.

This lib has been developed and tested using node v8.14.x

#### Tip: To view the logs from your remote node run

```sh
sudo docker logs -f -t $(sudo docker ps -aqf "ancestor=<your dockerHub username>/<node name>:<unique-id>")
```

Note: the DockerHub use is optional, you can use a private docker registry instead.

Note2: All commands considers that you are running Dojot locally, if it is not
the case, please, adapt them to reflect your scenario.
