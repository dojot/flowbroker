const express = require('express');

const APP_PORT = 5002;

function initExpressApp() {
  const app = express();
  app.use((req, res, next) => {
    const rawToken = req.header("authorization");
    if (rawToken !== undefined) {
      const token = rawToken.split(".");
      const tokenData = JSON.parse(Buffer.from(token[1], "base64").toString());
      req.service = tokenData.service;
    }
    next();
  });

  app.get("/admin/realms", (req, res) => {
    res.json([{ realm: 'admin' }, { realm: 'master' }]);
  });

  app.post("/realms/master/protocol/openid-connect/token", (req, res) => {
    res.json({
      access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJlTkZWZmJCa0RiMlNpTW1YT3ZzS2oxUjBpdU9Qc3dlZWc4N2RxbEYxeVg0In0.eyJleHAiOjE2MTg4NjcyODEsImlhdCI6MTYxODg2Njk4MSwiYXV0aF90aW1lIjoxNjE4ODY2OTgwLCJqdGkiOiI4ZTdjZjRkZC1lNzgyLTRiNDAtOTNlMi0wNjMzOGMwYTE2MWYiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwMDAvYXV0aC9yZWFsbXMvYWRtaW4iLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNjliNDNjZGQtMDE3ZS00MzU3LWIyNzYtZmU5MTY0YjFmMjRjIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiZ3VpIiwic2Vzc2lvbl9zdGF0ZSI6ImYwMDlhYzQ4LTgwNzItNGJhMS05Yzg5LTM5MjA1MDI4MmJlMSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJhZG1pbiIsInVtYV9hdXRob3JpemF0aW9uIiwidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIGVtYWlsIHByb2ZpbGUiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWRtaW4ifQ.Mt267jx_jDouq5Q5Mfi3J3Qrxr5se6vV42sWamjlGgVPfdHAJec3d0bIXXJquOIpaWfHVM95Al2X8UkHvpmOfQ838t9DChpZNYG1rOXKFRu0lLuyBlVk5ADahMpY-OhnZ-1DGw-cclXAy2Aa1leSZlL49yKQ1naDZspMfA11gQI9Emy_OmG58JuZIo9txDVXvfgAoI3zHuIaKgv9aib11mzbQtTTmAqb9XZu4HMyWawAkMzst6J6SbeOeYXBwG4cUZWH2r3sD0ykss4nYguHhK6f5nVeloEX0Oht2hOYoL6p8gyVp5pmc9mTzql78N1mLx2TLoso6NL6AoU2Tvbf5w'

    });
  });

  app.listen(APP_PORT, "0.0.0.0", () => {
    console.log("dojot mocks started.");
  });
}

initExpressApp();
