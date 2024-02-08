import {
  ForEachMapValuePrependKey,
  InferTupledMap,
  TupleMapBuilder,
  TypedTupleMapBuilderCompletedResult,
  compositeType,
  createSchemaBuilder,
  dateType,
  listAttribute,
  mapAttribute,
  numberType,
  partitionKey,
  schemaType,
  sortKey,
} from "./schema";

type PreventEmptyObject<T> = keyof T extends never ? never : T;

type PickByValue<T, ValueType> = PreventEmptyObject<
  Omit<T, { [Key in keyof T]: T[Key] extends ValueType ? never : Key }[keyof T]>
>;

type OmitByValue<T, ValueType> = PreventEmptyObject<
  Omit<T, { [Key in keyof T]: T[Key] extends ValueType ? Key : never }[keyof T]>
>;

type SingleOrArray<T> = T | T[];

export type Attribute<A, T> = { attributeType: A; dataType: T };

export type IndexAttributeValueTypes = string | number | boolean;

export type PartitionKey<T extends IndexAttributeValueTypes> = Attribute<"PARTITION_KEY", T>;

export type SortKey<T extends IndexAttributeValueTypes> = Attribute<"SORT_KEY", T>;

type PrimaryKeyAttributes<T> = PickByValue<
  T,
  PartitionKey<IndexAttributeValueTypes> | SortKey<IndexAttributeValueTypes>
>;

type NonPrimaryKeyAttributes<T> = OmitByValue<
  T,
  PartitionKey<IndexAttributeValueTypes> | SortKey<IndexAttributeValueTypes>
>;

type EntitySchema<K extends string | number | symbol> = Record<
  K,
  string | number | bigint | boolean | null | undefined | Date | Attribute<string, unknown>
>;

type NormalOrIndexAttributeDataType<T> = T extends Attribute<string, infer U> ? U : T;

// Not sure if it makes sense to have this type stricter as `F extends keyof S`
// type ComparisonOperatorDefinition<F extends string | number | symbol, O extends string, S extends EntitySchema<F>> = {
type ComparisonOperatorDefinition<
  F extends string | number | symbol,
  O extends string,
  S extends Record<F, unknown>,
> = {
  field: F;
  operator: O;
  value: NormalOrIndexAttributeDataType<S[F]>;
};

// The type might be make stricter by accepting the operator as a generic type parameter. It might help during implementation of the builder.
type LogicalOperatorDefinition = {
  operator: QueryLogicalOperators;
  conditions: Array<ComparisonOperatorDefinition<string, string, EntitySchema<string>> | LogicalOperatorDefinition>;
};

type OperatorDefinition<
  T extends "conditional" | "logical" | "function",
  O extends
    | ComparisonOperatorDefinition<string | number | symbol, string, EntitySchema<string>>
    | LogicalOperatorDefinition,
> = {
  type: T;
  operator: T extends "logical" ? O[] : O;
};

export type TupleKeyValuePeer<T extends string | number | symbol, V> = [T, V];

type TupleKeys<T> = T extends [infer FT, ...infer R]
  ? FT extends [infer K, infer V]
    ? K | TupleKeys<R>
    : never
  : never;

type TupleKey<T> = T extends [infer K, infer V] ? K : never;
type TupleValue<T> = T extends [infer K, infer V] ? V : never;

type TupleValues<T> = T extends [infer FT, ...infer R]
  ? FT extends [infer K, infer V]
    ? V | TupleValues<R>
    : never
  : never;

type TupleValueByKey<T, K> = T extends [infer FT, ...infer R]
  ? FT extends [K, infer V]
    ? V
    : TupleValueByKey<R, K>
  : never;

type TupleKeyedEntitySchema = TupleKeyValuePeer<
  string,
  [TupleKeyValuePeer<string, unknown>, ...TupleKeyValuePeer<string, unknown>[]]
>;

type TupleKeyedEntityScheams = [TupleKeyedEntitySchema, ...TupleKeyedEntitySchema[]];

type ComparisonOperatorFactory<N, S extends Record<string, unknown>, O extends string> = <
  LN extends N, // necessary to make the model names generics work
  F extends keyof S = keyof S,
>(
  field: F,
  operator: O,
  value: NormalOrIndexAttributeDataType<S[F]>,
) => OperatorDefinition<"conditional", ComparisonOperatorDefinition<F, O, S>>;

type LogicalOperatorFactory<S extends EntitySchema<string>> = <F extends keyof S>(
  operator: QueryLogicalOperators,
  ...conditions: ComparisonOperatorDefinition<F, QueryComparisonOperators, S>[]
) => OperatorDefinition<"logical", LogicalOperatorDefinition>;

