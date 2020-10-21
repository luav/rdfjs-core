const Store = require('./StoreAdapter')

class DatasetCore {
  // ### `constructor` constructs the internal store and populates it with the specified quads
  constructor (quads) {
    Object.defineProperty(this, '_store', { value: new Store(quads) })
  }

  // ### `size` the number of quads in the size
  get size () {
    return this._store.size
  }

  // ### `add` adds rdf.Quad if it is not already in the store
  add (quad) {
    this._store.add(quad)
    return this
  }

  // ### `delete` removes rdf.Quad from the store
  delete (quad) {
    this._store.delete(quad)
    return this
  }

  // ### `has` checks whether the store contains the specified rdf.Quad
  has (quad) {
    return this._store.has(quad)
  }

  // ### `match` yields a new dataset from the matching rdf.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  match (subject, predicate, object, graph) {
    var matches = this._store.match(subject, predicate, object, graph)
    return new this.constructor(matches)
  }

  // ### `iterator` yields an iterator to the storing rdf.Quad-s
  [Symbol.iterator] () {
    return this._store[Symbol.iterator]()
  }
}

module.exports = DatasetCore
