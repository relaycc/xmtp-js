import { messageApi } from '@xmtp/proto'
import { NotifyStreamEntityArrival } from '@xmtp/proto/ts/dist/types/fetch.pb'
import { retry, sleep, toNanoString } from './utils'
import AuthCache from './authn/AuthCache'
import { Authenticator } from './authn'
import { version } from '../package.json'
import { XMTP_DEV_WARNING } from './constants'
import { Flatten } from './utils/typedefs'
export const { MessageApi, SortDirection } = messageApi

const RETRY_SLEEP_TIME = 100
const ERR_CODE_UNAUTHENTICATED = 16

const clientVersionHeaderKey = 'X-Client-Version'
const appVersionHeaderKey = 'X-App-Version'

export const ApiUrls = {
  local: 'http://localhost:5555',
  dev: 'https://dev.xmtp.network',
  production: 'https://production.xmtp.network',
} as const

export enum GrpcStatus {
  OK = 0,
  CANCELLED,
  UNKNOWN,
  INVALID_ARGUMENT,
  DEADLINE_EXCEEDED,
  NOT_FOUND,
  ALREADY_EXISTS,
  PERMISSION_DENIED,
  RESOURCE_EXHAUSTED,
  FAILED_PRECONDITION,
  ABORTED,
  OUT_OF_RANGE,
  UNIMPLEMENTED,
  INTERNAL,
  UNAVAILABLE,
  DATA_LOSS,
  UNAUTHENTICATED,
}

export type GrpcError = Flatten<Error & { code?: GrpcStatus }>

export type QueryParams = {
  startTime?: Date
  endTime?: Date
  contentTopics: string[]
}

export type QueryAllOptions = {
  direction?: messageApi.SortDirection
  limit?: number
}

export type QueryStreamOptions = Flatten<
  Omit<QueryAllOptions, 'limit'> & {
    pageSize?: number
  }
>

// All of the fields in both QueryParams and QueryStreamOptions
export type Query = Flatten<QueryParams & QueryStreamOptions>

export type PublishParams = {
  contentTopic: string
  message: Uint8Array
  timestamp?: Date
}

export type SubscribeParams = {
  contentTopics: string[]
}

export type ApiClientOptions = {
  maxRetries?: number
  appVersion?: string
}

export type SubscribeCallback = NotifyStreamEntityArrival<messageApi.Envelope>

export type UnsubscribeFn = () => Promise<void>

