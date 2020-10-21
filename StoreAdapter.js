// **StoreAdaptor** adapts @rdfjs/N3 store to implement DatasetCore interface
const rdf = require('@rdfjs/data-model')
// const { quad } = require('@rdfjs/data-model/lib/data-factory')
const N3 = require('n3')
// const N3 = require('@rdfjs/n3')
// const { DataFactory } = N3;

class StoreAdapter extends N3.Store {
  // ### `_add` adds rdf.Quad if it is not already in the store
  add (quad) {
    // var quad = toN3Quad(rquad)
    if (!this.some(function (quad) { return true }, ...quadToArray(quad))) {
      this.addQuad(quad)
    }
  }

  // ### `_delete` removes rdf.Quad from the store
  delete (quad) {
    this.removeQuad(quad)
    // this.removeQuad(toN3Quad(quad))
  }

  // ### `_has` checks whether the store contains the specified rdf.Quad
  has (quad) {
    // return this.some(function (quad) { return true }, ...quadToArray(toN3Quad(rquad))) // ...quad;  subject, predicate, object, graph
    return this.some(function (quad) { return true }, ...quadToArray(quad))
  }

  // ### `_match` yields an array of matching N3.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  match (subject, predicate, object, graph) {
    // return this.getQuads(toN3Quad(rdf.quad(subject, predicate, object, graph)))
    // console.log(`Dataset size: ${this.size}`)
    // var terms = [subject, predicate, object, graph].map(v => v ? v.value : v)
    // var terms = [subject, predicate, object] // .map(v => v ? N3.DataFactory.namedNode(v.value) : v)
    // console.log('Target terms: ' + terms.map(v => JSON.stringify(v)).join(' '))
    // return this.getQuads(undefined, undefined, undefined, undefined)
    // return this.getQuads(...[subject, predicate, object, graph].map(v => N3.DataFactory.namedNode(v)))
    return this.getQuads(subject, predicate, object, graph)
  }

  // ### `iterator` yields an iterator to the storing rdf.Quad-s
  * [Symbol.iterator] () {
    // this._addToIndex(graphItem.subjects,   subject,   predicate, object);
    // _addToIndex(index0, key0, key1, key2)
    var graphItem
    // // this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
    // console.log('_graphs: ' + JSON.stringify(this._graphs))
    // // console.log('_graphs entries: ' + JSON.stringify(Object.entries(this._graphs)))
    // // for (var egraph of Object.entries(this._graphs)) {
    for (var igraph in this._graphs) {
      // var egraph = this._graphs[igraph]
      // console.log('egraph: ' + JSON.stringify(egraph))
      // Only if the specified graph contains triples, there can be results
      if ((graphItem = this._graphs[igraph])) {
        // console.log('  graphItem: ' + JSON.stringify(graphItem))
        for (var isubj in graphItem.subjects) {
          var epreds = graphItem.subjects[isubj]
          // console.log('    epreds: ' + JSON.stringify(epreds))
          for (var ipred in epreds) {
            var eobjs = epreds[ipred]
            // console.log('        eobjs: ' + JSON.stringify(eobjs))
            for (var iobj in eobjs) {
              // console.log('raw res:' + JSON.stringify(rdf.quad(isubj, ipred, iobj, igraph)))
              console.log('res:' + JSON.stringify(rdf.quad([isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))))
              yield rdf.quad([isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))
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
