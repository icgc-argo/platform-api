import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import banners from '../../../banners.json';

const typeDefs = gql`
  type Banner {
    dismissable: Boolean!
    id: ID!
    level: String!
    message: String
    title: String!
  }
  type Query {
    banners: [Banner]
  }
`;

const resolvers = {
  Query: {
    banners: () => banners,
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
