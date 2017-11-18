import {
  GraphQLFieldMap,
  GraphQLFieldConfigMap,
  getNamedType,
  isLeafType,
  GraphQLInputObjectType,
  getNullableType,
  GraphQLInputFieldConfigMap,
  GraphQLEnumType
} from 'graphql'
import { firestore } from 'firebase/app'
import { CollectionType } from '.'

export type FieldMap = GraphQLFieldMap<any, any>
export type FieldConfigMap = GraphQLFieldConfigMap<any, any>

export const getScalarFields = (fields: FieldMap): FieldMap =>
  Object.keys(fields).reduce((all, fieldName) => {
    const field = fields[fieldName]
    const NamedType = getNamedType(field.type)
    if (isLeafType(NamedType)) {
      return {
        ...all,
        ...{ [fieldName]: field }
      }
    }
    return all
  }, {})

export const getCollectionFields = (fields: FieldMap): FieldMap =>
  Object.keys(fields).reduce((all, fieldName) => {
    const field = fields[fieldName]
    const NamedType = getNamedType(field.type)
    if (NamedType instanceof CollectionType) {
      return { ...all, ...{ [fieldName]: field } }
    }
    return all
  }, {})

export const getPaginationFields = (
  fields: FieldMap
): GraphQLInputFieldConfigMap => {
  return {}
}

export const createOrderByType = (
  fields: FieldMap,
  prefix: string
): GraphQLEnumType =>
  new GraphQLEnumType({
    name: `${prefix}OrderBy`,
    values: Object.keys(fields).reduce((all, fieldName) => {
      const field = fields[fieldName]
      const name = field.name.toUpperCase()
      const descKey = `${name}_DESC`
      const ascKey = `${name}_ASC`
      return {
        ...all,
        ...{
          [descKey]: {
            value: `${field.name}.desc`
          },
          [ascKey]: {
            value: `${field.name}.asc`
          }
        }
      }
    }, {})
  })

export const createFilterType = (
  fields: FieldMap,
  prefix: string
): GraphQLInputObjectType =>
  new GraphQLInputObjectType({
    name: `${prefix}Filter`,
    fields: Object.keys(fields).reduce((all, fieldName) => {
      const field = fields[fieldName]
      const type = getNullableType(field.type)
      const name = field.name
      all[name] = { type }
      all[`${name}_gt`] = { type }
      all[`${name}_gte`] = { type }
      all[`${name}_lt`] = { type }
      all[`${name}_lte`] = { type }
      return all
    }, {})
  })

export interface Operation {
  path: string
  operation: firestore.WhereFilterOp
}

export interface OrderByOperation {
  path: string
  operation: firestore.OrderByDirection
}

export const getOperation = (argName: string): Operation => {
  const [path, operator] = argName.split('_')
  let operation: firestore.WhereFilterOp
  switch (operator) {
    case 'gt':
      operation = '>'
      break
    case 'gte':
      operation = '>='
      break
    case 'lt':
      operation = '<'
      break
    case 'lte':
      operation = '<='
      break
    default:
      operation = '=='
      break
  }
  return { path, operation }
}

export const getOrderByOperation = (argValue: string): OrderByOperation => {
  const [path, operation] = argValue.split('.') as [
    string,
    firestore.OrderByDirection
  ]
  return { path, operation }
}
