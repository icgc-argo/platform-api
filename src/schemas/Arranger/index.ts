import 'babel-polyfill';

// @ts-ignore
import { createProjectSchema } from '@arranger/server/dist/startProject';

import { GraphQLSchema } from 'graphql';
import { transformSchema, TransformRootFields } from 'graphql-tools';
import { ARRANGER_PROJECT_ID } from 'config';
import { Client } from '@elastic/elasticsearch';
import initArrangerMetadata from './initArrangerMetadata';

export type ArrangerGqlContext = {
  es: Client;
  projectId: string;
};

const getArrangerGqlSchema = async (esClient: Client) => {
  await initArrangerMetadata(esClient);

  // Create arranger schema
  const { schema: argoArrangerSchema } = (await createProjectSchema({
    es: esClient,
    id: ARRANGER_PROJECT_ID,
    graphqlOptions: {},
    enableAdmin: false,
  })) as { schema: GraphQLSchema };

  // Arranger schema has a recursive field called 'viewer' inside of type 'Root'
  // there is bug in graphql-tools which is unable to interpret this so 'mergeSchema' doesn't work
  // this schema transform is a work around for that, which removes the field
  const transformedSchema = transformSchema(argoArrangerSchema, [
    removeViewerFieldInRootTypeTransform,
  ]);

  return transformedSchema;
};

// This transform is applied to every root field in a schema
// it only removes the Query field named viewer
const removeViewerFieldInRootTypeTransform = new TransformRootFields(
  (operation: 'Query' | 'Mutation' | 'Subscription', fieldName: String, _) => {
    if (operation === 'Query' && fieldName === 'viewer') return null; // return null deletes the field
    return undefined; // return undefined doesn't change field
  },
);

export default getArrangerGqlSchema;
