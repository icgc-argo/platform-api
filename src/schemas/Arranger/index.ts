// @ts-ignore
import { createProjectSchema } from 'arranger-server-jaserud/dist/startProject';

import { GraphQLSchema, printSchema } from 'graphql';
import { transformSchema, TransformRootFields } from 'graphql-tools';
import { getEsClient } from 'services/elasticsearch';
import { ARRANGER_PROJECT_ID } from 'config';

// note: Setting up ES for arranger (has to be done before gateway is deployed)
// 1. Setup up index with mapping in ES
//    - index name should follow `/[_A-Za-z][_0-9A-Za-z]*/` because grapql only accepts feilds formatted as such
// 2. Setup arranger project indices
// This process is manual for now because the es setup is still a wip

const getArrangerGqlSchema = async () => {
  const id = ARRANGER_PROJECT_ID;
  const es = await getEsClient();

  // Create arranger schema
  const { schema: argoArrangerSchema } = (await createProjectSchema({
    es,
    id,
    graphqlOptions: {},
    enableAdmin: false,
  })) as { schema: GraphQLSchema };

  printSchema(argoArrangerSchema);

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
