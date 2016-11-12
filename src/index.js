import mongodb from 'mongodb'
import assert from 'assert'
import debug from 'debug'
import _ from 'lodash'
import config from 'config'
import {stringify, isHex} from 'helpr'

const dbg = debug('app:mongo-helpr')

export const SEQUENCES_NAME = _.get(config, 'mongo.sequences', 'sequences')
const autoSuffix = _.get(config, 'mongo.autoSuffix', '-auto')

const oidLength = 24
const logLevel = _.get(config, 'mongo.logger.level')
if (logLevel) {
  mongodb.Logger.setLevel(logLevel)
  const filterClasses = _.get(config, 'mongo.logger.filterClasses')
  filterClasses && mongodb.Logger.filter('class', filterClasses)
}

const client = mongodb.MongoClient

export async function getDb() {
  const host = config.get('mongo.host')
  const port = config.get('mongo.port')
  const db = config.get('mongo.db')
  dbg('get-db: host=%o, port=%o, db=%o', host, port, db)
  return await client.connect(`mongodb://${host}:${port}/${db}`)
}

export function dbName(){
  return config.get('mongo.db')
}

export function isAutomatedTest(){
  return dbName().endsWith(autoSuffix)
}

export function assertAutomatedTest(){
  assert(isAutomatedTest(), `db-name=${dbName()} requires suffix=${autoSuffix}`)
}

export function parseParam(value) {
  if (_.isString(value) && value.startsWith('/')) {
    const toks = value.split('/').filter((value)=>{return value != ''})
    assert(toks[0])
    return {$regex: toks[0], $options: toks[1] || ''}
  }
  return value
}

export function oid(value, {strict}={}){
  const isValid = value ? isValidOid(value) : true
  if (strict && !isValid) {
    throw new Error(`unable to create oid from value=${value}`)
  }
  let result
  if (value) {
    if ((value.length <= oidLength) && (isHex(value))) {
      result = new mongodb.ObjectID(value.padStart(oidLength, '0'))
    } else {
      result = value
    }
  } else {
    result = new mongodb.ObjectID()
  }
  return result
}

export function isValidOid(value) {
  return ((value.length == oidLength) && isHex(value))
}

export async function findOne({db, query, steps, collectionName, isRequired}){
  const _db = db || await getDb()
  const collection = _db.collection(collectionName)
  const cursor = steps ? collection.aggregate(steps, {allowDiskUse: true}) : collection.find(query)
  const result = await cursor.toArray()
  if (result.length > 1) {
    throw new Error(`unexpected multiple hits, query=${stringify(steps || query)}, collection=${collectionName}`)
  }
  if (isRequired && result.length != 1) {
    throw new Error(`record required, query=${stringify(steps || query)}, collection=${collectionName}`)
  }
  return (result.length == 1) ? result[0] : null
}

export function requireOne(opts){
  return findOne({...opts, isRequired: true})
}

export async function getNextSequence(entity, {db}={}){
  assert(entity, 'entity required')
  const _db = db || await getDb()
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

export function createIndices(indices, {db, collectionName}){
  assert(indices, 'indices required')
  const _db = db || getDb()
  const target = _db.collection(collectionName)
  indices.forEach((index)=>{
    Array.isArray(index) ? target.createIndex(...index) : target.createIndex(index)
  })
}

export function existsIndex(...fields){
  return [
    _.transform(fields, (result, field)=>{result[field] = 1}, {}),
    {
      unique: true,
      partialFilterExpression: _.transform(fields, (result, field)=>{result[field] = {$exists: true}}, {})
    }
  ]
}