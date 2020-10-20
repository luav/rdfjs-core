// **StoreAdaptor** adapts @rdfjs/N3 store to implement DatasetCore interface
const rdf = require('@rdfjs/data-model')
// const { quad } = require('@rdfjs/data-model/lib/data-factory')
const N3 = require('n3')
// const N3 = require('@rdfjs/n3')
// const { DataFactory } = N3;

class StoreAdaptor extends N3.Store {
  constructor (quads) {
    // super(quads.map(v => toN3Quad(v)))
    if (quads) {
      if (quads.length && !(quads[0] instanceof N3.Quad)) {
        super(quads.map(v => toN3Quad(v)))
      } else super(quads)
    } else super()
  }

  // ### `_add` adds rdf.Quad
  _add (rquad) {
    var quad = toN3Quad(rquad)
    if (!this.some(function (quad) { return true }, quad)) {
      this.addQuad(quad)
    }
  }

  // ### `_delete` removes rdf.Quad
  _delete (rquad) {
    this.removeQuad(toN3Quad(rquad))
  }

  // ### `_has` checks whether rdf.Quad is present
  _has (rquad) {
    // console.log('rquad: ' + JSON.stringify(rquad))
    // var mrq = [rquad.subject, rquad.predicate, rquad.object, rquad.graph].map(
    //   v => v ? N3.DataFactory.namedNode(v.value) : v
    // )
    // console.log('rquad mapped: ' + JSON.stringify(mrq))
    // console.log('rquad mapped converted: ' + JSON.stringify(N3.DataFactory.quad(...mrq)))
    // var quad = toN3Quad(rquad)
    // console.log('quad: ' + JSON.stringify(quad))
    // console.log('Has quad converted:\n  ' + [rquad, quad].map(v => JSON.stringify(v)).join('\n  '))
    return this.some(function (quad) { return true }, ...quadToArray(toN3Quad(rquad))) // ...quad;  subject, predicate, object, graph
  }

  // ### `_has` yields an array of matching N3.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  _match (subject, predicate, object, graph) {
    // return this.getQuads(toN3Quad(rdf.quad(subject, predicate, object, graph)))
    // console.log(`Dataset size: ${this.size}`)
    // var terms = [subject, predicate, object, graph].map(v => v ? v.value : v)
    var terms = [subject, predicate, object] // .map(v => v ? N3.DataFactory.namedNode(v.value) : v)
    // console.log('Target terms: ' + terms.map(v => JSON.stringify(v)).join(' '))
    // return this.getQuads(undefined, undefined, undefined, undefined)
    // return this.getQuads(...[subject, predicate, object, graph].map(v => N3.DataFactory.namedNode(v)))
    return this.getQuads(...terms, graph)
  }

  // [Symbol.iterator]: function* () {
  //   // this._addToIndex(graphItem.subjects,   subject,   predicate, object);
  //   // _addToIndex(index0, key0, key1, key2)
  //   var graphItem
  //   // this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
  //   for (var egraph of this._graphs) {
  //       // Only if the specified graph contains triples, there can be results
  //       if (graphItem = egraph[1])
  //         for (var esubjs of graphItem.subjects)
  //           for (var epreds of esubjs[1])
  //             for (var eobjs of epreds[1])
  //               yield N3.quad(esubjs[0], epreds[0], eobjs[0], egraph[0])
  //   }
  // }
  //
  // [Symbol.iterator] () {
  //   return this._quads.values()
  // }

  // _toN3Quad (rquad) {
  //   // var quad = N3.DataFactory.quad(...[rquad.subject, rquad.predicate, rquad.object].map(
  //   //   v => (v && v.value !== null) ? N3.DataFactory.namedNode(v.value) : null
  //   // ), (rquad.graph && rquad.graph.value !== null) ? rquad.graph.value : null)
  //   return rquad
  // }
}

StoreAdaptor.prototype[Symbol.iterator] = function * () {
  // this._addToIndex(graphItem.subjects,   subject,   predicate, object);
  // _addToIndex(index0, key0, key1, key2)
  var graphItem
  // this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
  for (var egraph of this._graphs) {
    // Only if the specified graph contains triples, there can be results
    if ((graphItem = egraph[1])) {
      for (var esubjs of graphItem.subjects) {
        for (var epreds of esubjs[1]) {
          for (var eobjs of epreds[1]) {
            yield rdf.quad(esubjs[0], epreds[0], eobjs[0], egraph[0])
          }
        }
      }
    }
  }
}

// ### `toN3Quad` convert RDF to N3.JS quad
function toN3Quad (rquad) {
  // var quad = N3.DataFactory.quad(...[rquad.subject, rquad.predicate, rquad.object].map(
  //   v => (N3.Util.isNamedNode(v) ? N3.DataFactory.namedNode(v.value) : v)
  // ), (rquad.graph && rquad.graph.value !== null) ? rquad.graph : null)
  return rquad
}

// ### `quadToArray` converts quad to the array of its attributes
function quadToArray (quad) {
  return [quad.subject, quad.predicate, quad.object, quad.graph]
}

// // ### `isN3Quad` whether the given quad is N3.JS quad
// function isN3Quad (quad) {
//   return quad instanceof N3.Quad
// }
//
// // ### `isNamedNode` whether the given quad is rdf.NamedNode
// function isNamedNode (term) {
//   return term instanceof rdf.DataFactory.NamedNode
// }

module.exports = StoreAdaptor
