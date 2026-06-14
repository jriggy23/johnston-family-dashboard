// Unit tests for the OMDb -> ratings mapping used by the title detail endpoint.
// Runs against the compiled output (run `npm run build` first; `npm test` does
// this for you) using Node's built-in test runner — no extra dependencies.
import test from 'node:test'
import assert from 'node:assert/strict'

import { mapOmdbRatings } from '../dist/src/functions/title.js'

test('maps a full OMDb payload to RT / IMDb / Metacritic', () => {
  const out = mapOmdbRatings({
    Response: 'True',
    imdbRating: '7.5',
    Metascore: '72',
    Ratings: [
      { Source: 'Internet Movie Database', Value: '7.5/10' },
      { Source: 'Rotten Tomatoes', Value: '85%' },
      { Source: 'Metacritic', Value: '72/100' },
    ],
  })
  assert.deepEqual(out, { imdb: '7.5/10', metacritic: '72/100', rottenTomatoes: '85%' })
})

test('omits ratings reported as N/A', () => {
  const out = mapOmdbRatings({
    Response: 'True',
    imdbRating: 'N/A',
    Metascore: 'N/A',
    Ratings: [],
  })
  assert.deepEqual(out, {})
})

test('omits Rotten Tomatoes when not present in Ratings', () => {
  const out = mapOmdbRatings({ imdbRating: '6.1', Metascore: '50', Ratings: [] })
  assert.deepEqual(out, { imdb: '6.1/10', metacritic: '50/100' })
})
