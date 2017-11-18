import { CollectionType } from './CollectionType'
import { firestore } from 'firebase/app'
import { GraphQLFieldConfig } from 'graphql'

export function createReferenceType<TSource>(
  inputType: CollectionType<any>,
  getCollection: (root: TSource) => firestore.CollectionReference
): GraphQLFieldConfig<any, any> {
  return inputType.listQueryField((root, args, context) => {
    const collection = getCollection(root)
    return inputType.listQueryResolver(collection, root, args, context)
  })
}