const isAbortError = (err?: Error): boolean => {
  if (!err) {
    return false
  }
  if (err.name === 'AbortError' || err.message.includes('aborted')) {
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isAuthError = (err?: GrpcError): boolean => {
  if (err && err.code === ERR_CODE_UNAUTHENTICATED) {
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNotAuthError = (err?: GrpcError): boolean => !isAuthError(err)

/**
 * ApiClient provides a wrapper for calling the GRPC Gateway generated code.
 * It adds some helpers for dealing with paginated data and automatically retries idempotent calls
 */
export default class ApiClient {
  pathPrefix: string
  maxRetries: number
  private authCache?: AuthCache
  appVersion: string | undefined
  version: string

  constructor(pathPrefix: string, opts?: ApiClientOptions) {
    this.pathPrefix = pathPrefix
    this.maxRetries = opts?.maxRetries || 5
    this.appVersion = opts?.appVersion
    this.version = 'xmtp-js/' + version

    if (pathPrefix === ApiUrls.dev) {
      console.info(XMTP_DEV_WARNING)
    }
  }

  // Raw method for querying the API
  private _query(
    req: messageApi.QueryRequest
  ): ReturnType<typeof MessageApi.Query> {
    return retry(
      MessageApi.Query,
      [
        req,
        {
          pathPrefix: this.pathPrefix,
          mode: 'cors',
          headers: this.headers(),
        },
      ],
      this.maxRetries,
      RETRY_SLEEP_TIME
    )
  }

  // Raw method for batch-querying the API
  private _batchQuery(
    req: messageApi.BatchQueryRequest
  ): ReturnType<typeof MessageApi.BatchQuery> {
    return retry(
      MessageApi.BatchQuery,
      [
        req,
        {
          pathPrefix: this.pathPrefix,
          mode: 'cors',
          headers: this.headers(),
        },
      ],
      this.maxRetries,
      RETRY_SLEEP_TIME
    )
  }

  // Raw method for publishing to the API
  private async _publish(
    req: messageApi.PublishRequest,
    attemptNumber = 0
  ): ReturnType<typeof MessageApi.Publish> {
    const authToken = await this.getToken()
    const headers = this.headers()
    headers.set('Authorization', `Bearer ${authToken}`)
    try {
      return await retry(
        MessageApi.Publish,
        [
          req,
          {
            pathPrefix: this.pathPrefix,
            mode: 'cors',
            headers,
          },
        ],
        this.maxRetries,
        RETRY_SLEEP_TIME,
        // Do not retry UnauthenticatedErrors
        isNotAuthError
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      // Try at most 2X. If refreshing the auth token doesn't work the first time, it won't work the second time
      if (isNotAuthError(e) || attemptNumber >= 1) {
        throw e
      }
      await this.authCache?.refresh()
      return this._publish(req, attemptNumber + 1)
    }
  }

  // Raw method for subscribing
  private _subscribe(
    req: messageApi.SubscribeRequest,
    cb: NotifyStreamEntityArrival<messageApi.Envelope>
  ): UnsubscribeFn {
    const abortController = new AbortController()

    const doSubscribe = async () => {
      while (true) {
        const startTime = new Date().getTime()
        try {
          await MessageApi.Subscribe(req, cb, {
            pathPrefix: this.pathPrefix,
            signal: abortController.signal,
            mode: 'cors',
            headers: this.headers(),
          })
          if (abortController.signal.aborted) {
            return
          }
          console.info('Stream connection closed. Resubscribing')
          if (new Date().getTime() - startTime < 1000) {
            await sleep(1000)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          if (isAbortError(err) || abortController.signal.aborted) {
            return
          }
          console.info(
            'Stream connection closed. Resubscribing',
            err.toString()
          )
          if (new Date().getTime() - startTime < 1000) {
            await sleep(1000)
          }
        }
      }
    }
    doSubscribe()

    return async () => {
      abortController?.abort()
    }
  }

  // NOTE(achilles@relay.cc) There's something slightly awkward about this
  // function, I think stemming from a coupling of the user <-> XMTP-JS API and
  // the XMTP-JS <-> Waku API. I'm not sure we need to iterate through pages
  // because on the user <-> XMTP-JS side we just need a paginated query.
  // Use the Query API to return the full contents of any specified topics
  async query(
    params: QueryParams,
    {
      // NOTE(achilles@relay.cc) It might make sense to default to DESCENDING
      // because that would make the first page the most recent messages.
      direction = SortDirection.SORT_DIRECTION_ASCENDING,
      limit,
    }: QueryAllOptions
  ): Promise<messageApi.Envelope[]> {
    const out: messageApi.Envelope[] = []
    // Use queryIteratePages for better performance. 1/100th the number of Promises to resolve compared to queryStream
    for await (const page of this.queryIteratePages(params, {
      direction,
      // If there is a limit of < 100, use that as the page size. Otherwise use 100 and stop if/when limit reached.
      pageSize: limit && limit < 100 ? limit : 100,
    })) {
      for (const envelope of page) {
        out.push(envelope)
        if (limit && out.length === limit) {
          return out
        }
      }
      // NOTE(achilles@relay.cc) This conditional breaks make it so that the
      // async for...of will only ever execute once and the function will only
      // ever return a single page of length limit.
      if (limit && out.length === limit) {
        break
      }
    }
    return out
  }

  // Will produce an AsyncGenerator of Envelopes
  // Uses queryStreamPages under the hood
  async *queryIterator(
    params: QueryParams,
    options: QueryStreamOptions
  ): AsyncGenerator<messageApi.Envelope> {
    for await (const page of this.queryIteratePages(params, options)) {
      for (const envelope of page) {
        yield envelope
      }
    }
  }

  // Creates an async generator that will paginate through the Query API until it reaches the end
  // Will yield each page of results as needed
  async *queryIteratePages(
    { contentTopics, startTime, endTime }: QueryParams,
    { direction, pageSize = 10 }: QueryStreamOptions
  ): AsyncGenerator<messageApi.Envelope[]> {
    if (!contentTopics || !contentTopics.length) {
      throw new Error('Must specify content topics')
    }

    const startTimeNs = toNanoString(startTime)
    const endTimeNs = toNanoString(endTime)
    let cursor: messageApi.Cursor | undefined

    while (true) {
      const pagingInfo: messageApi.PagingInfo = {
        limit: pageSize,
        direction,
        cursor,
      }

      const result = await this._query({
        contentTopics,
        startTimeNs,
        endTimeNs,
        pagingInfo,
      })

      if (result.envelopes?.length) {
        yield result.envelopes
      } else {
        return
      }

      if (result.pagingInfo?.cursor) {
        cursor = result.pagingInfo?.cursor
      } else {
        return
      }
    }
  }

  // Take a list of queries and execute them in batches
  async batchQuery(queries: Query[]): Promise<messageApi.Envelope[][]> {
    // Group queries into batches of 50 (implicit server-side limit) and then perform BatchQueries
    const BATCH_SIZE = 50
    // Keep a list of BatchQueryRequests to execute all at once later
    const batchRequests: messageApi.BatchQueryRequest[] = []

    // Assemble batches
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const queriesInBatch = queries.slice(i, i + BATCH_SIZE)
      // Perform batch query by first compiling a list of repeated individual QueryRequests
      // then populating a BatchQueryRequest with that list
      const constructedQueries: messageApi.QueryRequest[] = []

      for (const queryParams of queriesInBatch) {
        constructedQueries.push({
          contentTopics: queryParams.contentTopics,
          startTimeNs: toNanoString(queryParams.startTime),
          endTimeNs: toNanoString(queryParams.endTime),
          pagingInfo: {
            limit: queryParams.pageSize || 10,
            direction:
              queryParams.direction || SortDirection.SORT_DIRECTION_ASCENDING,
          },
        })
      }
      const batchQueryRequest = {
        requests: constructedQueries,
      }
      batchRequests.push(batchQueryRequest)
    }

    // Execute batches
    const batchQueryResponses = await Promise.all(
      batchRequests.map(async (batch) => this._batchQuery(batch))
    )

    // For every batch, read all responses within the batch, and add to a list of lists of envelopes
    // one top-level list for every original query
    const allEnvelopes: messageApi.Envelope[][] = []
    for (const batchResponse of batchQueryResponses) {
      if (!batchResponse.responses) {
        // An error on any of the batch query is propagated to the caller
        // for simplicity, rather than trying to return partial results
        throw new Error('BatchQueryResponse missing responses')
      }
      for (const queryResponse of batchResponse.responses) {
        if (queryResponse.envelopes) {
          allEnvelopes.push(queryResponse.envelopes)
        } else {
          // If no envelopes provided, then add an empty list
          allEnvelopes.push([])
        }
      }
    }
    return allEnvelopes
  }

  // Publish a message to the network
  // Will convert timestamps to the appropriate format expected by the network
  async publish(
    messages: PublishParams[]
  ): ReturnType<typeof MessageApi.Publish> {
    const toSend: messageApi.Envelope[] = []
    for (const { contentTopic, message, timestamp } of messages) {
      if (!contentTopic.length) {
        throw new Error('Content topic cannot be empty string')
      }

      if (!message.length) {
        throw new Error('0 length messages not allowed')
      }

      const dt = timestamp || new Date()
      toSend.push({
        contentTopic,
        timestampNs: toNanoString(dt),
        message: Uint8Array.from(message),
      })
    }

    return this._publish({ envelopes: toSend })
  }

  // Subscribe to a list of topics.
  // Provided callback function will be called on each new message
  // Returns an unsubscribe function that can be used to end the subscription
  subscribe(
    params: SubscribeParams,
    callback: SubscribeCallback
  ): UnsubscribeFn {
    if (!params.contentTopics.length) {
      throw new Error('Must provide list of contentTopics to subscribe to')
    }

    return this._subscribe(params, callback)
  }

  private getToken(): Promise<string> {
    if (!this.authCache) {
      throw new Error('AuthCache is not set on API Client')
    }
    return this.authCache.getToken()
  }

  setAuthenticator(
    authenticator: Authenticator,
    cacheExpirySeconds?: number
  ): void {
    this.authCache = new AuthCache(authenticator, cacheExpirySeconds)
  }

  headers(): Headers {
    const headers = new Headers()
    headers.set(clientVersionHeaderKey, this.version)
    if (this.appVersion) {
      headers.set(appVersionHeaderKey, this.appVersion)
    }
    return headers
  }
}
