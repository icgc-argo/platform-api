import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import bannerTI from "./banner-ti";
import { createCheckers } from "ts-interface-checker";
import logger from '../../utils/logger';

const { BannerTI } = createCheckers(bannerTI);

interface Banner {
  dismissable: boolean;
  id: number;
  level: 'error'|'info'|'warning';
  message?: string;
  title: string;
}

const logError = (message: string, name: string) => {
  logger.error(`Banner - ${name} - ${message}`);
};

const getBanners = () => {
  let result: Banner[] = [];

  try {
    const bannersStr = process.env.BANNERS || '';
    const bannersParsed = JSON.parse(bannersStr);

    if (!Array.isArray(bannersParsed)) {
      const isBanner = !BannerTI.test(bannersParsed);
      if (isBanner) {
        result = [bannersParsed];
      } else {
        throw 'Banners need to be an array';
      }
    }

    result = bannersParsed.filter((banner: any) => {
      const isBanner = BannerTI.test(banner);
      console.log(isBanner)
      return isBanner;
    });

    bannersParsed.forEach((banner: any) => {
      BannerTI.check(banner);
    });
  } catch (e) {
    logError(e.message, e.name);
  } finally {
    return result;
  }
}

const bannersArray = getBanners();

console.log({ bannersArray });

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
