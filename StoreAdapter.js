// **StoreAdaptor** adapts @rdfjs/N3 store to implement DatasetCore interface
const rdf = require('@rdfjs/data-model')
const N3 = require('n3')

class StoreAdapter extends N3.Store {
  // ### `_add` adds rdf.Quad if it is not already in the store
  add (quad) {
    if (!this.some(function (quad) { return true }, ...quadToArray(quad))) {
      this.addQuad(quad)
    }
  }

  // ### `_delete` removes rdf.Quad from the store
  delete (quad) {
    this.removeQuad(quad)
  }

  // ### `_has` checks whether the store contains the specified rdf.Quad
  has (quad) {
    return this.some(function (quad) { return true }, ...quadToArray(quad))
  }

  // ### `_match` yields an array of matching N3.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  match (subject, predicate, object, graph) {
    return this.getQuads(subject, predicate, object, graph)
  }

  // ### `iterator` yields an iterator to the storing rdf.Quad-s
  * [Symbol.iterator] () {
    var graphItem
    for (var igraph in this._graphs) {
      // Only if the specified graph contains triples, there can be results
      if ((graphItem = this._graphs[igraph])) {
        for (var isubj in graphItem.subjects) {
          var epreds = graphItem.subjects[isubj]
          for (var ipred in epreds) {
            var eobjs = epreds[ipred]
            for (var iobj in eobjs) {
              // console.log('res:' + JSON.stringify(rdf.quad(...[isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))))
              yield rdf.quad(...[isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))
            }
          }
        }
      }
    }
  }
}

// ### `quadToArray` converts quad to the array of its attributes
function quadToArray (quad) {
  return [quad.subject, quad.predicate, quad.object, quad.graph]
}

module.exports = StoreAdapter
