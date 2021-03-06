import test from 'ava'
import debug from '@watchmen/debug'
import {assertAutomatedTest, initDb} from '@watchmen/mongo-test-helpr'
import {
	parseParam,
	getNextSequence,
	existsIndex,
	getDb,
	closeDb,
	SEQUENCES_NAME,
	ifNull,
	createIndices,
	sanitizeKeys,
	getConnectionString,
	options,
	getAuthString
} from '../../src'

const dbg = debug(__filename)

test('getDb: basic', async t => {
	const db1 = await getDb()
	t.truthy(db1)
	const db2 = await getDb()
	t.truthy(db2)
	t.is(db1, db2)
})

test('getDb: init', async t => {
	const db1 = await getDb()
	t.truthy(db1)
	const db2 = await getDb({init: true})
	t.truthy(db2)
	t.not(db1, db2)
})

test('getDb: drop', async t => {
	const db = await getDb()
	t.truthy(db)
	const result = await db.collection('foo').save({name: 'bar'})
	t.truthy(result.result.n, 1)
	await db.dropDatabase()
	const array = await db
		.collection('foo')
		.find({})
		.toArray()
	t.is(array.length, 0)
})

test('closeDb', async t => {
	const db1 = await getDb()
	t.truthy(db1)
	await closeDb()
	const db2 = await getDb()
	t.truthy(db2)
	t.not(db1, db2)
})

test('parseParam: null', t => {
	t.is(parseParam(null), null)
})

test('parseParam: string', t => {
	t.is(parseParam('foo'), 'foo')
})

test('parseParam: regex', t => {
	t.deepEqual(parseParam('/foo'), {$regex: 'foo', $options: ''})
})

test('parseParam: regex with option', t => {
	t.deepEqual(parseParam('/foo/i'), {$regex: 'foo', $options: 'i'})
})

test('getNextSequence', async t => {
	const db = await getDb()
	t.truthy(db)
	assertAutomatedTest(db)
	try {
		const result = await db.dropCollection(SEQUENCES_NAME)
		t.truthy(result)
	} catch (error) {
		dbg('get-next-sequence: message=%o, (assuming allowable)', error.message)
		error.code && t.is(error.code, 26) // Collection doesn't exist code
	}

	t.is(await getNextSequence('stuff', {db}), 1)
	t.is(await getNextSequence('stuff', {db}), 2)
	t.is(await getNextSequence('stuff', {db}), 3)
})

test('existsIndex', t => {
	t.deepEqual(existsIndex('foo'), [
		{foo: 1},
		{unique: true, partialFilterExpression: {foo: {$exists: true}}}
	])
	t.deepEqual(existsIndex('foo', 'bar'), [
		{foo: 1, bar: 1},
		{
			unique: true,
			partialFilterExpression: {
				foo: {$exists: true},
				bar: {$exists: true}
			}
		}
	])
})

test('ifNull', t => {
	t.deepEqual(
		ifNull({
			test: '$foo',
			is: '$bar',
			not: '$baz'
		}),
		{
			$cond: [{$eq: [{$ifNull: ['$foo', null]}, null]}, '$bar', '$baz']
		}
	)
})

test('createIndices: non-existent', async t => {
	const db = await getDb()
	t.truthy(db)
	let result = await initDb(db)
	t.truthy(result)
	result = await createIndices({
		indices: [[{foo: 1}, {unique: true}]],
		collectionName: 'indexed'
	})
	t.truthy(result)
})

test('createIndices: non-existent: drop', async t => {
	const db = await getDb()
	t.truthy(db)
	let result = await initDb(db)
	t.truthy(result)
	result = await createIndices({
		indices: [[{foo: 1}, {unique: true}]],
		collectionName: 'indexed',
		isDrop: true
	})
	t.truthy(result)
})

test('createIndices: exists', async t => {
	const db = await getDb()
	t.truthy(db)
	let result = await initDb(db)
	t.truthy(result)

	const collectionName = 'indexed'

	result = await db.createCollection(collectionName)
	t.truthy(result)

	result = await createIndices({
		indices: [[{foo: 1}, {unique: true}]],
		collectionName
	})
	t.truthy(result)
})

test('createIndices: exists: drop', async t => {
	const db = await getDb()
	t.truthy(db)
	let result = await initDb(db)
	t.truthy(result)

	const collectionName = 'indexed'

	result = await db.createCollection(collectionName)
	t.truthy(result)

	result = await createIndices({
		indices: [[{foo: 1}, {unique: true}]],
		collectionName,
		isDrop: true
	})
	t.truthy(result)
})

test('sanitizeKeys', t => {
	t.deepEqual(
		sanitizeKeys({
			$foo: {
				$bar: {
					'do.not.reply': true
				}
			}
		}),
		{
			_$foo: {
				_$bar: {
					// eslint-disable-next-line camelcase
					do_not_reply: true
				}
			}
		}
	)
})

test('getConnectionString', t => {
	t.is(getConnectionString(), 'mongodb://localhost:27017/test-auto')
})

test('options', t => {
	t.deepEqual(options, {
		connectTimeoutMS: 3000,
		socketTimeoutMS: 3000,
		useNewUrlParser: true
	})
})

test('auth: none', t => {
	t.is(getAuthString({}), '')
})

test('auth: both', t => {
	t.is(getAuthString({user: 'user-1', password: 'pass-1'}), 'user-1:pass-1@')
})

test('auth: only user', t => {
	t.throws(() => {
		getAuthString({user: 'user-1'})
	})
})

test('auth: only pass', t => {
	t.throws(() => {
		getAuthString({password: 'pass-1'})
	})
})

// Test('tryToOid', t => {
//   const oid = oid('123456789012')
//   dbg('oid=%o', oid)
//   t.true(oid instanceof mongodb.ObjectId)
// })
