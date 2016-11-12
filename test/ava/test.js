import test from 'ava'
import debug from 'debug'
import mongodb from 'mongodb'
import {
  parseParam,
  oid,
  getNextSequence,
  existsIndex,
  getDb,
  assertAutomatedTest,
  SEQUENCES_NAME
} from '../../src'

const dbg = debug('test:mongo-helpr')

test('getDb', async (t)=>{
  t.truthy(await getDb())
})

test('parseParam: null', async (t)=>{
  t.is(parseParam(null), null)
})

test('parseParam: string', async (t)=>{
  t.is(parseParam('foo'), 'foo')
})

test('parseParam: regex', async (t)=>{
  dbg('parse-param=%o', parseParam('/foo'))
  t.deepEqual(parseParam('/foo'), {$regex: 'foo', $options: ''})
})

test('parseParam: regex with option', async (t)=>{
  t.deepEqual(parseParam('/foo/i'), {$regex: 'foo', $options: 'i'})
})

test('oid', async (t)=>{
  t.truthy(oid() instanceof mongodb.ObjectId)
})

test('oid: valid value', async (t)=>{
  const value = '012345678901234567890123'
  t.is(oid(value).toHexString(), mongodb.ObjectId(value).toHexString())
})

test('oid: invalid value lax', async (t)=>{
  t.is(oid('1').toHexString(), mongodb.ObjectId('000000000000000000000001').toHexString())
})

test('oid: invalid value strict', async (t)=>{
  t.throws(()=>{oid('1', {strict: true})})
})

test('getNextSequence', async (t)=>{
  assertAutomatedTest()
  const db = await getDb()
  t.truthy(db)
  try {
    const result = await db.dropCollection(SEQUENCES_NAME)//.drop()
    dbg('get-next-sequence: result=%o', result)
  } catch (error) {
    t.is(error.code, 26) // collection doesn't exist...
    //dbg('get-next-sequence: error=%o', error)
  }
  t.is(await getNextSequence('stuff', {db}), 1)
  t.is(await getNextSequence('stuff', {db}), 2)
  t.is(await getNextSequence('stuff', {db}), 3)
})

test('existsIndex', async (t)=>{
  t.deepEqual(
    existsIndex('foo'),
    [
      {foo: 1},
      {unique: true, partialFilterExpression: {foo: {$exists: true}}}
    ]
  )
  t.deepEqual(
    existsIndex('foo', 'bar'),
    [
      {foo: 1, bar: 1},
      {unique: true, partialFilterExpression: {foo: {$exists: true}, bar: {$exists: true}}}
    ]
  )
})