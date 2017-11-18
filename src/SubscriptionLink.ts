import { ApolloLink, Operation, NextLink, Observable } from 'apollo-link'
import {
  DocumentNode,
  GraphQLSchema,
  getOperationAST,
  subscribe,
  ExecutionResult
} from 'graphql'
import { forAwaitEach } from 'iterall'

//  TODO: Check if it has firebase directive before executing any link
//  if (!hasDirectives(['firebase'], operation.query)) {
//   return nextLink(operation)
// }

export class FirebaseSubscriptionLink extends ApolloLink {
  private isASubscriptionOperation = (
    document: DocumentNode,
    operationName: string
  ) => {
    const operationAST = getOperationAST(document, operationName)
    return !!operationAST && operationAST.operation === 'subscription'
  }

  constructor(private schema: GraphQLSchema) {
    super()
  }

  request(
    operation: Operation,
    nextLink: NextLink
  ): Observable<ExecutionResult> {
    const isSubscription = this.isASubscriptionOperation(
      operation.query,
      operation.operationName
    )

    if (!isSubscription) {
      return nextLink(operation)
    }

    return new Observable(observer => {
      subscribe(
        this.schema,
        operation.query
      ).then((iterator: AsyncIterator<ExecutionResult>) => {
        forAwaitEach(iterator as any, event =>
          observer.next(event)
        ).then(() => {
          observer.complete()
        })

        return {
          closed: false,
          unsubscribe() {
            iterator.return()
          }
        }
      })
    })
  }
}
