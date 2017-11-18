import { ApolloLink, Operation, NextLink, Observable } from 'apollo-link'
import { graphql, print, GraphQLSchema } from 'graphql'

//  TODO: Check if it has firebase directive before executing any link
//  if (!hasDirectives(['firebase'], operation.query)) {
//   return nextLink(operation)
// }

export class FirebaseLink extends ApolloLink {
  constructor(private schema: GraphQLSchema) {
    super()
  }
  request(operation: Operation, nextLink: NextLink) {
    const { schema } = this
    return new Observable(observer => {
      const source = print(operation.query)
      graphql({ schema, source })
        .then(result => {
          if (result.errors) {
            result.errors.forEach(error => observer.error(error))
          } else {
            observer.next(result)
            observer.complete()
          }
        })
        .catch(error => {
          observer.error(error)
        })
    })
  }
}
