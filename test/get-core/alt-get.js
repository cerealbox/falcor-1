'use strict'

var get = require('../../lib/get/alt-get');
var expect = require('chai').expect;
var log = console.log.bind(console)
var falcor = require('../../lib/index')

// function atomify(cache) {
//    if (typeof cache === 'object') {
//       if (cache.$type) { //NOTE: ref's will point to old ref's.  don't presently care.
//          return cache
//       } else {
//          return Object.keys(cache).reduce(function(obj, key) {
//             return Object.assign({ [key]: atomify(cache[key]) }, obj)
//          }, {})
//       }
//    } else {
//       return {
//          $type: "atom",
//          value: cache
//       }
//    }
// }

describe('missing paths', function() {

    it('can cross ref path', function(done) {

		let model = new falcor.Model({
			cache: {
				lomo: { $type: "ref", value: ["lists", 25] },
				lists: {
			      	25: {
			        	name: "hi"
			    	}
				}
			}
		})

		let path = ["lomo", "name"]

		let expected = {
			values: [{
				json: {
					lomo: {
						name: "hi"
					}
				}
		    }],
      		optimizedMissingPaths: [],
      		requestedMissingPaths: []		    
		}

		let result = get(model, [path])
        expect(result).to.deep.equals(expected)		
        done()
	})


    it('can cross ref path set', function(done) {

		let model = new falcor.Model({
			cache: {
				lomo: { $type: "ref", value: ["lists", [25, 39]] },
				lists: {
			      	25: {
			        	name: "hi"
			    	},
			    	39: {
			    		rating: 45
			    	}
				}
			}
		})

		let path = ["lomo", ["name", "rating"]]

		let expected = {
			values: [{
				json: {
					lomo: [
						{ name: "hi" },
						{ rating: 45 }
					]
				}
		    }],
      		optimizedMissingPaths: [
      			["lists", 25, "rating"],
	      		["lists", 39, "name"]
      		],
      		requestedMissingPaths: [
      			["lomo", ["name", "rating"]]
	      	]
		}

		let result = get(model, [path])
        expect(result).to.deep.equals(expected)
        done()
	})


    it('can evaluate path set', function(done) {

		let model = new falcor.Model({
			cache: {
				lists: {
			      	25: {
			        	name: "hi"
			    	},
			    	39: {
			    		rating: 45
			    	}
				}
			}
		})

		let path = ["lists", [25, 39], ["name", "rating"]]

		let expected = {
			values: [{
				json: {
					lists: {
						25: {
							name: "hi"
						},
						39: {
							rating: 45
						}
					}
				}
		    }],
      		optimizedMissingPaths: [
      			["lists", 25, "rating"],
      			["lists", 39, "name"]
      		],
      		requestedMissingPaths: [
      			["lists", 25, "rating"],
	      		["lists", 39, "name"]
	      	]
		}

		let result = get(model, [path])
        expect(result).to.deep.equals(expected)		
        done()
	})



    it('can evaluate a more elaborate path set', function(done) {

		let model = new falcor.Model({
			cache: {
			   genreLists: { $type: "ref", value: ["genreListsById", "hi", {to: 3}, {to: 1}] },
			   genreListsById: {
			      hi: {
			         0: {
			            name: "Horror",
			            0: { name: "die Hard"},
			            1: { name: "die Hard 2"}
			         },
			         1: {
			            name: "Thrillers",
			            0: { name: "die Hard 3"},
			            1: { name: "die Hard 4"}
			         },
			         2: {}
			      }
			   }
			}
		})

		let path = ["genreLists", "name"]

		let expected = {
			values: [{
			    "json": {
			        "genreLists": [
			            [
			                {
			                    "name": "die Hard"
			                },
			                {
			                    "name": "die Hard 2"
			                }
			            ],
			            [
			                {
			                    "name": "die Hard 3"
			                },
			                {
			                    "name": "die Hard 4"
			                }
			            ],
			            [
			                null,
			                null
			            ],
			            null
			        ]
			    }
			}],
		    "optimizedMissingPaths": [
		        [
		            "genreListsById",
		            "hi",
		            2,
		            0,
		            "name"
		        ],
		        [
		            "genreListsById",
		            "hi",
		            2,
		            1,
		            "name"
		        ],
		        [
		            "genreListsById",
		            "hi",
		            3,
		            {
		                "to": 1
		            },
		            "name"
		        ]
		    ],
		    "requestedMissingPaths": [
		        [
		            "genreLists",
		            "name"
		        ]
		    ]
		}

		let result = get(model, [path])
        expect(result).to.deep.equals(expected)		
        done()
	})



})

// test path: [[1,2,3], "key", [1,2,3]]
