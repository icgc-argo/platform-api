"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
exports.default = {
    DateTime: new graphql_1.GraphQLScalarType({
        name: 'DateTime',
        description: 'A string in simplified extended ISO format',
        serialize(value) {
            if (value instanceof Date) {
                return value.toISOString();
            }
            else {
                return null;
            }
        },
        parseValue(value) {
            if (!(typeof value === 'string' || value instanceof String)) {
                return null;
            }
            return new Date(dateTime);
        },
        parseLiteral(ast) {
            if (ast.kind !== Kind.STRING) {
                return null;
            }
            return new Date(ast.value);
        },
    }),
};
//# sourceMappingURL=customScalars.js.map