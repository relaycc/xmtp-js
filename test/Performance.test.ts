import { Wallet } from 'ethers'
import { Client } from '../src'
import { messageApi } from '@xmtp/proto'

describe('Performance', () => {
  it('create a new identity', async () => {
    const wallet = Wallet.createRandom()
    await Client.create(wallet)
    console.log(wallet.address)
  })

  it('create a client using keybundle', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    const keys = await client.keys.encode()
    const clientFromKeys = await Client.create(null, {
      privateKeyOverride: keys,
    })
    console.log(clientFromKeys.address)
  })

  it('create a client', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    await Client.create(wallet)
  })

  it('checks if an address is on the network', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    const canMessage = await client.canMessage(
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    )
  })
  /*
  it('Fetch one conversation', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    await client.listConversationMessages(wallet.address)
  })

  it('Fetch one message', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    await client.listConversationMessages(wallet.address, {
      limit: 1,
    })
  })
*/
  it('List conversations', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    await client.conversations.list()
  })
  /*
  it('Sends a message to itself', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    await client.sendMessage(client.address, JSON.stringify(getAddress()))
  })

  it('Fetch one message from hardcoded list', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    const requests = getAddress().map((address) =>
      client.listConversationMessages(address, {
        limit: 1,
        direction: messageApi.SortDirection.SORT_DIRECTION_DESCENDING,
      })
    )
    await Promise.all(requests)
  })

  it('Fetch one message from fetched conversations', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    const conversations = await client.conversations.list()
    const addresses = conversations.map(
      (conversation) => conversation.peerAddress
    )
    const requests = addresses.map((address) =>
      client.listConversationMessages(address, {
        limit: 1,
        direction: messageApi.SortDirection.SORT_DIRECTION_DESCENDING,
      })
    )
    const result = await Promise.all(requests)
    console.log(result)
  })

  it('Fetch one message from self-sent list', async () => {
    const wallet = new Wallet(process.env.RELAYCC_TEST_PK as string)
    const client = await Client.create(wallet)
    const message = await client.listConversationMessages(client.address, {
      limit: 1,
      direction: messageApi.SortDirection.SORT_DIRECTION_DESCENDING,
    })
    const addresses = JSON.parse(message.pop()?.content)
    const requests = addresses.map((address: string) =>
      client.listConversationMessages(address, {
        limit: 1,
        direction: messageApi.SortDirection.SORT_DIRECTION_DESCENDING,
      })
    )
    const result = await Promise.all(requests)
    console.log(result)
  })

 */
})

function getAddress() {
  return [
    '0x0cb27e883E207905AD2A94F9B6eF0C7A99223C37',
    '0xf89773CF7cf0B560BC5003a6963b98152D84A15a',
    '0x11Afb8521CbF03C3508378E41d4C5b7e2C90b233',
    '0x13ef2f6cf92B1E7Aa6D7639dB55A20BB6172bFa2',
    '0x15A27532e29D899cBCB2cbD59F9471A4030B3065',
    '0x1966245b3549d56ff484EC238BF910437e426f93',
    '0x19dDa0867d2Ec79939bB2C9911Fb8ca4FC8BBe92',
    '0x1Ae157D8BbBca4652B247641f002f73665d8e76a',
    '0x1E5717bE9Aa546289A8e23D7e061049De0c66461',
    '0x1e341Aa44c293d95d13d778492D417D1BE4E63D5',
    '0x27b0A7070CB1dFD9746f9E7e246fDA906aa07198',
    '0x29104420912B3637cd697B16f48DeF9cF4D87616',
    '0x2BeFb4C92c3Af21107165CA4B7C230A3615201eB',
    '0x34aA3F359A9D614239015126635CE7732c18fDF3',
    '0x3E9976d5BA86a78d6E5c25bc2F309049676C0798',
    '0x3c26b473d9B3Da738624990eB2983C2a28B1340c',
    '0x45C9a201e2937608905fEF17De9A67f25F9f98E0',
    '0x4d49083EcefCFCC3A13F1DAE46C7f408c104d9fA',
    '0x57B0DD7967955c92b6e34A038b47Fee63E1eFd1a',
    '0x5c7240CEEc1C668373c4eff7Cae71a482086A2fC',
    '0x65071CB6FFeD99148096f09904E95eA78DE24643',
    '0x6A03c07F9cB413ce77f398B00C2053BD794Eca1a',
    '0x7049747E615a1C5C22935D5790a664B7E65D9681',
    '0x719Ef536035B8387F8d6F5F0F7A1ad2d2E8432B5',
    '0x72BA1965320ab5352FD6D68235Cc3C5306a6FFA2',
    '0x7643B3E34039ADE2db0f64C9Be4907B2FcE63B2A',
    '0x7F3c1E75C652774f769e3b4C8870E39F71dA453b',
    '0x84a8202A290a6dfda39170C60561d3944BF91429',
    '0x87F91CF8C0aB6c0D8684b2188760934771907C9D',
    '0x8DD9464e585256D98Da679f8eC7A39d0127CBaFF',
    '0x958cEB59FaAE989d095cBfe27bf65AE3C02a821b',
    '0x96b3333083960C470B50497C7f78c30666c76bd9',
    '0x9b9D76a63dc218365AFf63e9dF4c2760D2898244',
    '0xA64fc17B157aaA50AC9a8341BAb72D4647d0f1A7',
    '0xA6B5336C99a63a89570538aE85119579e2889b72',
    '0xC870cF4e7820eA9710445f5A2C4Cc9903FA9a31e',
    '0xE2cdF7F74088a7b739A8739549D64DbbD289b587',
    '0xE315D5E07faAe15eB6Ce544ADAfb115a681567B1',
    '0xE418697c1941313df876a065Ac25e17eb50d189F',
    '0xE956197E5Ff81385B969e36Ab88A7822Ef27b1c6',
    '0xF7F451EB8D7B87915318D8BB34801CDfb1BD8ECd',
    '0xF88c5838C501cb08DCe44987adf6B07E94cB01B6',
    '0xb22c52B487397EF470f3e1038e4B7Fa2489DacAc',
    '0xb33cB5D3ceD2A477A6C80910c2962De697dbbe48',
    '0xb945AFfccd31717490e339DD0FDF2fA8679391A3',
    '0xe82aA0f2184f657dd988FF686Cd2d576710706E0',
    '0xeAEfd55d90a71A0c01AC1B5F0EEdB0dD1A6D0cb2',
    '0xea0670814Dac9bb8B568077d490Fb86c6616E8cf',
  ]
}
