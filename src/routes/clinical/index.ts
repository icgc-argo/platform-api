import { Router } from 'express';
import { Client } from '@elastic/elasticsearch';

import { EgoClient } from 'services/ego';

import proxy from './clinical-proxy';
import createClincalApiRouter from './clinical-api';

const createClinicalRouter = async (esClient: Client, egoClient: EgoClient) => {
	const router = Router();

	router.use('/proxy', proxy);
	router.use('/api', await createClincalApiRouter(esClient, egoClient));
	return router;
};

export default createClinicalRouter;
