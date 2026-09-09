import { DateTimeResolver, JSONResolver } from "graphql-scalars";

import type { Resolvers } from "../generated/types";
import { mutationResolvers } from "./mutation";
import { queryResolvers } from "./query";

/**
 * Resolvers stay thin: they validate arguments, call a service and return its result. All
 * business rules live in `src/services`.
 */
export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,
  Query: queryResolvers,
  Mutation: mutationResolvers,
};
