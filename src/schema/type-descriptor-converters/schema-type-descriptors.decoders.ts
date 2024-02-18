import { Attribute, AttributeType } from "../../attribute/attribute";
import { TupleMap } from "../schema-tuple-map.facade";
import { isTupleMap } from "../schema-tuple-map.utils";
import {
  AttributeTypeDescriptorKey,
  ListTypeDescriptor,
  MapTypeDescriptor,
  TypeDescriptor,
  TypeDescriptorDecoder,
} from "./schema-type-descriptors.types";

const decodersToTypeDescriptorsMap: Record<AttributeTypeDescriptorKey, TypeDescriptorDecoder> = {
  S: (value) => value.S,
  N: (value) => value.N,
  B: (value) => value.B,
  BOOL: (value) => value.BOOL,
  NULL: (value) => value.NULL,
  M: (value) => value.M,
  L: (value) => value.L,
  SS: (value) => value.SS,
  NS: (value) => value.NS,
  BS: (value) => value.BS,
};

export const getDecoderFactoryForValue = (value: Record<string, unknown>): TypeDescriptorDecoder => {
  const typeDescriptorKey = Object.keys(decodersToTypeDescriptorsMap).find(
    (key): key is keyof typeof decodersToTypeDescriptorsMap =>
      value && typeof value === "object" && value.hasOwnProperty(key),
  );

  if (typeDescriptorKey) {
    return decodersToTypeDescriptorsMap[typeDescriptorKey];
  }

  return ((value: unknown) => value) as any; // TODO: fix it
};

// @TODO: the transformers should be rewritten to be fully driven by a shcema

// @TODO: transformers incorrectly work in cases when schema has a field but the decoded value does not! FIX IT!
// @TODO: also, transformers do not transform values into their application level types - numbers, dates, etc..! FIX IT!
export const transformTypeDescriptorToValue = (
  schema: TupleMap | Attribute<AttributeType, unknown>,
  value: Record<string, unknown> | unknown[] | unknown,
): unknown => {
  if (isTupleMap(schema) && schema.getType() === "LIST") {
    if (!value) {
      return [];
    }

    const listItemSchema = schema.getByPath("[0]");

    if (!listItemSchema) {
      throw new Error("List item schema is not found");
    }

    const listDecoder = getDecoderFactoryForValue(value as ListTypeDescriptor);

    return listDecoder(value as ListTypeDescriptor).map((item: unknown) =>
      transformTypeDescriptorToValue(listItemSchema.value(), item),
    );
  }

  if (isTupleMap(schema) && (schema.getType() === "MAP" || schema.getType() === "ROOT")) {
    if (!value) {
      return {};
    }

    const result: Record<string, unknown> = {};
    const valueDecoder = getDecoderFactoryForValue(value as MapTypeDescriptor);
    const unwrappedValue = valueDecoder(value as MapTypeDescriptor) as Record<string, unknown>;

    schema.forEach((keyValue) => {
      const value = unwrappedValue[keyValue.key()];
      const valueSchema = keyValue.value() as TupleMap | Attribute<AttributeType, unknown>;

      if (!valueSchema) {
        throw new Error(`Value schema for field ${keyValue.key()} is not found`);
      }

      result[keyValue.key()] = transformTypeDescriptorToValue(valueSchema, value);
    });

    return result;
  }

  const decoder = getDecoderFactoryForValue(value as TypeDescriptor<string, unknown>);

  return decoder(value as TypeDescriptor<string, unknown>);
};
