// **StoreAdaptor** adapts @rdfjs/n3 store to implement DatasetCore interface
const rdf = require('@rdfjs/data-model')
const n3 = require('n3')

class StoreAdapter extends n3.Store {
  // ### Construct the storage and populate it if required
  // quads: Array(Quad)  - quads to be stored
  // options: Object  - storage options, includes N3Store options and the following options to store non-standard (i.e., extended) quads:
  //   contexts: Map(key: String, context: String|Object) | null  - quad contexts to be recovered
  //   contexter: function(Quad) -> context: String|Object  - quad context extractor
  //   cfactory: method_function(context: String|Object) -> quad: Quad  - contextual quad factory
  constructor (quads, options) {
    super(quads, options)
    // Mapping of a storage keys to the context of the respective quad, where the context
    this.contexts = options && 'contexts' in options ? options.contexts : new Map()
    this.contexter = options && 'contexter' in options ? options.contexter : quad => quad
    this.cfactory = options && 'cfactory' in options ? options.cfactory.bind(this) : undefined

    if (quads && this.contexts) {
      var iquad = 0
      var graphItem
      for (var igraph in this._graphs) {
        // Only if the specified graph contains triples, there can be results
        if ((graphItem = this._graphs[igraph])) {
          for (var isubj in graphItem.subjects) {
            var epreds = graphItem.subjects[isubj]
            for (var ipred in epreds) {
              var eobjs = epreds[ipred]
              for (var iobj in eobjs) {
                this.contexts.set(StoreAdapter._contextKeyRaw(isubj, ipred, iobj, igraph), this.contexter(quads[iquad++]))
              }
            }
          }
        }
      }
    }
  }

  // ### `_contextKey` produces String context key for the quad
  _contextKey (quad) {
    // Convert terms to internal string representation
    const isubj = this._termId(quad.subject)
    const ipred = this._termId(quad.predicate)
    const iobj = this._termId(quad.object)
    const igraph = n3.termToId(quad.graph)
    return StoreAdapter._contextKeyRaw(isubj, ipred, iobj, igraph)
  }

  // ### `_contextKey` produces String context key by IDs of the quad components
  static _contextKeyRaw (subjectId, predicateId, objectId, graphId) {
    return `${subjectId}.${predicateId}.${objectId}.${graphId}`
  }

  // ### `_termId` fetch internal numerical id of the term stored in N3Store
  _termId (term) {
    return this._ids[n3.termToId(term)]
  }

  // ### `add` adds rdf.Quad if it is not already in the store
  add (quad) {
    if (!this.has(quad)) {
      this.addQuad(quad)
      if (this.contexts) {
        this.contexts.set(this._contextKey(quad), this.contexter(quad))
      }
    }
  }

  // ### `delete` removes rdf.Quad from the store
  delete (quad) {
    if (this.has(quad)) {
      if (this.contexts) {
        this.contexts.delete(this._contextKey(quad))
      }
      this.removeQuad(quad)
    }
  }

  // ### `has` checks whether the store contains the specified rdf.Quad
  has (quad) {
    return this.contexts ? this.contexts.has(this._contextKey(quad)) : this.some(function (quad) { return true }, ...quadToArray(quad))
  }

  // ### `match` yields an array of matching n3.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  match (subject, predicate, object, graph) {
    var quads = this.getQuads(subject, predicate, object, graph)
    if (this.contexts) {
      quads = this.cfactory
        ? quads.map(quad => this.cfactory(this.contexts.get(this._contextKey(quad))))
        : quads.map(quad => this.contexts.get(this._contextKey(quad)))
    }
    return quads
  }

  // ### `iterator` yields an iterator to the storing quad-s
  [Symbol.iterator] () {
    return this.contexts
      ? (this.cfactory ? this._iteratorFactCtx() : this.contexts.values())
      : this._iteratorRaw()
  }

  // ### `_iteratorCtx` yields an iterator to the storing original quad-s
  * _iteratorFactCtx () {
    for (var ctx of this.contexts.values()) {
      yield this.cfactory(ctx)
    }
  }

  // ### `_iteratorRaw` yields an iterator to the storing rdf.Quad-s
  * _iteratorRaw () {
    var graphItem
    for (var igraph in this._graphs) {
      // Only if the specified graph contains triples, there can be results
      if ((graphItem = this._graphs[igraph])) {
        for (var isubj in graphItem.subjects) {
          var epreds = graphItem.subjects[isubj]
          for (var ipred in epreds) {
            var eobjs = epreds[ipred]
            for (var iobj in eobjs) {
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
