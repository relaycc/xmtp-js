import * as proto from '../../src/proto/message';
import PrivateKey from './PrivateKey';
import KeyBundle from './KeyBundle';
import Ciphertext from './Ciphertext';
import * as ethers from 'ethers';
import { decrypt, encrypt, getRandomValues } from './utils';
import { hexToBytes } from '@noble/hashes/utils';

// PrivateKeyBundle bundles the private keys corresponding to a KeyBundle for convenience.
// This bundle must not be shared with anyone, although will have to be persisted
// somehow so that older messages can be decrypted again.
export default class PrivateKeyBundle {
  identityKey: PrivateKey;
  preKey: PrivateKey;
  constructor(identityKey: PrivateKey, preKey: PrivateKey) {
    this.identityKey = identityKey;
    this.preKey = preKey;
  }

  // Generate a new key bundle pair with the preKey signed byt the identityKey.
  static async generateBundles(): Promise<[PrivateKeyBundle, KeyBundle]> {
    const [priIdentityKey, pubIdentityKey] = PrivateKey.generateKeys();
    const [priPreKey, pubPreKey] = PrivateKey.generateKeys();
    await priIdentityKey.signKey(pubPreKey);
    return [
      new PrivateKeyBundle(priIdentityKey, priPreKey),
      new KeyBundle(pubIdentityKey, pubPreKey)
    ];
  }

  // sharedSecret derives a secret from peer's key bundles using a variation of X3DH protocol
  // where the sender's ephemeral key pair is replaced by the sender's prekey.
  // @recipient indicates whether this is the sending (encrypting) or receiving (decrypting) side.
  async sharedSecret(peer: KeyBundle, recipient: boolean): Promise<Uint8Array> {
    if (!(await peer.identityKey.verifyKey(peer.preKey))) {
      throw new Error('peer preKey signature invalid');
    }
    let dh1: Uint8Array, dh2: Uint8Array;
    if (recipient) {
      dh1 = this.preKey.sharedSecret(peer.identityKey);
      dh2 = this.identityKey.sharedSecret(peer.preKey);
    } else {
      dh1 = this.identityKey.sharedSecret(peer.preKey);
      dh2 = this.preKey.sharedSecret(peer.identityKey);
    }
    const dh3 = this.preKey.sharedSecret(peer.preKey);
    const secret = new Uint8Array(dh1.length + dh2.length + dh3.length);
    secret.set(dh1, 0);
    secret.set(dh2, dh1.length);
    secret.set(dh3, dh1.length + dh2.length);
    return secret;
  }

  // encrypt the plaintext with a symmetric key derived from the peers' key bundles.
  async encrypt(plain: Uint8Array, recipient: KeyBundle): Promise<Ciphertext> {
    const secret = await this.sharedSecret(recipient, false);
    const ad = associatedData({
      sender: this.getKeyBundle(),
      recipient: recipient
    });
    return encrypt(plain, secret, ad);
  }

  // decrypt the encrypted content using a symmetric key derived from the peers' key bundles.
  async decrypt(encrypted: Ciphertext, sender: KeyBundle): Promise<Uint8Array> {
    const secret = await this.sharedSecret(sender, true);
    const ad = associatedData({
      sender: sender,
      recipient: this.getKeyBundle()
    });
    return decrypt(encrypted, secret, ad);
  }

  // return the corresponding public KeyBundle
  getKeyBundle(): KeyBundle {
    return new KeyBundle(
      this.identityKey.getPublicKey(),
      this.preKey.getPublicKey()
    );
  }

  // encrypt and serialize the message
  async encodeMessage(
    recipient: KeyBundle,
    message: string
  ): Promise<Uint8Array> {
    const bytes = new TextEncoder().encode(message);
    const ciphertext = await this.encrypt(bytes, recipient);
    return proto.Message.encode({
      header: {
        sender: this.getKeyBundle().toBeEncoded(),
        recipient: recipient.toBeEncoded()
      },
      payload: ciphertext.toBeEncoded()
    }).finish();
  }

  // deserialize and decrypt the message;
  // throws if any part of the messages (including the header) was tampered with
  async decodeMessage(bytes: Uint8Array): Promise<string> {
    const message = proto.Message.decode(bytes);
    if (!message.header) {
      throw new Error('missing message header');
    }
    if (!message.header.sender) {
      throw new Error('missing message sender');
    }
    if (!message.header.recipient) {
      throw new Error('missing message recipient');
    }
    const sender = KeyBundle.fromDecoded(message.header.sender);
    const recipient = KeyBundle.fromDecoded(message.header.recipient);
    if (!this.preKey.matches(recipient.preKey)) {
      throw new Error('recipient pre-key mismatch');
    }
    if (!message.payload) {
      throw new Error('missing message payload');
    }
    const ciphertext = Ciphertext.fromDecoded(message.payload);
    bytes = await this.decrypt(ciphertext, sender);
    return new TextDecoder().decode(bytes);
  }

  async encode(wallet: ethers.Signer): Promise<Uint8Array> {
    // serialize the contents
    const bytes = proto.PrivateKeyBundle.encode({
      identityKey: this.identityKey.toBeEncoded(),
      preKeys: [this.preKey.toBeEncoded()]
    }).finish();
    const wPreKey = getRandomValues(new Uint8Array(32));
    const secret = hexToBytes(await wallet.signMessage(wPreKey));
    const encrypted = await encrypt(bytes, secret);
    return proto.EncryptedPrivateKeyBundle.encode({
      walletPreKey: wPreKey,
      payload: encrypted.toBeEncoded()
    }).finish();
  }

  static async decode(
    wallet: ethers.Signer,
    bytes: Uint8Array
  ): Promise<PrivateKeyBundle> {
    const encrypted = proto.EncryptedPrivateKeyBundle.decode(bytes);
    if (!encrypted.walletPreKey) {
      throw new Error('missing wallet pre-key');
    }
    const secret = hexToBytes(await wallet.signMessage(encrypted.walletPreKey));
    if (!encrypted.payload) {
      throw new Error('missing bundle payload');
    }
    const ciphertext = Ciphertext.fromDecoded(encrypted.payload);
    const decrypted = await decrypt(ciphertext, secret);
    const bundle = proto.PrivateKeyBundle.decode(decrypted);
    if (!bundle.identityKey) {
      throw new Error('missing identity key');
    }
    if (bundle.preKeys.length === 0) {
      throw new Error('missing pre-keys');
    }
    return new PrivateKeyBundle(
      PrivateKey.fromDecoded(bundle.identityKey),
      PrivateKey.fromDecoded(bundle.preKeys[0])
    );
  }
}

// argument type for associatedData()
interface Header {
  sender: KeyBundle;
  recipient: KeyBundle;
}

// serializes message header into bytes so that it can be included for encryption as associated data
function associatedData(header: Header): Uint8Array {
  return proto.Message_Header.encode({
    sender: header.sender.toBeEncoded(),
    recipient: header.recipient.toBeEncoded()
  }).finish();
}
