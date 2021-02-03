import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { createCheckers } from "ts-interface-checker";
import logger from '../../utils/logger';
import systemAlertTI from "./systemAlert-ti";

const { SystemAlertTI } = createCheckers(systemAlertTI);

// NOTE: we're validating system alerts at runtime with JavaScript,
// using TS interfaces/types and the "ts-interface-checker" library,
// rather than validating with TypeScript at buildtime.

// this is to avoid breaking the build if a alert is invalid.
// there's no other checks on alert data,
// because it's in an env variable, not a database.

// if a alert is invalid, the error will be logged,
// the build will continue, and valid system alerts will still be served.

interface SystemAlert {
  dismissable: boolean;
  id: string;
  level: 'error'|'info'|'warning';
  message?: string;
  title: string;
}

type AllowedFields = keyof SystemAlert;

// deliberately not typed to avoid throwing TS errors
// if a system alert includes extra fields.
const allowedFields = [
  'dismissable',
  'id',
  'level',
  'message',
  'title',
];

const logError = (message: string, name: string) => {
  logger.error(`📜 System Alert - ${name} - ${message}`);
};

const getSystemAlerts = () => {
  let result: SystemAlert[] = [];

  try {
    const alertsStr = process.env.SYSTEM_ALERTS || '';

    const alertsParsed = [].concat(JSON.parse(alertsStr));

    const alertsValidated = alertsParsed.reduce((acc, curr) => ({
      ...acc,
      ...(SystemAlertTI.test(curr)
        ? { valid: [...acc.valid, curr] }
        : { invalid: [...acc.invalid, curr] }
      )
    }), { valid: [], invalid: [] });

    result = alertsValidated.valid
      .map((alert: SystemAlert) =>
        Object.keys(alert)
          .filter(key => allowedFields.includes(key))
          .reduce((acc, curr: AllowedFields) =>
            ({ ...acc, [curr]: alert[curr] }), {} as SystemAlert)
      );

    alertsValidated.invalid.forEach((alert: any) => {
      // check() will throw errors on invalid system alerts.
      SystemAlertTI.check(alert);
    });
  } catch (e) {
    logError(e.message, e.name);
  } finally {
    return result;
  }
}

const alertsArray = getSystemAlerts();

logger.info(`📜 System Alerts: ${JSON.stringify({ alertsArray })}`);

const typeDefs = gql`
  type SystemAlert {
    dismissable: Boolean!
    id: ID!
    level: String!
    message: String
    title: String!
  }
  type Query {
    systemAlerts: [SystemAlert]
  }
`;

const resolvers = {
  Query: {
    systemAlerts: () => alertsArray,
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
