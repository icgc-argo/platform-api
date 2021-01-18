import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';

const bannersStr = process.env.BANNERS || '';
const bannerArray = JSON.parse(bannersStr);

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
    banners: () => bannerArray,
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
