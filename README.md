# Platform Gateway

| Release    | Build Status                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge**   | [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fgateway%2Fdevelop)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/gateway/job/develop/) |
| **Latest** | [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fgateway%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/gateway/job/master/)   |

GraphQL endpoint providing a single endpoint to access data from Argo's many services.

## Development

### Quick Start

- Set up environment: copy `.env.schema` to `.env` and update environment accordingly if needed. Values provided in the schema file can be used when running the server locally for development.
- Install dependencies: `npm ci` (depending on your Node version, it may require a '--legacy-peer-deps' flag)
- Insure your system has Docker and Postgres installed and running.
- Add a # to comment out line 37 in docker-compose.yml
- Navigate to `./compose` and run `docker-compose up -d` to start up elasticsearch & program service
- Navigate back to project root and run `npm run programDashboardEsInit && npm run fileCentricEsInit` to initialize some data for local development.
- Run server locally: `npm run dev`

### Dev Note for Writing GraphQL Schemas

- Nullable VS Non-null fields:

  - When adding fields to type `DonorSummaryEntry`, since `programDonorSummaryEntries` API gets data from ES `donor-summary-submission` indices, we must first determine if the data source of the new field is already populated in ES. if the new field can be null in ES index, mark the graphql field as nullable; if the new field is non-null in ES index, mark the grphql field with `!` to indicate that it's non-null.

  Example:

  ```ts
  type User {
    name: String! // non-null
    age: Int // nullable
  }
  ```

- Digging deeper: Nulls in the response

  - If you get a null value for a non-null field, GraphQL returns a data collection of `null`, meaning it doesn't return other fields even if they have values. This is why we must identify fields' nullability before adding them to schema:

  ```ts
  data: {
  	user: null;
  }
  ```

  - If you get a null value for a nullable field, GraphQL returns `null` for this field and other fields:

  ```ts
  data: {
    user: {
        name: null,
        age: 25,
        // other fields on user
    }
  }
  ```
