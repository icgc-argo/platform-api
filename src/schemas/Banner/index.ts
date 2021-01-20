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
    const bannersParsed = [].concat(JSON.parse(bannersStr));

    const bannersValidated = bannersParsed.reduce((acc, curr) => ({
      ...acc,
      ...(BannerTI.test(curr)
        ? { valid: [...acc.valid, curr] }
        : { invalid: [...acc.invalid, curr] }
      )
    }), { valid: [], invalid: [] })

    result = bannersValidated.valid.map((banner: Banner) => {
      const { dismissable, id, level, title, message = '' } = banner;
      return ({ dismissable, id, level, title, message });
    });

    bannersValidated.invalid.forEach((banner: any) => {
      // check() will throw errors on invalid banners
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