type QueryComparisonOperators = "=" | "<>" | "<" | "<=" | ">" | ">=" | "begins_with" | "between" | "in";

type QueryFunctions = "attribute_type" | "attribute_exists" | "attribute_not_exists" | "contains" | "size";

type QueryLogicalOperators = "and" | "or" | "not";

// @TODO: add map, list and set types
type AttributeTypesToOperatorsTupledMap = [
  [PartitionKey<any>, "="],
  [SortKey<any>, "=" | "<" | "<=" | ">" | ">=" | "begins_with" | "between"],
  [string, QueryComparisonOperators | QueryFunctions],
  [number, QueryComparisonOperators | QueryFunctions],
  [bigint, QueryComparisonOperators | QueryFunctions],
  [boolean, QueryComparisonOperators | QueryFunctions],
  [Date, QueryComparisonOperators | QueryFunctions],
];

type GetAttributeOperatorsByType<T, M> = M extends [infer FT, ...infer R]
  ? FT extends [T, infer O]
    ? O
    : GetAttributeOperatorsByType<T, R>
  : never;

type MapLeafKeys<T> = {
  [K in keyof T]: T[K] extends object ? `${K & string}.${MapLeafKeys<T[K]>}` : `${K & string}`;
}[keyof T];
// Get leaf keys from an object with value types
// Get leaf keys from an object with value types togather with corresponding type as a tuple

// type LeafKeysWithTypes<T> = {
//   [K in keyof T]: T[K] extends infer V ? (V extends string ? [Record<K, V>] : LeafKeysWithTypes<V>) : never;
// }[keyof T];

type LeafKeysWithTypes<T, P = unknown> = {
  [K in keyof T]: T[K] extends object
    ? LeafKeysWithTypes<T[K], P extends string ? `${P}.${K & string}` : K>
    : [P extends string ? `${P}.${K & string}` : K, T[K]];
}[keyof T];

// type LeafKeysWithTypesTuple<T> = TupleKeyValuePeer<LeafKeysWithTypes<T>[0], LeafKeysWithTypes<T>[1]>;

type RandomObject = {
  a: number;
  b: string;
  c: {
    a: boolean;
    d: {
      g: string;
    };
  };
};

type T = LeafKeysWithTypes<RandomObject>;
const T: T = ["c.d.g", "sdad"];

// A tuple attribute can be created based on the list type
// export type ListAttribute<T> = Attribute<"LIST", T[]>;
export type ListAttribute<T> = Attribute<"LIST", T>; // changing type from T[] to T to avoid problems with extracting Attribute value types

export type MapAttribute<T> = Attribute<"MAP", T>;

export type SetAttributeValueTypes = string | number;

// Set attribute can contain string, number and binary types
export type SetAttribute<T extends SetAttributeValueTypes> = Attribute<"SET", T[]>;

type ForEachKeyComparisonOperatorFactory<K, T> = T extends [infer KeyValuePeer, ...infer R]
  ? KeyValuePeer extends TupleKeyValuePeer<string, unknown>
    ? ComparisonOperatorFactory<
        K,
        Record<TupleKey<KeyValuePeer>, TupleValue<KeyValuePeer>>,
        GetAttributeOperatorsByType<TupleValue<KeyValuePeer>, AttributeTypesToOperatorsTupledMap>
      > &
        ForEachKeyComparisonOperatorFactory<K, R>
    : never
  : T;

type OverloadableComparisonFactory<T> = T extends [infer EntityTupleSchema, ...infer R]
  ? EntityTupleSchema extends [infer K, infer Schemas]
    ? ForEachKeyComparisonOperatorFactory<K, Schemas> & OverloadableComparisonFactory<R>
    : never
  : T;

type PickOnlyPrimaryKeyAttributesFromTupledFieldSchemasList<T> = T extends [infer AttributeTuple, ...infer R]
  ? TupleValue<AttributeTuple> extends PartitionKey<IndexAttributeValueTypes> | SortKey<IndexAttributeValueTypes>
    ? [
        [TupleKey<AttributeTuple>, TupleValue<AttributeTuple>],
        ...PickOnlyPrimaryKeyAttributesFromTupledFieldSchemasList<R>,
      ]
    : PickOnlyPrimaryKeyAttributesFromTupledFieldSchemasList<R>
  : T;

