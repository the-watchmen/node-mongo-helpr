import test from 'ava'
import mongodb from 'mongodb'

test('oid', t => {
  t.truthy(new mongodb.ObjectID('123456789012'))
  t.truthy(new mongodb.ObjectID('abcdefghijkl'))
  t.truthy(new mongodb.ObjectID('123456789012345678901234'))
  t.truthy(new mongodb.ObjectID(null))
  t.truthy(new mongodb.ObjectID(undefined))
  t.throws(() => new mongodb.ObjectID('1'))
  t.throws(() => new mongodb.ObjectID('a'))
  t.throws(() => new mongodb.ObjectID(true))
  t.throws(() => new mongodb.ObjectID('12345678901'))
  t.throws(() => new mongodb.ObjectID('1234567890123'))
  t.throws(() => new mongodb.ObjectID('12345678901234567890123x'))
  t.throws(() => new mongodb.ObjectID('1234567890123456789012345'))
  t.throws(() => new mongodb.ObjectID('1234567890123456789012'))
})
