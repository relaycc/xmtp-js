import { Wallet } from 'ethers'
import { EncryptedKeyStore, PrivateTopicStore } from '../../src/store'
import assert from 'assert'
import { PrivateKeyBundleV1 } from '../../src/crypto'
import { newWallet, sleep, wrapAsLedgerWallet } from '../helpers'
import ApiClient, { ApiUrls } from '../../src/ApiClient'

describe('EncryptedKeyStore', () => {
  let wallet: Wallet
  beforeEach(() => {
    wallet = newWallet()
  })

  const store = new PrivateTopicStore(new ApiClient(ApiUrls['local']))

  it('can encrypt and store a private key bundle', async () => {
    const wallet = newWallet()
    const secureStore = new EncryptedKeyStore(wallet, store)
    const originalBundle = await PrivateKeyBundleV1.generate(wallet)

    await secureStore.storePrivateKeyBundle(originalBundle)
    await sleep(100)
    const returnedBundle = await secureStore.loadPrivateKeyBundle()

    assert.ok(returnedBundle)
    assert.deepEqual(
      originalBundle.identityKey.toBytes(),
      returnedBundle.identityKey.toBytes()
    )
    assert.equal(originalBundle.preKeys.length, returnedBundle.preKeys.length)
    assert.deepEqual(
      originalBundle.preKeys[0].toBytes(),
      returnedBundle.preKeys[0].toBytes()
    )
  })

  it('can encrypt with Ledger and decrypt with Metamask', async () => {
    const wallet = newWallet()
    const ledgerLikeWallet = wrapAsLedgerWallet(wallet)
    const secureLedgerStore = new EncryptedKeyStore(ledgerLikeWallet, store)
    const secureNormalStore = new EncryptedKeyStore(wallet, store)
    const originalBundle = await PrivateKeyBundleV1.generate(ledgerLikeWallet)

    await secureLedgerStore.storePrivateKeyBundle(originalBundle)
    await sleep(100)
    const returnedBundle = await secureNormalStore.loadPrivateKeyBundle()

    assert.ok(returnedBundle)
    assert.deepEqual(
      originalBundle.identityKey.toBytes(),
      returnedBundle.identityKey.toBytes()
    )
    assert.equal(originalBundle.preKeys.length, returnedBundle.preKeys.length)
    assert.deepEqual(
      originalBundle.preKeys[0].toBytes(),
      returnedBundle.preKeys[0].toBytes()
    )
  })

  it('can encrypt with Metamask and decrypt with Ledger', async () => {
    const wallet = newWallet()
    const ledgerLikeWallet = wrapAsLedgerWallet(wallet)
    const secureLedgerStore = new EncryptedKeyStore(ledgerLikeWallet, store)
    const secureNormalStore = new EncryptedKeyStore(wallet, store)
    const originalBundle = await PrivateKeyBundleV1.generate(wallet)

    await secureNormalStore.storePrivateKeyBundle(originalBundle)
    await sleep(100)
    const returnedBundle = await secureLedgerStore.loadPrivateKeyBundle()

    assert.ok(returnedBundle)
    assert.deepEqual(
      originalBundle.identityKey.toBytes(),
      returnedBundle.identityKey.toBytes()
    )
    assert.equal(originalBundle.preKeys.length, returnedBundle.preKeys.length)
    assert.deepEqual(
      originalBundle.preKeys[0].toBytes(),
      returnedBundle.preKeys[0].toBytes()
    )
  })

  it('returns null when no bundle found', async () => {
    const secureStore = new EncryptedKeyStore(wallet, store)
    assert.equal(null, await secureStore.loadPrivateKeyBundle())
  })
})
