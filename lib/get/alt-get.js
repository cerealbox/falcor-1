'use strict';
const isArray = Array.isArray;

let getRefTarget;

function getPath(
      // root of the cache and the currentNode we're evaluating path against
      root, curNode, 
      // pathSet being evaluated and the index of where we are in pathSet
      pathSet, pathSetIndex, 
      // the absolute path and relative path we've already evaluated
      absPathSoFar, relPathSoFar, 
      // collection of missing absolute and relative paths
      missingAbsPaths, missingRelPaths, 
      // modes that control how JSON data is delivered
      materialize, treatErrorsAsValues) {

   const pathSetLength = pathSet.length;

   // ============ Check for base cases ================

   // if nothing found in cache, add paths to set of abs and rel missing paths
   if (curNode === undefined) {
      let restOfKeys = pathSet.slice(pathSetIndex + 1);
      absPathSoFar.push.apply(absPathSoFar, restOfKeys);
      missingAbsPaths[missingAbsPaths.length] = absPathSoFar;

      relPathSoFar.push.apply(relPathSoFar, restOfKeys);
      missingRelPaths[missingRelPaths.length] = relPathSoFar;
      return curNode;
   } 

   // if atom or error JSON Graph primitive found, short curcuit
   const type = curNode.$type;
   if (type === "atom" || type === "error") {
      return materialize ? curNode : curNode.value;
   } else if (pathSetIndex === pathSetLength) {
      if (type) {
         return materialize ? curNode : curNode.value;
      }
      else {
         throw new Error("Illegal attempt to retrieve non-primitive value.");
      }
   }

   // if ref JSON Graph primitive found, in-line the target of the reference
   // and continue evaluating path.
   if (type === "ref") {
      debugger;
      const refTarget = 
         getRefTarget(
            root, root, 
            curNode.value, 0, // <- evaluate reference path
            [], relPathSoFar, // <- absPathSoFar resets to root []
            pathSet, pathSetIndex + 1,
            missingAbsPaths, missingRelPaths, 
            materialize, treatErrorsAsValues);

      return getPath(
         root, refTarget, 
         pathSet, pathSetIndex, 
         curNode.value.slice(), relPathSoFar, // <- absPathSoFar is ref path now
         missingAbsPaths, missingRelPaths, 
         materialize, treatErrorsAsValues);
   } 
   // curNode will only be an Array if getRefTarget encountered a pathSet in
   // a ref or a refset. For example getRefTarget($ref(["lists",[52,99]]))
   // produces [ cache["lists"][52], cache["lists"][99] ]. When getPath
   // is called on this output, it has to replace each ref target in the
   // array with the result of evaluating the rest of path on the target.
   else if (isArray(curNode)) {
      for (let refTargetIndex = 0, len = curNode.length; refTargetIndex < len; refTargetIndex++) {
         curNode[refTargetIndex] = 
            getPath(
               // evaluate the rest of the path, starting with the ref target
               root, curNode[refTargetIndex],
               pathSet, pathSetIndex, 
               // append pathSetIndex within 
               absPathSoFar.concat(refTargetIndex), relPathSoFar.concat(refTargetIndex), // <- @TODO: Is this right? Don't think these indexes should ever appear in path.
               missingAbsPaths, missingRelPaths, 
               materialize, treatErrorsAsValues);
      }

      return curNode;
   }

   // ============= Is Path Key null, a Key Set, a Range, or a primitive key?   ===================
   const key = pathSet[pathSetIndex];

   // A null key can only appear at the end of a path. It's only useful for
   // indicating that the target of ref should be returned rather than the
   // ref itself. Inserting null at the end of path lengthens the path and
   // ensures we follow the ref before hitting the end condition above 
   // (exit when pathIndex === pathSetLength).
   if (key == null) {
      if (pathSetIndex === pathSetLength - 1) {
         return getPath(
            root, curNode, 
            pathSet, pathSetIndex + 1, // <- just skip to the next key in the path
            absPathSoFar, relPathSoFar, 
            missingAbsPaths, missingRelPaths, 
            materialize, treatErrorsAsValues);
      } else {
         throw new Error("Unexpected null key found before last pathSetIndex of pathSet: " + JSON.stringify(pathSet));
      }
   }
   // If key is a Key Set, recursively call getPath over each key inside the key set
   else if (isArray(key)) {
      let node = {};
      let keySet = key;
      for (let keySetIndex = 0, keySetLength = keySet.length; keySetIndex < keySetLength; keySetIndex++) {
         let keyOrRange = keySet[keySetIndex];
         if (keyOrRange == null) {
            throw new Error("Unexpected null key found in keyset: " + JSON.stringify(pathSet));
         } 
         // if range found in keyset, recursively call getPath over each index in range
         else if (typeof keyOrRange === 'object') {
            let range = keyOrRange;
            let from = range.from || 0;
            let to = range.to == null ? from + range.length - 1 : range.to;
            for (let rangeIndex = from; rangeIndex <= to; rangeIndex++) {
               node[rangeIndex] = 
                  getPath(
                     root, curNode[rangeIndex], // <- evaluate pathSetIndex on curNode
                     pathSet, pathSetIndex + 1, // <- move to next key in pathSet
                     // append key to both rel and abs paths
                     absPathSoFar.concat(rangeIndex), relPathSoFar.concat(rangeIndex), 
                     missingAbsPaths, missingRelPaths, 
                     materialize, treatErrorsAsValues);
            }
         } 
         // otherwise evaluate primitive key against curNode and bump pathIndex
         else {
            node[keyOrRange] = 
               getPath(
                  root, curNode[keyOrRange], // <- keyOrRange is just key
                  pathSet, pathSetIndex + 1, // <- bump pathIndex
                  absPathSoFar.concat(keyOrRange), relPathSoFar.concat(keyOrRange), 
                  missingAbsPaths, missingRelPaths, 
                  materialize, treatErrorsAsValues);
         }
      }

      return node;
   } 
   // If key is a Range, recursively call getPath over each pathSetIndex
   else if (typeof key === 'object') {
      let node = {};
      let range = key;
      let from = range.from || 0;
      let to = range.to == null ? from + range.length - 1 : range.to;
      for (let rangeIndex = from; rangeIndex <= to; rangeIndex++) {
         node[rangeIndex] = 
            getPath(
               root, curNode[rangeIndex], // <- evaluate pathSetIndex on curNode
               pathSet, pathSetIndex + 1, // <- move to next key in pathSet
               // append key to both rel and abs paths
               absPathSoFar.concat(rangeIndex), relPathSoFar.concat(rangeIndex), 
               missingAbsPaths, missingRelPaths, 
               materialize, treatErrorsAsValues);
      }
      return node;
   }
   // The key in the pathSet is just a primitive if we've reached this point.
   // We add the key to the end of the abs and rel paths, and 
   // return an Object that contains the result of recursively evaluating 
   // the rest of the pathSet at the primitive key.
   absPathSoFar[absPathSoFar.length] = key;
   relPathSoFar[relPathSoFar.length] = key;

   return { 
      [key]: 
         getPath(
            root, curNode[key], 
            pathSet, pathSetIndex + 1, 
            absPathSoFar, relPathSoFar, 
            missingAbsPaths, missingRelPaths, 
            materialize, treatErrorsAsValues)
   }
}

