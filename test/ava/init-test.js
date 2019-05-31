import test from 'ava'
import debug from '@watchmen/debug'
import {UNIQUENESS_ERROR} from '@watchmen/helpr'
import {initDb} from '@watchmen/mongo-test-helpr'

import {
	getNextSequence,
	getDb,
	createIndices,
	createValidator,
	getCount,
	assertNone,
	findOne,
	requireOne
} from '../../src'

const dbg = debug(__filename)

test.beforeEach(async t => {
	const db = await getDb()
	const result = await initDb(db)
	t.truthy(result)
})

test('getNextSequence', async t => {
	t.is(await getNextSequence('stuff'), 1)
	t.is(await getNextSequence('stuff'), 2)
	t.is(await getNextSequence('stuff'), 3)
})

test('createIndices', async t => {
	const collectionName = 'indexed'
	await createIndices({
		collectionName,
		indices: [[{name: 1}, {unique: true}], {age: 1}]
	})

	const db = await getDb()
	const collection = db.collection(collectionName)
	const result = await collection.insertOne({name: 'foo'})
	t.is(result.result.n, 1)
	await t.throwsAsync(collection.insertOne({name: 'foo'}))
})

test('createValidator', async t => {
	const collectionName = 'validated'
	await createValidator({
		collectionName,
		validator: {name: {$type: 'string'}}
	})

	const db = await getDb()
	const result = await db.collection(collectionName).insertOne({name: 'foo'})
	t.is(result.result.n, 1)

	await t.throwsAsync(db.collection(collectionName).insertOne({name: 1}))
})

test('count: basic', async t => {
	const collectionName = 'toCount'
	const query = {name: 'foo'}
	let count = await getCount({collectionName, query})
	t.is(count, 0)

	const db = await getDb()
	await db.collection(collectionName).save(query)
	count = await getCount({db, collectionName, query})
	t.is(count, 1)
})

test('count: steps', async t => {
	const collectionName = 'toCount'
	const query = {name: 'foo'}
	const steps = [{$project: {name: '$nayme'}}]
	let count = await getCount({collectionName, query, steps})
	t.is(count, 0)

	const db = await getDb()
	await db.collection(collectionName).save({nayme: 'foo'})
	count = await getCount({collectionName, query, steps})
	t.is(count, 1)
})

test('assertNone', async t => {
	const collectionName = 'toCount'
	const query = {name: 'foo'}
	t.true(await assertNone({collectionName, query}))

	const db = await getDb()
	await db.collection(collectionName).save({...query})
	try {
		await assertNone({collectionName, query})
		t.fail()
	} catch (error) {
		t.is(error.name, UNIQUENESS_ERROR)
		dbg('assert-none: err=%o', error)
		t.pass()
	}
})

test('findOne: exists', async t => {
	const collectionName = 'toFind'
	const query = {name: 'foo'}
	const db = await getDb()
	await db.collection(collectionName).save(query)

	const target = await findOne({collectionName, query})
	t.is(target.name, 'foo')
})

test('findOne: does not exist', async t => {
	const collectionName = 'toFind'
	const target = await findOne({collectionName, query: {}})
	t.falsy(target)
})

test('requireOne: exists', async t => {
	const collectionName = 'toCount'
	const query = {name: 'foo'}
	const db = await getDb()
	await db.collection(collectionName).save(query)
	const target = await requireOne({collectionName, query})
	t.is(target.name, 'foo')
})

test('requireOne: does not exist', async t => {
	const collectionName = 'toCount'
	const query = {name: 'foo', 'foo.bar.baz': undefined}
	try {
		await requireOne({collectionName, query})
		t.fail()
	} catch (error) {
		t.is(error.name, 'Error')
		dbg('require-one: err=%o', error)
		t.pass()
	}
})
