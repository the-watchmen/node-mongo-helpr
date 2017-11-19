import test from 'ava'
import {toDotNotation} from '../../src'

test('basic', t => {
  // {foo: {bar: {baz: {bim: 1, bam: 2}}}, boo: [1, 2, 3]} -> {'foo.bar.baz.bim': 1, 'foo.bar.baz.bam': 2, boo: [1,2,3]}
  t.deepEqual(toDotNotation({target: {foo: 1}}), {foo: 1})
})

test('array', t => {
  t.deepEqual(toDotNotation({target: {foo: [1, 2]}}), {foo: [1, 2]})
})

test('nested', t => {
  t.deepEqual(
    toDotNotation({
      target: {
        foo: {
          bar: {
            baz: {
              bim: 1,
              bam: 2
            }
          },
          boo: [1, 2, 3]
        }
      }
    }),
    {
      'foo.bar.baz.bim': 1,
      'foo.bar.baz.bam': 2,
      'foo.boo': [1, 2, 3]
    }
  )
})
