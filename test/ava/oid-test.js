import test from 'ava'
import mongodb from 'mongodb'
import {oid} from '../../src'

test('ObjectID', t => {
  t.truthy(new mongodb.ObjectID('123456789012'))
  t.truthy(new mongodb.ObjectID('abcdefghijkl'))
  t.truthy(new mongodb.ObjectID('123456789012345678901234'))
  t.truthy(new mongodb.ObjectID(null))
  t.truthy(new mongodb.ObjectID(undefined))
  t.truthy(new mongodb.ObjectID('5a41128de716a28afef707d7'))
  t.throws(() => new mongodb.ObjectID('1'))
  t.throws(() => new mongodb.ObjectID('a'))
  t.throws(() => new mongodb.ObjectID(true))
  t.throws(() => new mongodb.ObjectID('12345678901'))
  t.throws(() => new mongodb.ObjectID('1234567890123'))
  t.throws(() => new mongodb.ObjectID('12345678901234567890123x'))
  t.throws(() => new mongodb.ObjectID('1234567890123456789012345'))
  t.throws(() => new mongodb.ObjectID('1234567890123456789012'))
})

test('oid', t => {
  t.truthy(oid() instanceof mongodb.ObjectId)
})

test('oid: 12 binary', t => {
  const value = '123456789012'
  t.is(oid({value}).toHexString(), mongodb.ObjectId(value).toHexString())
})

test('oid: 24 hex', t => {
  const value = '123456789012345678901234'
  t.is(oid({value}).toHexString(), mongodb.ObjectId(value).toHexString())

  const value2 = '5a41128de716a28afef707d5'
  t.is(oid({value: value2}).toHexString(), mongodb.ObjectId(value2).toHexString())
})

// test('oid: invalid value lax', t => {
//   t.is(oid({value: '1'}).toHexString(), mongodb.ObjectId('000000000000000000000001').toHexString())
// })

test('oid: invalid value strict', t => {
  t.throws(() => {
    oid({value: '1', strict: true})
  })
})
