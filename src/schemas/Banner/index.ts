import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { createCheckers } from "ts-interface-checker";
import logger from '../../utils/logger';
import bannerTI from "./banner-ti";

const { BannerTI } = createCheckers(bannerTI);

interface Banner {
  dismissable: boolean;
  id: string;
  level: 'error'|'info'|'warning';
  message?: string;
  title: string;
}

type AllowedFields = keyof Banner;

// this isn't typed with AllowedFields
// so we can filter out unallowed fields
// without throwing errors or breaking the build
const allowedFields = [
  'dismissable',
  'id',
  'level',
  'message',
  'title',
];

const logError = (message: string, name: string) => {
  logger.error(`📜 Banner - ${name} - ${message}`);
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
    }), { valid: [], invalid: [] });

    result = bannersValidated.valid
      .map((banner: Banner) =>
        Object.keys(banner)
          .filter(key => allowedFields.includes(key))
          .reduce((acc, curr: AllowedFields) =>
            ({ ...acc, [curr]: banner[curr] }), {} as Banner)
      );

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

logger.info(`📜 Banners: ${JSON.stringify({ bannersArray })}`);

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
