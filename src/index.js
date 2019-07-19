import assert from 'assert'
import fs from 'fs'
import mongodb from 'mongodb'
import _ from 'lodash'
import config from 'config'
import debug from '@watchmen/debug'
import {stringify, debugElements, UNIQUENESS_ERROR, xor} from '@watchmen/helpr'

const dbg = debug(__filename)

export const SEQUENCES_NAME = _.get(config, 'mongo.sequences', 'sequences')

const logLevel = _.get(config, 'mongo.logger.level')
if (logLevel) {
	mongodb.Logger.setLevel(logLevel)
	const filterClasses = _.get(config, 'mongo.logger.filterClasses')
	filterClasses && mongodb.Logger.filter('class', filterClasses)
}

function setOption({options, config, key, option, hook = _.identity}) {
	const value = _.get(config, key)
	if (value) {
		options[option] = hook(value, options)
	}
}

export const options = {}
setOption({
	config,
	options,
	key: 'mongo.connectTimeoutMs',
	option: 'connectTimeoutMS',
	hook: parseInt
})
setOption({
	config,
	options,
	key: 'mongo.socketTimeoutMs',
	option: 'socketTimeoutMS',
	hook: parseInt
})
setOption({
	config,
	options,
	key: 'mongo.poolSize',
	option: 'poolSize',
	hook: parseInt
})
setOption({config, options, key: 'mongo.replicaSet', option: 'replicaSet'})

// https://mongodb.github.io/node-mongodb-native/3.2/tutorials/connect/ssl/
//

setOption({
	config,
	options,
	key: 'mongo.sslCA',
	option: 'sslCA',
	hook: (value, options) => {
		options.sslValidate = true
		return [fs.readFileSync(value)]
	}
})

// const client = mongodb.MongoClient
let _mongoHelpr = {} // Singleton, see: http://stackoverflow.com/a/14464750/2371903

export function getConnectionString() {
	const host = config.get('mongo.host')
	const dbName = config.get('mongo.db')
	const user = _.get(config, 'mongo.user')
	const password = _.get(config, 'mongo.password')
	const creds = getAuthString({user, password})
	dbg(
		'get-connection-string: connect: user=%o, host=%o, db=%o, options=%o',
		user,
		host,
		dbName,
		options
	)
	return `mongodb://${creds}${host}/${dbName}`
}

export function getAuthString({user, password}) {
	assert(!xor(user, password), 'user and password required')
	// https://stackoverflow.com/a/48029805/2371903
	return user ? `${user}:${encodeURIComponent(password)}@` : ''
}

export async function getDb({init} = {}) {
	init && (await closeDb())

	if (!_mongoHelpr.client) {
		const client = await mongodb.MongoClient.connect(getConnectionString(), options)
		assert(client, 'client expected')
		const db = client.db(dbName())
		assert(db, 'db expected')
		_mongoHelpr = {client, db}
	}

	return _mongoHelpr.db
}

export async function closeDb() {
	const {client, db} = _mongoHelpr
	if (client) {
		if (client.isConnected(db.databaseName)) {
			await client.close()
			_mongoHelpr = {}
			dbg('close-db: closed db=%o', db.databaseName)
		}
	}
}

export function dbName() {
	return config.get('mongo.db')
}

export function parseParam(value) {
	if (_.isString(value) && value.startsWith('/')) {
		const toks = value.split('/').filter(value => {
			return value !== ''
		})
		assert(toks[0])
		return {$regex: toks[0], $options: toks[1] || ''}
	}

	return value
}

// Convert to oid if possible, otherwise just return value
export function oid({value, strict} = {}) {
	try {
		return new mongodb.ObjectID(value)
	} catch (error) {
		if (strict) {
			throw error
		}

		dbg('warning: unable to convert value=%o into oid, returning as is...')
		return value
	}
}

export async function findOne({db, query, steps, collectionName, isRequired}) {
	const _db = db || (await getDb())
	const collection = _db.collection(collectionName)
	const cursor = steps ? collection.aggregate(steps, {allowDiskUse: true}) : collection.find(query)
	const result = await cursor.toArray()
	if (result.length > 1) {
		throw new Error(
			`unexpected multiple hits, query=${stringify(steps || query)}, collection=${collectionName}`
		)
	}

	if (isRequired && result.length !== 1) {
		throw new Error(
			`record required, query=${stringify(steps || query)}, collection=${collectionName}`
		)
	}

	return result.length === 1 ? result[0] : null
}

