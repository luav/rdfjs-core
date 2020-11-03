// **DatasetCore** implements [RDF DatasetCore interface](https://rdf.js.org/dataset-spec/#datasetcore-interface) based on N3.JS store
const DataFactory = require('@rdfjs/data-model')
// const DataTypes = require('@types/rdf-js')
// const DataFactory = require('@n3/N3DataFactory')
// import { default as N3DataFactory, termToId, termFromId } from '@n3/N3DataFactory';
// const n3 = require('n3')

class DatasetCore {
  // ### Construct the storage and populate it if required
  // quads: Array(Quad)  - quads to be stored
  // options: Object  - storage options, includes N3Store options and the following options to store non-standard (i.e., extended) quads:
  //   contexts: Map(key: String, context: String|Object) | null  - quad contexts to be recovered
  //   contexter: function(Quad) -> context: String|Object  - quad context extractor
  //   cfactory: method_function(context: String|Object) -> quad: Quad  - contextual quad factory
  constructor (quads, options) {
    // The number of quads is initially zero
    this._size = 0
    // `_graphs` contains subject, predicate, and object indexes per graph
    this._graphs = Object.create(null)
    // `_ids` maps entities such as `http://xmlns.com/foaf/0.1/name` to numbers,
    // saving memory by using only numbers as keys in `_graphs`
    this._id = 0
    this._ids = Object.create(null)
    this._ids['><'] = 0 // dummy entry, so the first actual key is non-zero
    this._entities = Object.create(null) // inverse of `_ids`
    // `_blankNodeIndex` is the index of the last automatically named blank node
    this._blankNodeIndex = 0

    // Shift parameters if `quads` is not given
    if (!options && quads && !quads[0]) {
      options = quads
      quads = null
    }

    // Mapping of a storage keys to the context of the respective quad, where the context
    this._contexts = options && 'contexts' in options ? options.contexts : new Map()
    this._contexter = options && 'contexter' in options ? options.contexter : quad => quad
    this._cfactory = options && 'cfactory' in options ? options.cfactory.bind(this) : undefined

    options = options || {}
    this._factory = options.factory || DataFactory

    // Add quads if passed
    if (quads) {
      for (var quad of quads) {
        // Update contexts for the added quad
        if (this._addQuad(quad) && this._contexts) {
          this._contexts.set(this._contextKey(quad), this._contexter(quad))
        }
      }
    }
  }

  // ### `size` returns the number of quads in the store
  get size () {
    // Return the quad count if if was cached
    var size = this._size
    if (size !== null) { return size }

    // Calculate the number of quads by counting to the deepest level
    size = 0
    var graphs = this._graphs; var subjects; var subject
    for (var graphKey in graphs) {
      for (var subjectKey in (subjects = graphs[graphKey].subjects)) {
        for (var predicateKey in (subject = subjects[subjectKey])) {
          size += Object.keys(subject[predicateKey]).length
        }
      }
    }
    this._size = size
    return this._size
  }

  // ### `add` adds rdf.Quad if it is not already in the store
  add (quad) {
    if (!this.has(quad)) {
      this._addQuad(quad)
      // Update contexts for the added quad
      if (this._contexts) {
        this._contexts.set(this._contextKey(quad), this._contexter(quad))
      }
    }
    return this
  }

  // ### `delete` removes rdf.Quad from the store
  delete (quad) {
    if (this.has(quad)) {
      if (this._contexts) {
        this._contexts.delete(this._contextKey(quad))
      }
      this._removeQuad(quad)
    }
    return this
  }

  // ### `has` checks whether the store contains the specified rdf.Quad
  has (quad) {
    return this._contexts ? this._contexts.has(this._contextKey(quad))
      : this._some(function (quad) { return true }, ...quadToArray(quad))
  }

  // ### `match` yields an array of matching n3.Quad-s
  // Setting any field to `undefined` or `null` indicates a wildcard.
  match (subject, predicate, object, graph) {
    var quads = this._getQuads(subject, predicate, object, graph)
    if (this._contexts) {
      quads = this._cfactory
        ? quads.map(quad => this._cfactory(this._contexts.get(this._contextKey(quad))))
        : quads.map(quad => this._contexts.get(this._contextKey(quad)))
    }
    // return quads
    return new this.constructor(quads)
  }

  // ### `iterator` yields an iterator to the storing quad-s
  [Symbol.iterator] () {
    return this._contexts
      ? (this._cfactory ? this._iteratorFactCtx() : this._contexts.values())
      : this._iteratorRaw()
  }

  // ### `_contextKey` produces String context key for the quad
  _contextKey (quad) {
    // Convert terms to internal string representation
    const isubj = this._termId(quad.subject)
    const ipred = this._termId(quad.predicate)
    const iobj = this._termId(quad.object)
    const igraph = termToId(quad.graph)
    return DatasetCore._contextKeyRaw(isubj, ipred, iobj, igraph)
  }

