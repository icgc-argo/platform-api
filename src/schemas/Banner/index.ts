import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { isEqual } from 'lodash';
import { validateType } from "ts-validate-type";

interface Banner {
  dismissable: boolean;
  id: number;
  level: 'error'|'info'|'warning';
  message?: string;
  title: string;
}

function instanceOfBanner(banner: Banner): banner is Banner {
  console.log('title' in banner);
  return 'title' in banner;
}

// type BannerObj = {
//   [key: string]: string
// }

// const bannerFieldsRequired: BannerObj = {
//   'dismissable': 'boolean',
//   'id': 'number',
//   'level': 'string',
//   'title': 'string',
// };

// const bannerFieldsAllowed: BannerObj = {
//   ...bannerFieldsRequired,
//   'message': 'string',
// };

// const bannerLevelsAllowed = [
//   'error',
//   'info',
//   'warning',
// ];

// const getBanners = () => {
//   try {
//     const bannersStr = process.env.BANNERS || '';
//     const bannersParsed = JSON.parse(bannersStr);

//     if (!Array.isArray(bannersParsed)) {
//       throw new Error('Banners need to be an array');
//     }

//     bannersParsed.forEach(banner => {
//       const errorTitle = `"${banner.title}"`;
//       const bannerKeys = Object.keys(banner).sort();

//       const checkFields = isEqual(bannerKeys, Object.keys(bannerFieldsRequired).sort()) || isEqual(bannerKeys, Object.keys(bannerFieldsAllowed).sort());

//       if (!checkFields) {
//         throw new Error(`Fields incorrect in ${errorTitle}`);
//       }

//       for (const [key, value] of Object.entries(banner)) {
//         const expectedType = bannerFieldsAllowed[key];
//         const checkType = expectedType === typeof value;
//         if (!checkType) {
//           throw new Error(`${key} should be a ${expectedType} in ${errorTitle}`);
//         }
//       }
      
//       const checkLevel = bannerLevelsAllowed.includes(banner.level);
//       if (!checkLevel) {
//         throw new Error(`Invalid level "${banner.level}" in ${errorTitle}`);
//       }
//     });

//     return bannersParsed;
//   } catch (e) {
//     console.log('Banners', e.name, '-', e.message);
//     return [];
//   }
// };

const getBanners = () => {
  try {
    const bannersStr = process.env.BANNERS || '';
    const bannersParsed = JSON.parse(bannersStr);

    if (!Array.isArray(bannersParsed)) {
      // TODO: check if it's an instance of banner
      throw 'Banners need to be an array';
    }

    const bannersArray = bannersParsed.filter(banner => {
      // TODO: check if it's an instance of banner
      return true;
    });

    return bannersParsed;
  } catch (e) {
    console.log(e.name, e.message)
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
