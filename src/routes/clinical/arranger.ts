import { get } from 'lodash';
import fetch from 'node-fetch';
import urljoin from 'url-join';

import { ADVERTISED_HOST } from 'config';

const url = urljoin(ADVERTISED_HOST, '/graphql');

const hitsQuery = `
  query hitsQuery($filters: JSON, $first: Int) {
    file {
      hits(filters: $filters, first: $first) {
        edges {
          node {
            donors {
              hits {
                edges {
                  node {
                    donor_id
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

const totalQuery = `
  query totalQuery($filters: JSON) {
    file {
      hits(filters: $filters) {
        total
      }
    }
  }`;

function makeRequest({ query, variables }: { query: string; variables: Record<string, unknown> }) {
	return JSON.stringify({
		query,
		variables,
	});
}

function createQueryClient({ requestConfig }: { requestConfig: Record<string, unknown> }) {
	return async ({ query }: { query: string }) => {
		try {
			const response = await fetch(url, {
				...requestConfig,
				body: query,
			});
			const data = await response.json();
			return data;
		} catch (error) {
			console.error(`Failed to query server`, error);
		}
	};
}

async function queryArranger({
	requestFilter,
	egoJwt,
}: {
	requestFilter: Record<string, unknown>;
	egoJwt: string;
}): Promise<string[]> {
	const requestConfig = {
		method: 'post',
		headers: { Authorization: `Bearer ${egoJwt}`, 'Content-Type': 'application/json' },
	};
	try {
		const queryClient = createQueryClient({ requestConfig });
		const queryVariables = { filters: requestFilter };
		// need two queries to pass "total" into hits filter to specify offset range
		const queryResponse = await queryClient({ query: makeRequest({ query: totalQuery, variables: queryVariables }) });
		const totalHits = get(queryResponse, 'data.file.hits.total');
		const hits = await queryClient({
			query: makeRequest({ query: hitsQuery, variables: { ...queryVariables, first: totalHits } }),
		});

		const donorEdgePath = 'data.file.hits.edges';
		const records = get(hits, donorEdgePath, undefined);

		if (!records) {
			return [];
		} else {
			const donorIdPath = 'node.donors.hits.edges[0].node.donor_id';
			return Array.from(new Set(records.map((record: Record<string, unknown>) => get(record, donorIdPath))));
		}
	} catch (error) {
		throw Error(`Query Arranger failed.`, error);
	}
}

export default queryArranger;