export async function requireOne(opts) {
	return findOne({...opts, isRequired: true})
}

export async function getCount({db, query, steps = [], collectionName}) {
	const _db = db || (await getDb())
	const collection = _db.collection(collectionName)
	const cursor = collection.aggregate(
		steps.concat([{$match: query}, {$group: {_id: null, count: {$sum: 1}}}]),
		{allowDiskUse: true}
	)
	const result = await cursor.toArray()
	dbg('count: result=%o', result)
	return result.length === 1 ? result[0].count : 0
}

export async function assertNone({db, query, steps = [], collectionName}) {
	const count = await getCount({db, query, steps, collectionName})
	if (count !== 0) {
		const e = new Error(`record already exists in [${collectionName}] for ${stringify(query)}`)
		e.name = UNIQUENESS_ERROR
		throw e
	}

	return true
}

export async function getNextSequence(entity, {db} = {}) {
	assert(entity, 'entity required')
	const _db = db || (await getDb())
	const result = await _db.collection(SEQUENCES_NAME).findOneAndUpdate(
		{_id: entity},
		{$inc: {sequence: 1}},
		{
			upsert: true,
			returnOriginal: false
		}
	)
	assert(result.ok, `unexpected result=${stringify(result)}`)
	return result.value.sequence
}

export async function createIndices({indices, db, collectionName, isDrop}) {
	assert(indices, 'indices required')
	const _db = db || (await getDb())
	const target = _db.collection(collectionName)
	if (isDrop) {
		try {
			const result = await target.dropIndexes()
			assert(result, 'truthy result required')
			dbg('dropped indices for collection=%o', collectionName)
		} catch (error) {
			if (error.code === 26) {
				// Collection doesn't exist code
				dbg(
					'attempted to drop indices for non-existent collection=%o, continuing...',
					collectionName
				)
			} else {
				throw error
			}
		}
	}

	await Promise.all(
		indices.map(index => {
			return Array.isArray(index) ? target.createIndex(...index) : target.createIndex(index)
		})
	)
	debugElements({
		dbg,
		msg: `create-indices: collection=${collectionName}, indices`,
		o: indices
	})
	return true
}

export async function createValidator({validator, db, collectionName}) {
	assert(validator, 'validator required')
	const _db = db || (await getDb())
	const collection = await _db.createCollection(collectionName, {w: 1})
	assert(collection, 'collection required')
	await _db.command({collMod: collectionName, validator})
	debugElements({
		dbg,
		msg: `create-validator: collection=${collectionName}, validator`,
		o: validator
	})
}

export function existsIndex(...fields) {
	return [
		_.transform(
			fields,
			(result, field) => {
				result[field] = 1
			},
			{}
		),
		{
			unique: true,
			partialFilterExpression: _.transform(
				fields,
				(result, field) => {
					result[field] = {$exists: true}
				},
				{}
			)
		}
	]
}

export function unwind(path, {preserveEmpty} = {}) {
	const preserveNullAndEmptyArrays = _.isBoolean(preserveEmpty) ? preserveEmpty : true
	return {$unwind: {path, preserveNullAndEmptyArrays}}
}

export function ifNull({test, is, not}) {
	return {
		$cond: [
			// https://jira.mongodb.org/browse/SERVER-26180?focusedCommentId=1394961&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-1394961
			{$eq: [{$ifNull: [test, null]}, null]},
			is,
			not
		]
	}
}

export function ensureAnd(query) {
	if (!query.$and) {
		return {...query, $and: []}
	}

	return query
}

export function pushOrs({query, ors}) {
	if (query.$or) {
		const _query = ensureAnd(query)
		_query.$and.push({$or: ors})
		return _query
	}

	return {...query, $or: ors}
}

export function sanitizeKeys(data) {
	return _.isPlainObject(data)
		? _.transform(data, (result, val, key) => {
				const _key = key.startsWith('$') ? key.replace('$', '_$') : key
				result[_key.replace(/\./g, '_')] = sanitizeKeys(val)
		  })
		: data
}

export async function drop({collection}) {
	try {
		const result = await collection.drop()
		assert(result, 'truthy result required')
		dbg('drop: dropped collection=%o', collection)
		return result
	} catch (error) {
		if (error.code === 26) {
			// Collection doesn't exist code
			dbg(
				'drop: attempted to drop non-existent collection=%o, continuing...',
				collection.collectionName
			)
			return true
		}

		throw error
	}
}
