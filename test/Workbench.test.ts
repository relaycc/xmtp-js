import { Wallet } from 'ethers'
import { Client, DecodedMessage } from '../src'
import { KeyStoreType } from '../src/Client'
describe('Workbench', () => {
  it('fetch messages', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as unknown as string)
    const client = await Client.create(wallet)
    const conversation = await client.conversations.newConversation(
      wallet.address
    )
    const messages: DecodedMessage[] = []
    for await (const page of conversation.messagesPaginated({
      pageSize: 25,
    })) {
      for (const msg of page) {
        messages.push(msg.content)
      }
      if (messages.length >= 25) {
        break
      }
    }
    console.log(messages)
  })

  it('fetch conversations', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as unknown as string)
    const client = await Client.create(wallet)
    const conversations = await client.conversations.list()
    console.log(conversations)
  })

  it('create random', async () => {
    const wallet = Wallet.createRandom()
    const client = await Client.create(wallet)
    console.log(wallet.privateKey)
  })

  it('create a new conversation', async () => {
    const wallet = new Wallet(
      '0xa82c56d6b3132abdaecaebd65fac39c13d201975ec3e52d19dd505e9f5f34df9'
    )
    const client = await Client.create(wallet)
    const random = '0x269Acb1C700A8693e105B975C5EaC35F8d70A72B'
    const cid = `${random}-${new Date()}`
    await client.conversations.newConversation(random, {
      conversationId: cid,
      metadata: {},
    })
    console.log('Conversation created:' + cid)
  })

  it('list conversations', async () => {
    console.time('WORKBENCH :: TIMER :: LIST CONVERSATIONS')
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as unknown as string)
    console.time('WORKBENCH :: TIMER :: CREATE CLIENT')
    const client = await Client.create(wallet)
    console.timeEnd('WORKBENCH :: TIMER :: CREATE CLIENT')
    const conversations = await client.conversations.list()
    console.timeEnd('WORKBENCH :: TIMER :: LIST CONVERSATIONS')
    console.log(`WORKBENCH :: NUM CONVOS ${conversations.length}`)
  })

  it('export xmtp identity', async () => {
    const wallet = new Wallet(
      '0xa82c56d6b3132abdaecaebd65fac39c13d201975ec3e52d19dd505e9f5f34df9'
    )
    const ik = await Client.getKeys(wallet)
    const ua = Uint8Array.from(ik)
    console.log('string', ik.toString())
    console.log('ik', ik)
    console.log('decoded', Buffer.from(ik.toString()))

    try {
      // const clientTwo = await Client.create(null, {
      //   privateKeyOverride: new Uint8Array(decoded),
      // })
      // const conversations = await clientTwo.conversations.list()
      // console.log(conversations.length)
    } catch (error) {
      console.error(error)
    }
  })
})
