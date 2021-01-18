import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';

const getBanners = () => {
  try {
    const bannersStr = process.env.BANNERS || '';
    const bannersParsed = JSON.parse(bannersStr);
    if (!Array.isArray(bannersParsed)) {
      throw new Error('Banners need to be an array');
    } 
    return bannersParsed;
  } catch (e) {
    console.log('Banners error: ', e.name, e.message)
    return [];
  }
}

const bannersArray = getBanners();

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
    banners: () => bannersArray,
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
