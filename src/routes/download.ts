import logger from '../utils/logger';
import express from 'express';
import { createEsClient } from 'services/elasticsearch';
import { RequestParams, ApiResponse } from '@elastic/elasticsearch';

var router = express.Router();

interface ShardsResponse {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
}
interface Explanation {
  value: number;
  description: string;
  details: Explanation[];
}
interface SearchBody {
  query: {
    match: { programId: string };
  };
}
interface SearchResponse<T> {
  took: number;
  timed_out: boolean;
  _scroll_id?: string;
  _shards: ShardsResponse;
  hits: {
    total: number;
    max_score: number;
    hits: Array<{
      _index: string;
      _type: string;
      _id: string;
      _score: number;
      _source: T;
      _version?: number;
      _explanation?: Explanation;
      fields?: any;
      highlight?: any;
      inner_hits?: any;
      matched_queries?: string[];
      sort?: string[];
    }>;
  };
  aggregations?: any;
}

// Define the interface of the source object
interface Source {
  programId: string;
}
const downloadRoute = router.get('/dashboard/:program_id', async (req: any, res: any) => {
  const client = await createEsClient();

  (async () => {
    const program = req.params.program_id;
    const searchParams: RequestParams.Search<SearchBody> = {
      index: 'donor_centric',
      // size: 2,
      scroll: '1m',
      body: {
        query: {
          match: { programId: program },
        },
      },
    };

    const results = await client
      .search(searchParams)
      .then((response: ApiResponse<SearchResponse<Source>>) => response.body)
      .catch((err: Error) => console.warn(err));
    console.log('RESULTS: ', results);
    res.json(results);
  })();
});

export default downloadRoute;
