import { firestore } from 'firebase/app'
import {
  GraphQLID,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLInputObjectType,
  getNullableType,
  GraphQLObjectTypeConfig,
  GraphQLFieldResolver,
  GraphQLFieldConfig,
  GraphQLEnumType
} from 'graphql'
import * as pluralize from 'pluralize'
import { queryToIterator } from './firebase-to-async-iterator'
import {
  FieldMap,
  FieldConfigMap,
  getOperation,
  getScalarFields,
  getCollectionFields,
  createFilterType,
  createOrderByType,
  getOrderByOperation
} from './utils'

const ResourceId = new GraphQLObjectType({
  name: 'ResourceID',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) }
  }
})

export class CollectionType<TSource> extends GraphQLObjectType {
  scalarFields: FieldMap = getScalarFields(this.getFields())
  subcollectionFields: FieldMap = getCollectionFields(this.getFields())
  filterInputType: GraphQLInputObjectType
  orderByType: GraphQLEnumType

  constructor(
    config: GraphQLObjectTypeConfig<TSource, any>,
    private collection: firestore.CollectionReference
  ) {
    super(config)
    const { id, ...dataFields } = this.scalarFields
    this.filterInputType = createFilterType(dataFields, this.name)
    this.orderByType = createOrderByType(this.scalarFields, this.name)
  }

  get pluralName() {
    return pluralize(this.name).toLowerCase()
  }

  singleQueryResolver(
    collection: firestore.CollectionReference,
    root: any,
    args: { id: string }
  ) {
    const { id } = args
    return collection
      .doc(id)
      .get()
      .then(document => {
        if (document.exists) {
          return { ...document.data(), id }
        }
        throw new Error(`Document with ${id} not found`)
      })
  }

  singleQueryField(
    resolve: GraphQLFieldResolver<any, any>
  ): GraphQLFieldConfig<any, any> {
    return {
      type: new GraphQLNonNull(this as any),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve
    }
  }

  listQueryResolver(
    collection: firestore.CollectionReference,
    _: TSource,
    { filter = {}, orderBy = [] },
    context: {}
  ) {
    // Apply where operations
    let query = Object.keys(filter).reduce((current, filterName) => {
      const { path, operation } = getOperation(filterName)
      return current.where(path, operation, filter[filterName])
    }, collection)

    // Apply orderBy operations
    query = orderBy.reduce((current, value: string) => {
      const { path, operation } = getOrderByOperation(value)
      return query.orderBy(path, operation)
    }, query)

    // Execute the query and map the result
    return query.get().then(snapshot => {
      const { docs } = snapshot
      return docs.map(document => ({ ...document.data(), id: document.id }))
    })
  }

  listQueryField(
    resolve: GraphQLFieldResolver<TSource, any>
  ): GraphQLFieldConfig<any, any> {
    return {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(this as any))
      ),
      args: {
        cursor: {
          type: GraphQLID
        },
        filter: {
          type: this.filterInputType
        },
        orderBy: {
          type: new GraphQLList(this.orderByType)
        }
      },
      resolve
    }
  }

  queryFields(): FieldConfigMap {
    const singleResolver = this.singleQueryResolver.bind(this, this.collection)
    const listResolver = this.listQueryResolver.bind(this, this.collection)
    return {
      [this.name]: this.singleQueryField(singleResolver),
      [this.pluralName]: this.listQueryField(listResolver)
    }
  }

  mutationFields(): FieldConfigMap {
    const collection = this.collection
    const { id: requiredIdField, ...dataFields } = this.scalarFields
    const updateDataArgs = Object.keys(dataFields).reduce((all, fieldName) => {
      const field = dataFields[fieldName]
      return {
        ...all,
        ...{ [field.name]: { type: getNullableType(field.type) } }
      }
    }, {})
    return {
      [`create${this.name}`]: {
        type: new GraphQLNonNull(this as any),
        args: {
          ...dataFields
        } as any,
        resolve(_: any, args: any) {
          return collection.add(args).then(document => ({
            id: document.id,
            ...args
          }))
        }
      },
      [`update${this.name}`]: {
        type: new GraphQLNonNull(ResourceId),
        args: {
          id: requiredIdField,
          ...updateDataArgs
        },
        resolve(_: any, args: any) {
          const { id, ...data } = args
          return collection
            .doc(id)
            .update(data)
            .then(document => ({ id }))
        }
      },
      [`delete${this.name}`]: {
        type: new GraphQLNonNull(ResourceId),
        args: {
          id: requiredIdField
        },
        resolve(_: any, args: any) {
          const { id } = args
          return collection
            .doc(id)
            .delete()
            .then(document => ({ id }))
        }
      }
    }
  }

  subscriptionFields(): FieldConfigMap {
    const { collection } = this
    const singularName = this.name.toLowerCase()
    const addedOperationName = `${singularName}Added`
    return {
      [addedOperationName]: {
        type: this,
        subscribe() {
          return queryToIterator(collection, addedOperationName)
        }
      }
    }
  }
}
