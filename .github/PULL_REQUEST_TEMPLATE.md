- **Please check if the PR fulfills these requirements**

  - [ ] Tests for the changes have been added (for bug fixes / features)
  - [x] Docs have been added / updated (for bug fixes / features)

- **What kind of change does this PR introduce?** (Bug fix, feature, docs update, ...)

  New features to the template node. </br>
  New way to inform the url in Flow for the request node.

* **What is the current behavior?** (You can also link to an open issue here)

  - For the HTTP node

    Currently it was only possible to inform the "url" in two places, in the requests node itself and directly in msg.url

  - For the Template node

    Currently in the template node there was only one registerHelper called "stringify". In FlowBroker it is not possible to perform more complex actions easily.

- **What is the new behavior (if this is a feature change)?**

  - For HTTP node

    Now, in addition to the payload and headers that can be passed as an object for orders, it is also possible to pass a URL. This helps a lot when the same flow uses multiple orders.

  - For the model node

    RegisterHelper functions have been added that allow the node to perform calculation models (+, -, /, \ \*), make checks (<=,> =, =), return unique identifications, transfer unix data (type that dojot works) in other formats

* **Does this PR introduce a breaking change?** (What changes might users need to make in their application due to this PR?)

  No

- **Is there any issue related to this PR in other repository?** (such as dojot/dojot)

  No

* **Other information**:

  Information on the added HandleBars functionality is in the repository [**Working HandleBars**](https://github.com/ErnandesAJr/working-handlebars).