type PickOnlyPrimaryKeyAttributesFromTupledModelSchemasList<T> = T extends [infer Model, ...infer R]
  ? Model extends [infer K, infer L]
    ? [
        [K, PickOnlyPrimaryKeyAttributesFromTupledFieldSchemasList<L>],
        ...PickOnlyPrimaryKeyAttributesFromTupledModelSchemasList<R>,
      ]
    : never
  : T;

type PickOnlyNonPrimaryKeyAttributesFromTupledFieldSchemaList<T> = T extends [infer AttributeTuple, ...infer R]
  ? TupleValue<AttributeTuple> extends PartitionKey<IndexAttributeValueTypes> | SortKey<IndexAttributeValueTypes>
    ? PickOnlyNonPrimaryKeyAttributesFromTupledFieldSchemaList<R>
    : [
        [TupleKey<AttributeTuple>, TupleValue<AttributeTuple>],
        ...PickOnlyNonPrimaryKeyAttributesFromTupledFieldSchemaList<R>,
      ]
  : T;

type PickOnlyNonPrimaryKeyAttributesFromTupledModelSchemasList<T> = T extends [infer Model, ...infer R]
  ? Model extends [infer K, infer L]
    ? [
        [K, PickOnlyNonPrimaryKeyAttributesFromTupledFieldSchemaList<L>],
        ...PickOnlyNonPrimaryKeyAttributesFromTupledModelSchemasList<R>,
      ]
    : never
  : T;

type ConditionExpressionBuilder<S extends TupleKeyedEntityScheams> = (
  expressionBuilder: OverloadableComparisonFactory<S>,

  // @TODO: add possibility to target specific entity type via generic parameter
  // Awaits for the results of first usage and a feedback on usefulness on targeting a specific type in the condition expression
  logicalOperators: {
    [LK in QueryLogicalOperators]: (
      conditions: Array<
        // @TODO: fix schema types for the logical conditions section
        // | OperatorDefinition<"conditional", ComparisonOperatorDefinition<string, QueryComparisonOperators, S>>
        | OperatorDefinition<
            "conditional",
            ComparisonOperatorDefinition<string, QueryComparisonOperators | QueryFunctions, EntitySchema<string>>
          >
        | OperatorDefinition<"logical", LogicalOperatorDefinition>
      >,
    ) => OperatorDefinition<"logical", LogicalOperatorDefinition>;
  },
) => any;

type QueryOperationBuilder<S extends TupleKeyedEntityScheams> = {
  keyCondition: (
    builder: ConditionExpressionBuilder<PickOnlyPrimaryKeyAttributesFromTupledModelSchemasList<S>>,
  ) => QueryOperationBuilder<S>;
  filter: (
    builder: ConditionExpressionBuilder<PickOnlyNonPrimaryKeyAttributesFromTupledModelSchemasList<S>>,
  ) => QueryOperationBuilder<S>;
};

type QueryBuilder<S extends TupleKeyedEntityScheams> = {
  query: () => QueryOperationBuilder<S>;
};

type Builder<S extends TupleKeyedEntityScheams> = QueryBuilder<S>;

type ExampleUsersEntitySchema = {
  pk: PartitionKey<`users#${string}`>;
  sk: SortKey<`users#${number}`>;
  age: number;
};

type ExamplePostsEntitySchema = {
  pk: PartitionKey<`posts#${string}`>;
  sk: SortKey<number>;
  publishingDate: Date;
};

type ExampleCommentsEntitySchema = {
  pk: PartitionKey<`comments#${string}`>;
  sk: SortKey<`comments#${boolean}`>;
};

type ExampleTableSchema = {
  users: ExampleUsersEntitySchema;
  posts: ExamplePostsEntitySchema;
  comments: ExampleCommentsEntitySchema;
};

/**
 * Experiment with fully string condition
 *
 * Benefits:
 * - Simplicity of writing conditions;
 *
 * Disadvantages:
 * - Hard to compose conditions on the go when if/else logic is required;
 * - Hard to pass runtime data;
 */
type SimpleStringCondition<T extends EntitySchema<string>, O extends string, K extends keyof T> = `${K &
  string} ${O} ${NormalOrIndexAttributeDataType<T[K]> & (string | number | boolean)}`;

type SimpleStringConditionFn<T extends EntitySchema<string>> = <K extends keyof T>(
  condition: T[K] extends PartitionKey<IndexAttributeValueTypes>
    ? SimpleStringCondition<T, "=", K>
    : T[K] extends SortKey<IndexAttributeValueTypes>
    ? SimpleStringCondition<T, Exclude<QueryComparisonOperators, "!=" | "between" | "in">, K>
    : SimpleStringCondition<T, QueryComparisonOperators, K>,
) => any;

