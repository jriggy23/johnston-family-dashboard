// Unit tests for the vCard parsing + contact-matching logic. Runs against the
// compiled output (run `npm run build` first; `npm test` does this for you) using
// Node's built-in test runner — no extra dependencies.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseVCard,
  parseVCards,
  photoToDataUrl,
  scoreContact,
  matchContact,
} from '../dist/src/lib/contacts.js'

const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ=='

test('parses vCard 3.0 with ENCODING=b TYPE=JPEG photo', () => {
  const card = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Johnston;John;;;',
    'FN:John Johnston',
    `PHOTO;ENCODING=b;TYPE=JPEG:${TINY_JPEG_B64}`,
    'END:VCARD',
  ].join('\r\n')
  const c = parseVCard(card)
  assert.equal(c.given, 'John')
  assert.equal(c.family, 'Johnston')
  assert.equal(c.photo, `data:image/jpeg;base64,${TINY_JPEG_B64}`)
})

test('parses vCard 4.0 data: URI photo', () => {
  const card = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'N:Johnston;Taylor;;;',
    'FN:Taylor Johnston',
    `PHOTO:data:image/jpeg;base64,${TINY_JPEG_B64}`,
    'END:VCARD',
  ].join('\r\n')
  const c = parseVCard(card)
  assert.equal(c.given, 'Taylor')
  assert.equal(c.photo, `data:image/jpeg;base64,${TINY_JPEG_B64}`)
})

test('unfolds folded base64 photo lines', () => {
  const card = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Johnston;Shannon;;;',
    'FN:Shannon Johnston',
    'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQAAAQABAAD',
    ' /2wBDAAEBAQ==', // continuation (leading space)
    'END:VCARD',
  ].join('\r\n')
  const c = parseVCard(card)
  assert.equal(c.photo, `data:image/jpeg;base64,${TINY_JPEG_B64}`)
})

test('contact with no photo parses but has undefined photo', () => {
  const card = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Johnston;Zachary;;;',
    'FN:Zachary Johnston',
    'END:VCARD',
  ].join('\r\n')
  const c = parseVCard(card)
  assert.equal(c.given, 'Zachary')
  assert.equal(c.photo, undefined)
})

test('photoToDataUrl skips remote URI photos', () => {
  assert.equal(photoToDataUrl({ value: 'uri' }, 'https://example.com/a.jpg'), null)
})

test('photoToDataUrl maps PNG type', () => {
  assert.equal(
    photoToDataUrl({ encoding: 'b', type: 'PNG' }, 'AAAA'),
    'data:image/png;base64,AAAA',
  )
})

test('parseVCards handles multiple concatenated cards', () => {
  const data = [
    'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:John Johnston\r\nN:Johnston;John;;;\r\nEND:VCARD',
    'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Taylor Johnston\r\nN:Johnston;Taylor;;;\r\nEND:VCARD',
  ].join('\r\n')
  const cards = parseVCards(data)
  assert.equal(cards.length, 2)
})

// --- Matching ---------------------------------------------------------------

const contacts = [
  { fn: 'John Johnston', given: 'John', family: 'Johnston', photo: 'data:image/jpeg;base64,a' },
  { fn: 'John Appleseed', given: 'John', family: 'Appleseed', photo: 'data:image/jpeg;base64,b' },
  { fn: 'Johnny Smith', given: 'Johnny', family: 'Smith', photo: 'data:image/jpeg;base64,c' },
  { fn: 'Shannon Johnston', given: 'Shannon', family: 'Johnston', photo: 'data:image/jpeg;base64,d' },
  { fn: 'Zachary Johnston', given: 'Zachary', family: 'Johnston' }, // no photo
]

test('prefers exact <name> <surname> over other same-given contacts', () => {
  const m = matchContact('John', contacts, 'Johnston', true)
  assert.equal(m.fn, 'John Johnston')
})

test('exact family match outscores a prefix match', () => {
  assert.ok(
    scoreContact(contacts[0], 'John', 'Johnston') > scoreContact(contacts[2], 'John', 'Johnston'),
  )
})

test('matches Shannon to the Johnston record', () => {
  assert.equal(matchContact('Shannon', contacts, 'Johnston', true).fn, 'Shannon Johnston')
})

test('returns undefined for a photo-less match when requirePhoto', () => {
  assert.equal(matchContact('Zachary', contacts, 'Johnston', true), undefined)
})

test('returns the photo-less contact when requirePhoto is false', () => {
  assert.equal(matchContact('Zachary', contacts, 'Johnston', false).fn, 'Zachary Johnston')
})

test('no match for an unknown calendar name', () => {
  assert.equal(matchContact('Untitled', contacts, 'Johnston', true), undefined)
})
