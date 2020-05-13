# Platform Gateway

| Release    | Build Status                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge**   | [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fgateway%2Fdevelop)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/gateway/job/develop/) |
| **Latest** | [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fgateway%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/gateway/job/master/)   |

GraphQL endpoint providing a single endpoint to access data from Argo's many services.

## Development

### Quick Start

- Set up environment: copy `.env.schema` to `.env` and update environment accordingly if needed. Values provided in the schema file can be used when running the server locally for development.
- Install dependencies: `npm i`
- Navigate to `./compose` and run `docker-compose up -d` to start up elasticsearch
- `npm run programDashboardEsInit && npm run fileCentricEsInit` to initialize some data to elasticsearch for local development
- Run server locally: `npm run dev`