const flatTest = null as unknown as SimpleStringConditionFn<ExampleUsersEntitySchema>;

flatTest("pk = users#some-random-user-id");

const schemaBuilder = {} as unknown as TupleMapBuilder;

type US = TupleMapBuilder<ExampleUsersEntitySchema>;
const us: US = null as any;
const usv: TypedTupleMapBuilderCompletedResult = us
  .add("pk", partitionKey(compositeType((builder) => builder.literal("users#").string())))
  .add("sk", sortKey(compositeType((builder) => builder.literal("users#").number())))
  .add("age", numberType())
  .build();

const usersSchema = createSchemaBuilder()
  .add("pk", partitionKey(compositeType((builder) => builder.literal("users#").string())))
  .add("sk", sortKey(numberType()))
  .add("age", numberType())
  .add(
    "address",
    mapAttribute(
      createSchemaBuilder()
        .add("city", mapAttribute(createSchemaBuilder().add("name", "value").add("province", "value").build()))
        .add("street", "value")
        .add("zip", numberType())
        .add("building", "value")
        .build(),
    ),
  )
  .add(
    "cards",
    listAttribute(mapAttribute(createSchemaBuilder().add("last4", numberType()).add("type", "value").build())),
  )
  .build();

const postsSchema = schemaBuilder
  .add("pk", partitionKey(compositeType((builder) => builder.literal("posts#").string())))
  .add("sk", sortKey(numberType()))
  .add("publishingDate", dateType())
  .build();

const commetnsSchema = schemaBuilder
  .add("pk", partitionKey(compositeType((builder) => builder.literal("comments#").string())))
  .add("sk", sortKey(compositeType((builder) => builder.literal("comments#").boolean())))
  .build();

const schema = schemaBuilder
  .add("users", schemaType(usersSchema))
  .add("posts", schemaType(postsSchema))
  .add("comments", schemaType(commetnsSchema))
  .build();

type SchemaType = InferTupledMap<typeof schema>;
const builder = {} as unknown as Builder<SchemaType>;

builder
  .query()
  .keyCondition((eb, { or, and }) =>
    or([
      eb("pk", "=", "users#some-random-user-id"),
      eb("sk", "=", 10),
      eb<"comments">("pk", "=", "comments#random-id"),
      eb<"posts">("pk", "=", "posts#sda"), // @TODO: fix this. It should not allow wrong value type
      eb<"users">("pk", "=", "users#some-random-user-id"),

      // Simple consitions
      eb("sk", "=", 1),
      eb("pk", "=", "users#some-random-user-id"),
      eb("pk", "=", "posts#random-id"),
      eb("sk", "=", 10),
      eb("pk", "=", "comments#random-id"),

      // Should not work
      eb<"posts">("pk", "=", "users#some-random-user-id"),
      eb("pk", ">=", "posts#random-id"),
      eb("sk", "=", "10"),
      eb("sdada", "=", "10"),

      // Complex conditions
      and([eb("pk", "=", "posts#random-id")]),
      and([eb("pk", "=", "posts#random-id"), eb("sk", "=", 2)]),
      and([
        or([eb("pk", "=", "users#some-random-user-id-2"), eb("pk", "<>", "users#some")]),
        eb("sk", ">=", 20),
        eb("sk", "<=", 50),
      ]),
    ]),
  )
  .filter((eb, { and }) =>
    and([
      eb("age", "=", 1),
      eb("publishingDate", ">", new Date()),

      // Nested data types
      eb("address.city.name", "=", "New York"),
      eb("address.zip", "=", 12345),
      eb("cards.[0].last4", "=", 1234),

      // should not work
      eb("publishingDate", ">", 1),
      eb("way", "begins_with", "a"),
    ]),
  );

// const op: ComparisonOperatorFactory<ExampleUsersEntitySchema, QueryComparisonOperators> = (field, operator, value) => ({
//   type: "conditional",
//   operator: {
//     field,
//     operator,
//     value,
//   },
// });

// const userTestId = `users#some-random-user-id`;
// op("pk", "=", userTestId);
// op("pk", "!=", userTestId);
// op("pk", "<", userTestId);
// op("pk", "<=", userTestId);
// op("pk", ">", userTestId);
// op("pk", ">=", userTestId);
// op("pk", "begins_with", userTestId);
// op("pk", "between", userTestId);
// op("pk", "in", userTestId);

// op("sk", "=", "test");

// op("age", "=", 1);

// const type: `users#${string}` = "users#some-random-user-id";
