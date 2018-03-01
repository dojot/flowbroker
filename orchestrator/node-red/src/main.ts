import util = require("util");
import { ExpressApp } from "./express-app";

let app = new ExpressApp();

app.start(1880, () => {
  console.log("App started")
})