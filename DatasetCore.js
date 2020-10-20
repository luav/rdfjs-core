const Store = require('./StoreAdaptor')
// const isMatch = require('./isMatch')

class DatasetCore {
  constructor (quads) {
    Object.defineProperty(this, '_store', { value: new Store(quads) })
    // this.quads = new Set()
    //
    // if (quads) {
    //   for (const quad of quads) {
    //     this.quads.add(quad)
    //   }
    // }
  }

  get size () {
    return this._store.size
    // return this.quads.size
  }

  add (quad) {
    this._store._add(quad)
    // if (!this.has(quad)) {
    //   this.quads.add(quad)
    // }
    return this
  }

  delete (quad) {
    this._store._delete(quad)
    // for (const localQuad of this) {
    //   if (isMatch(quad, localQuad.subject, localQuad.predicate, localQuad.object, localQuad.graph)) {
    //     this.quads.delete(localQuad)
    //     return this
    //   }
    // }
    return this
  }

  has (quad) {
    return this._store._has(quad)
    // for (const other of this) {
    //   if (isMatch(other, quad.subject, quad.predicate, quad.object, quad.graph)) {
    //     return true
    //   }
    // }
    // return false
  }

  match (subject, predicate, object, graph) {
    const matches = this._store._match(subject, predicate, object, graph)
    // const matches = this._store.getQuads(subject, predicate, object, graph)
    // // const matches = new Set()
    // // for (const quad of this) {
    // //   if (isMatch(quad, subject, predicate, object, graph)) {
    // //     matches.add(quad)
    // //   }
    // // }
    // console.log(`Matches ${matches.length}: ` + matches.map(v => JSON.stringify(v)).join('\n  '))
    return new this.constructor(matches) // Note: matches contain N3.Quad-s
  }

  [Symbol.iterator] () {
    return this._store[Symbol.iterator]()
    // return this.quads[Symbol.iterator]()
  }
}

// Object.defineProperty(DatasetCore.prototype, '_store', { value: new Store(quads) })

module.exports = DatasetCore
