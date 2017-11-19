import test from 'ava'

import {ensureAnd, pushOrs} from '../../src'

test('getAnd', t => {
  t.deepEqual(ensureAnd({}).$and, [])
  t.deepEqual(ensureAnd({$and: ['foo']}).$and, ['foo'])
})

test('pushOrs', t => {
  let query = {}

  query = pushOrs({query, ors: [{foo: 'bar'}]})
  t.deepEqual(query, {
    $or: [{foo: 'bar'}]
  })

  query = pushOrs({query, ors: [{baz: 'bip'}]})
  t.deepEqual(query, {
    $or: [{foo: 'bar'}],
    $and: [
      {
        $or: [{baz: 'bip'}]
      }
    ]
  })

  query = pushOrs({query, ors: [{fee: 'fie'}]})
  t.deepEqual(query, {
    $or: [{foo: 'bar'}],
    $and: [
      {
        $or: [{baz: 'bip'}]
      },
      {
        $or: [{fee: 'fie'}]
      }
    ]
  })
})