  // ### `_contextKey` produces String context key by IDs of the quad components
  static _contextKeyRaw (subjectId, predicateId, objectId, graphId) {
    return `${subjectId}.${predicateId}.${objectId}.${graphId}`
  }

  // ### `_termId` fetch internal numerical id of the term stored in N3Store
  _termId (term) {
    return this._ids[termToId(term)]
  }

  // // ### `addQuads` adds multiple quads to the store
  // _addQuads (quads) {
  //   for (var i = 0; i < quads.length; i++) { this._addQuad(quads[i]) }
  // }

  // ### `_addQuad` adds a new quad to the store.
  // Returns if the quad index has changed, if the quad did not already exist.
  _addQuad (subject, predicate, object, graph) {
    // Shift arguments if a quad object is given instead of components
    if (!predicate) {
      graph = subject.graph
      object = subject.object
      predicate = subject.predicate
      subject = subject.subject
    }

    // Convert terms to internal string representation
    subject = termToId(subject)
    predicate = termToId(predicate)
    object = termToId(object)
    graph = termToId(graph)

    // Find the graph that will contain the triple
    var graphItem = this._graphs[graph]
    // Create the graph if it doesn't exist yet
    if (!graphItem) {
      graphItem = this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} }
      // Freezing a graph helps subsequent `add` performance,
      // and properties will never be modified anyway
      Object.freeze(graphItem)
    }

    // Since entities can often be long IRIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps entities to numbers,
    // which are then used as keys in the other indexes.
    var ids = this._ids
    var entities = this._entities
    subject = ids[subject] || (ids[entities[++this._id] = subject] = this._id)
    predicate = ids[predicate] || (ids[entities[++this._id] = predicate] = this._id)
    object = ids[object] || (ids[entities[++this._id] = object] = this._id)

    var changed = this._addToIndex(graphItem.subjects, subject, predicate, object)
    if (changed) {
      this._addToIndex(graphItem.predicates, predicate, object, subject)
      this._addToIndex(graphItem.objects, object, subject, predicate)

      // The cached quad count is now invalid
      this._size = null
    }
    return changed
  }

  // ### `_addToIndex` adds a quad to a three-layered index.
  // Returns if the index has changed, if the entry did not already exist.
  _addToIndex (index0, key0, key1, key2) {
    // Create layers as necessary
    var index1 = index0[key0] || (index0[key0] = {})
    var index2 = index1[key1] || (index1[key1] = {})
    // Setting the key to _any_ value signals the presence of the quad
    var existed = key2 in index2
    if (!existed) { index2[key2] = null }
    return !existed
  }

  // ### `_removeQuad` removes a quad from the store if it exists
  _removeQuad (subject, predicate, object, graph) {
    // Shift arguments if a quad object is given instead of components
    if (!predicate) {
      graph = subject.graph
      object = subject.object
      predicate = subject.predicate
      subject = subject.subject
    }

    // Convert terms to internal string representation
    subject = termToId(subject)
    predicate = termToId(predicate)
    object = termToId(object)
    graph = termToId(graph)

    // Find internal identifiers for all components
    // and verify the quad exists.
    var graphItem; var ids = this._ids; var graphs = this._graphs; var subjects; var predicates
    if (!(subject = ids[subject]) || !(predicate = ids[predicate]) ||
        !(object = ids[object]) || !(graphItem = graphs[graph]) ||
        !(subjects = graphItem.subjects[subject]) ||
        !(predicates = subjects[predicate]) ||
        !(object in predicates)) { return false }

    // Remove it from all indexes
    this._removeFromIndex(graphItem.subjects, subject, predicate, object)
    this._removeFromIndex(graphItem.predicates, predicate, object, subject)
    this._removeFromIndex(graphItem.objects, object, subject, predicate)
    if (this._size !== null) this._size--

    // Remove the graph if it is empty
    for (subject in graphItem.subjects) return true
    delete graphs[graph]
    return true
  }

  // ### `_removeFromIndex` removes a quad from a three-layered index
  _removeFromIndex (index0, key0, key1, key2) {
    // Remove the quad from the index
    var index1 = index0[key0]; var index2 = index1[key1]; var key
    delete index2[key2]

    // Remove intermediary index layers if they are empty
    for (key in index2) return
    delete index1[key1]
    for (key in index1) return
    delete index0[key0]
  }

  // ### `_some` executes the callback on all quads,
  // and returns `true` if it returns truthy for any of them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  _some (callback, subject, predicate, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject)
    predicate = predicate && termToId(predicate)
    object = object && termToId(object)
    graph = graph && termToId(graph)

    var graphs = this._getGraphs(graph); var content
    var ids = this._ids; var subjectId; var predicateId; var objectId

    // Translate IRIs to internal index keys.
    if ((isString(subject) && !(subjectId = ids[subject])) ||
    (isString(predicate) && !(predicateId = ids[predicate])) ||
    (isString(object) && !(objectId = ids[object]))) {
      return false
    }

    for (var graphId in graphs) {
      content = graphs[graphId]
      // Only if the specified graph contains triples, there can be results
      if (content) {
        // Choose the optimal index, based on what fields are present
        if (subjectId) {
          if (objectId) {
          // If subject and object are given, the object index will be the fastest
            if (this._findInIndex(content.objects, objectId, subjectId, predicateId,
              'object', 'subject', 'predicate', graphId, callback, null)) { return true }
          } else
          // If only subject and possibly predicate are given, the subject index will be the fastest
          if (this._findInIndex(content.subjects, subjectId, predicateId, null,
            'subject', 'predicate', 'object', graphId, callback, null)) { return true }
        } else if (predicateId) {
          // If only predicate and possibly object are given, the predicate index will be the fastest
          if (this._findInIndex(content.predicates, predicateId, objectId, null,
            'predicate', 'object', 'subject', graphId, callback, null)) {
            return true
          }
        } else if (objectId) {
          // If only object is given, the object index will be the fastest
          if (this._findInIndex(content.objects, objectId, null, null,
            'object', 'subject', 'predicate', graphId, callback, null)) {
            return true
          }
        } else
        // If nothing is given, iterate subjects and predicates first
        if (this._findInIndex(content.subjects, null, null, null,
          'subject', 'predicate', 'object', graphId, callback, null)) {
          return true
        }
      }
    }
    return false
  }

  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs (graph) {
    if (!isString(graph)) { return this._graphs }
    var graphs = {}
    graphs[graph] = this._graphs[graph]
    return graphs
  }

  // ### `_findInIndex` finds a set of quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting quad
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graph` will be the graph of the created quads.
  // If `callback` is given, each result is passed through it
  // and iteration halts when it returns truthy for any quad.
  // If instead `array` is given, each result is added to the array.
  _findInIndex (index0, key0, key1, key2, name0, name1, name2, graph, callback, array) {
    var tmp; var index1; var index2; var varCount = !key0 + !key1 + !key2
    // depending on the number of variables, keys or reverse index are faster
    var entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities

    // If a key is specified, use only that part of index 0.
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0]
    for (var value0 in index0) {
      var entity0 = entityKeys[value0]
      index1 = index0[value0]
      if (index1) {
        // If a key is specified, use only that part of index 1.
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1]
        for (var value1 in index1) {
          var entity1 = entityKeys[value1]
          index2 = index1[value1]
          if (index2) {
            // If a key is specified, use only that part of index 2, if it exists.
            var values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2)
            // Create quads for all items found in index 2.
            for (var l = 0; l < values.length; l++) {
              var parts = { subject: null, predicate: null, object: null }
              parts[name0] = termFromId(entity0, this._factory)
              parts[name1] = termFromId(entity1, this._factory)
              parts[name2] = termFromId(entityKeys[values[l]], this._factory)
              var quad = this._factory.quad(
                parts.subject, parts.predicate, parts.object, termFromId(graph, this._factory))
              if (array) { array.push(quad) } else if (callback(quad)) { return true }
            }
          }
        }
      }
    }
    return array
  }

  // ### `_getQuads` returns an array of quads matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  _getQuads (subject, predicate, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject)
    predicate = predicate && termToId(predicate)
    object = object && termToId(object)
    graph = graph && termToId(graph)

    var quads = []; var graphs = this._getGraphs(graph); var content
    var ids = this._ids; var subjectId; var predicateId; var objectId

    // Translate IRIs to internal index keys.
    if ((isString(subject) && !(subjectId = ids[subject])) ||
    (isString(predicate) && !(predicateId = ids[predicate])) ||
    (isString(object) && !(objectId = ids[object]))) {
      return quads
    }

    for (var graphId in graphs) {
      content = graphs[graphId]
      // Only if the specified graph contains triples, there can be results
      if (content) {
        // Choose the optimal index, based on what fields are present
        if (subjectId) {
          if (objectId) {
            // If subject and object are given, the object index will be the fastest
            this._findInIndex(content.objects, objectId, subjectId, predicateId,
              'object', 'subject', 'predicate', graphId, null, quads)
          } else {
            // If only subject and possibly predicate are given, the subject index will be the fastest
            this._findInIndex(content.subjects, subjectId, predicateId, null,
              'subject', 'predicate', 'object', graphId, null, quads)
          }
        } else if (predicateId) {
          // If only predicate and possibly object are given, the predicate index will be the fastest
          this._findInIndex(content.predicates, predicateId, objectId, null,
            'predicate', 'object', 'subject', graphId, null, quads)
        } else if (objectId) {
          // If only object is given, the object index will be the fastest
          this._findInIndex(content.objects, objectId, null, null,
            'object', 'subject', 'predicate', graphId, null, quads)
        } else {
          // If nothing is given, iterate subjects and predicates first
          this._findInIndex(content.subjects, null, null, null,
            'subject', 'predicate', 'object', graphId, null, quads)
        }
      }
    }
    return quads
  }

  // ### `_iteratorCtx` yields an iterator to the storing original quad-s
  * _iteratorFactCtx () {
    for (var ctx of this._contexts.values()) {
      yield this._cfactory(ctx)
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
              // yield rdf.quad(...[isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))
              yield this._factory.quad(...[isubj, ipred, iobj, igraph].map(uid => this._entities[uid]))
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

// Determines whether the argument is a string
function isString (s) {
  return typeof s === 'string' || s instanceof String
}

const XSD = 'http://www.w3.org/2001/XMLSchema#'
const xsd = {
  decimal: XSD + 'decimal',
  boolean: XSD + 'boolean',
  double: XSD + 'double',
  integer: XSD + 'integer',
  string: XSD + 'string'
}

// ## DefaultGraph singleton
const DEFAULTGRAPH = DataFactory.defaultGraph() // new DefaultGraph();

const escapedLiteral = /^"(.*".*)(?="[^"]*$)/
const quadId = /^<<("(?:""|[^"])*"[^ ]*|[^ ]+) ("(?:""|[^"])*"[^ ]*|[^ ]+) ("(?:""|[^"])*"[^ ]*|[^ ]+) ?("(?:""|[^"])*"[^ ]*|[^ ]+)?>>$/

// ### Constructs a term from the given internal string ID
function termFromId (id, factory) {
  factory = factory || DataFactory

  // Falsy value or empty string indicate the default graph
  if (!id) { return factory.defaultGraph() }

  // Identify the term type based on the first character
  switch (id[0]) {
    case '?':
      return factory.variable(id.substr(1))
    case '_':
      return factory.blankNode(id.substr(2))
    case '"':
      /// / Shortcut for internal literals
      // if (factory === DataFactory) { return new DataTypes.Literal(id) }
      // Literal without datatype or language
      if (id[id.length - 1] === '"') { return factory.literal(id.substr(1, id.length - 2)) }
      // Literal with datatype or language
      var endPos = id.lastIndexOf('"', id.length - 1)
      return factory.literal(id.substr(1, endPos - 1),
        id[endPos + 1] === '@' ? id.substr(endPos + 2)
          : factory.namedNode(id.substr(endPos + 3)))
    case '<': {
      const components = quadId.exec(id)
      return factory.quad(
        termFromId(unescapeQuotes(components[1]), factory),
        termFromId(unescapeQuotes(components[2]), factory),
        termFromId(unescapeQuotes(components[3]), factory),
        components[4] && termFromId(unescapeQuotes(components[4]), factory)
      )
    }
    default:
      return factory.namedNode(id)
  }
}

// ### Constructs an internal string ID from the given term or ID string
function termToId (term) {
  if (typeof term === 'string') { return term }
  // Note: term instanceof DataTypes.Term is preferable instead of 'termType' in term
  if ('termType' in term && term.termType !== 'Quad') { return term.value }
  if (!term) { return DEFAULTGRAPH.value }

  // Term instantiated with another library
  switch (term.termType) {
    case 'NamedNode': return term.value
    case 'BlankNode': return '_:' + term.value
    case 'Variable': return '?' + term.value
    case 'DefaultGraph': return ''
    case 'Literal': return '"' + term.value + '"' +
    (term.language ? '@' + term.language
      : (term.datatype && term.datatype.value !== xsd.string ? '^^' + term.datatype.value : ''))
    case 'Quad':
    // To identify RDF* quad components, we escape quotes by doubling them.
    // This avoids the overhead of backslash parsing of Turtle-like syntaxes.
      return `<<${
        escapeQuotes(termToId(term.subject))
      } ${
        escapeQuotes(termToId(term.predicate))
      } ${
        escapeQuotes(termToId(term.object))
      }${
        (isDefaultGraph(term.graph)) ? '' : ` ${termToId(term.graph)}`
      }>>`
    default: throw new Error('Unexpected termType: ' + term.termType)
  }
}

function isDefaultGraph (term) {
  return !!term && term.termType === 'DefaultGraph'
}

// ### Escapes the quotes within the given literal
function escapeQuotes (id) {
  return id.replace(escapedLiteral, (_, quoted) => `"${quoted.replace(/"/g, '""')}`)
}

// ### Unescapes the quotes within the given literal
function unescapeQuotes (id) {
  return id.replace(escapedLiteral, (_, quoted) => `"${quoted.replace(/""/g, '"')}`)
}

module.exports = DatasetCore