//getRef
getRefTarget = 
   function getRefTarget(
      // root of the cache and the currentNode we're evaluating path against
      root, curNode, 
      // pathSet being evaluated and the index of where we are in pathSet
      pathSet, pathSetIndex, 
      // the absolute path and relative path we've already evaluated
      absPathSoFar, relPathSoFar, 
      // 
      relPathSet, relPathSetIndex,
      // collection of missing absolute and relative paths
      missingAbsPaths, missingRelPaths) {

   const pathSetLength = pathSet.length;

   // while loop used to simulate tail recursion
   while(true) {

      // ============ Check for base cases ================

      // if nothing found in cache, add paths to set of abs and rel missing paths
      if (curNode === undefined) {
         //debugger;
         let restOfKeys = relPathSet.slice(relPathSetIndex + 1)
         absPathSoFar.push.apply(absPathSoFar, restOfKeys);
         missingAbsPaths[missingAbsPaths.length] = absPathSoFar

         // relPathSoFar.push.apply(relPathSoFar, restOfKeys);
         // missingRelPaths[missingRelPaths.length] = relPathSoFar
         return curNode;
      }

      // if atom or error JSON Graph primitive found, or we're at end of
      // path, short-curcuit and return currentNode.
      const type = curNode.$type;
      if (type === "atom" || type === "error" || pathSetIndex === pathSetLength) {
        return curNode;
      }

      // if ref JSON Graph primitive found, grab target of the reference
      // and continue evaluating rest of ref path against it.
      if (type === "ref") {
         let refTarget = 
            getRefTarget(
               root, root, 
               curNode.value, 0, 
               [], relPathSoFar, 
               relPathSet, relPathSetIndex, 
               missingAbsPaths, missingRelPaths);

         return getRefTarget(
            root, refTarget, 
            pathSet, pathSetIndex, 
            curNode.value.slice(), relPathSoFar, 
            relPathSet, relPathSetIndex, 
            missingAbsPaths, missingRelPaths);

      } 
      else if (isArray(curNode)) {
         for (let i = 0, len = curNode.length; i < len; i++) {
            curNode[i] = 
               getRefTarget(
                  root, curNode[i], 
                  pathSet, pathSetIndex, 
                  absPathSoFar.concat(i), relPathSoFar, 
                  relPathSet, relPathSetIndex,
                  missingAbsPaths, missingRelPaths);
         }
         return curNode;
      }

      // ============= Is Path Key null, a Key Set, a Range, or a primitive key?   ===================

      const key = pathSet[pathSetIndex];
      if (key == null) {
         throw new Error("Unexpected null key found in ref value: " + JSON.stringify(pathSet));
      }
      else if (typeof key !== "object") {
         // simulate tail recursion
         // absPathSoFar.push(key);
         // return getRefTarget(root, curNode[key], pathSet, pathSetIndex + 1, absPathSoFar, relPathSoFar, missingAbsPaths, missingRelPaths);

         curNode = curNode[key];
         absPathSoFar[absPathSoFar.length] = key;
         pathSetIndex += 1;
         continue;
      }
      // curNode will only be an Array if getRefTarget encountered a pathSet in
      // a ref or a refset. For example getRefTarget($ref(["lists",[52,99]]))
      // produces [ cache["lists"][52], cache["lists"][99] ]. When getPath
      // is called on this output, it has to replace each ref target in the
      // array with the result of evaluating the rest of path on the target.
      else if (isArray(key)) {
         let node = [];
         let nodeLength = 0;
         let keySet = key;
         for (let keySetIndex = 0, keySetLength = keySet.length; keySetIndex < keySetLength; keySetIndex++) {
            let keyOrRange = keySet[keySetIndex];
            if (keyOrRange == null) {
               throw new Error("Unexpected null key found in keyset: " + JSON.stringify(pathSet));
            } else if (typeof keyOrRange === 'object') {
               let range = keyOrRange;
               let from = range.from || 0;
               let length = range.length == null ? (to + 1) - from : range.length;
               for (let rangeIndex = 0; rangeIndex < length; rangeIndex++) {
                  let adjustedIndex = from + rangeIndex;
                  node[nodeLength++] = 
                     getRefTarget(
                        root, curNode[adjustedIndex], 
                        pathSet, pathSetIndex + 1, 
                        absPathSoFar.concat(adjustedIndex), relPathSoFar, 
                        relPathSet, relPathSetIndex,
                        missingAbsPaths, missingRelPaths);
               }
            } else {
               node[nodeLength++] = 
                  getRefTarget(
                     root, curNode[keyOrRange], 
                     pathSet, pathSetIndex + 1, 
                     absPathSoFar.concat(keyOrRange), relPathSoFar, 
                     relPathSet, relPathSetIndex, 
                     missingAbsPaths, missingRelPaths);
            }
         }

         return node;
      } 
      // if range
      else {
         let range = key;
         let from = range.from || 0;
         let to = range.to;
         let length = range.length == null ? (to + 1) - from : range.length;
         let node = new Array(length >= 0 ? length : 0);
         for (let rangeIndex = 0; rangeIndex < length; rangeIndex++) {
            let adjustedIndex = from + rangeIndex;
            node[rangeIndex] = 
               getRefTarget(
                  root, curNode[adjustedIndex], 
                  pathSet, pathSetIndex + 1, 
                  absPathSoFar.concat(adjustedIndex), relPathSoFar, 
                  relPathSet, relPathSetIndex, 
                  missingAbsPaths, missingRelPaths);
         }
         return node;
      }
   }
}

function get$(cache, pathSet, materialize, treatErrorsAsValues) {
  let missingAbsPaths = [];
  let missingRelPaths = [];
  let result = {
      json: getPath(cache, cache, pathSet, 0, [], [], missingAbsPaths, missingRelPaths, materialize, treatErrorsAsValues),
      missingAbsPaths: missingAbsPaths,
      missingRelPaths: missingRelPaths
  };
  return result;
}


module.exports = get$;