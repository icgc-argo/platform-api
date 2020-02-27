"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
exports.default = apollo_server_express_1.gql `
  directive @cost(
    multipliers: [String]
    useMultipliers: Boolean
    complexity: Int
  ) on OBJECT | FIELD_DEFINITION
`;
//# sourceMappingURL=costDirectiveTypeDef.js.map