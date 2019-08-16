# Platform Gateway

[![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fgateway%2Fdevelop)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/gateway/job/develop/)

GraphQL endpoint providing a single endpoint to access data from Argo's many services.

## Development

### Quick Start

- Set up environment: copy `.env.schema` to `.env` and update environment accordingly if needed. Values provided in the schema file can be used when running the server locally for development.
- Install dependencies: `npm i`
- Run server locally: `npm run dev`
