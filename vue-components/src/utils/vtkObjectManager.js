var Module = (() => {
  var _scriptDir = import.meta.url;

  return async function (moduleArg = {}) {
    var Module = moduleArg;

    var readyPromiseResolve, readyPromiseReject;

    Module["ready"] = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });

    var moduleOverrides = Object.assign({}, Module);

    var arguments_ = [];

    var thisProgram = "./this.program";

    var quit_ = (status, toThrow) => {
      throw toThrow;
    };

    var ENVIRONMENT_IS_WEB = typeof window == "object";

    var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";

    var ENVIRONMENT_IS_NODE =
      typeof process == "object" &&
      typeof process.versions == "object" &&
      typeof process.versions.node == "string";

    var scriptDirectory = "";

    function locateFile(path) {
      if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory);
      }
      return scriptDirectory + path;
    }

    var read_, readAsync, readBinary;

    if (ENVIRONMENT_IS_NODE) {
      const { createRequire: createRequire } = await import("module");
      /** @suppress{duplicate} */ var require = createRequire(import.meta.url);
      var fs = require("fs");
      var nodePath = require("path");
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = nodePath.dirname(scriptDirectory) + "/";
      } else {
        scriptDirectory = require("url").fileURLToPath(
          new URL("./", import.meta.url)
        );
      }
      read_ = (filename, binary) => {
        filename = isFileURI(filename)
          ? new URL(filename)
          : nodePath.normalize(filename);
        return fs.readFileSync(filename, binary ? undefined : "utf8");
      };
      readBinary = (filename) => {
        var ret = read_(filename, true);
        if (!ret.buffer) {
          ret = new Uint8Array(ret);
        }
        return ret;
      };
      readAsync = (filename, onload, onerror, binary = true) => {
        filename = isFileURI(filename)
          ? new URL(filename)
          : nodePath.normalize(filename);
        fs.readFile(filename, binary ? undefined : "utf8", (err, data) => {
          if (err) onerror(err);
          else onload(binary ? data.buffer : data);
        });
      };
      if (!Module["thisProgram"] && process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, "/");
      }
      arguments_ = process.argv.slice(2);
      process.on("uncaughtException", (ex) => {
        if (
          ex !== "unwind" &&
          !(ex instanceof ExitStatus) &&
          !(ex.context instanceof ExitStatus)
        ) {
          throw ex;
        }
      });
      quit_ = (status, toThrow) => {
        process.exitCode = status;
        throw toThrow;
      };
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (typeof document != "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      }
      if (scriptDirectory.startsWith("blob:")) {
        scriptDirectory = "";
      } else {
        scriptDirectory = scriptDirectory.substr(
          0,
          scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1
        );
      }
      {
        read_ = (url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText;
        };
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = (url) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
          };
        }
        readAsync = (url, onload, onerror) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              onload(xhr.response);
              return;
            }
            onerror();
          };
          xhr.onerror = onerror;
          xhr.send(null);
        };
      }
    } else {
    }

    var out = Module["print"] || console.log.bind(console);

    var err = Module["printErr"] || console.error.bind(console);

    Object.assign(Module, moduleOverrides);

    moduleOverrides = null;

    if (Module["arguments"]) arguments_ = Module["arguments"];

    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

    if (Module["quit"]) quit_ = Module["quit"];

    var wasmBinary;

    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];

    if (typeof WebAssembly != "object") {
      abort("no native wasm support detected");
    }

    var wasmMemory;

    var ABORT = false;

    var EXITSTATUS;

    /** @type {function(*, string=)} */ function assert(condition, text) {
      if (!condition) {
        abort(text);
      }
    }

    var /** @type {!Int8Array} */ HEAP8,
      /** @type {!Uint8Array} */ HEAPU8,
      /** @type {!Int16Array} */ HEAP16,
      /** @type {!Uint16Array} */ HEAPU16,
      /** @type {!Int32Array} */ HEAP32,
      /** @type {!Uint32Array} */ HEAPU32,
      /** @type {!Float32Array} */ HEAPF32,
      /** @type {!Float64Array} */ HEAPF64;

    function updateMemoryViews() {
      var b = wasmMemory.buffer;
      Module["HEAP8"] = HEAP8 = new Int8Array(b);
      Module["HEAP16"] = HEAP16 = new Int16Array(b);
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
      Module["HEAP32"] = HEAP32 = new Int32Array(b);
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
      Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
      Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
    }

    var __ATPRERUN__ = [];

    var __ATINIT__ = [];

    var __ATMAIN__ = [];

    var __ATPOSTRUN__ = [];

    var runtimeInitialized = false;

    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
          Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }

    function initRuntime() {
      runtimeInitialized = true;
      if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
      FS.ignorePermissions = false;
      TTY.init();
      callRuntimeCallbacks(__ATINIT__);
    }

    function preMain() {
      callRuntimeCallbacks(__ATMAIN__);
    }

    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
          Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }

    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }

    function addOnInit(cb) {
      __ATINIT__.unshift(cb);
    }

    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }

    var runDependencies = 0;

    var runDependencyWatcher = null;

    var dependenciesFulfilled = null;

    function getUniqueRunDependency(id) {
      return id;
    }

    function addRunDependency(id) {
      runDependencies++;
      Module["monitorRunDependencies"]?.(runDependencies);
    }

    function removeRunDependency(id) {
      runDependencies--;
      Module["monitorRunDependencies"]?.(runDependencies);
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }

    /** @param {string|number=} what */ function abort(what) {
      Module["onAbort"]?.(what);
      what = "Aborted(" + what + ")";
      err(what);
      ABORT = true;
      EXITSTATUS = 1;
      what += ". Build with -sASSERTIONS for more info.";
      /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
      readyPromiseReject(e);
      throw e;
    }

    var dataURIPrefix = "data:application/octet-stream;base64,";

    /**
     * Indicates whether filename is a base64 data URI.
     * @noinline
     */ var isDataURI = (filename) => filename.startsWith(dataURIPrefix);

    /**
     * Indicates whether filename is delivered via file protocol (as opposed to http/https)
     * @noinline
     */ var isFileURI = (filename) => filename.startsWith("file://");

    var wasmBinaryFile;

    if (Module["locateFile"]) {
      wasmBinaryFile = "vtkObjectManager.wasm";
      if (!isDataURI(wasmBinaryFile)) {
        wasmBinaryFile = locateFile(wasmBinaryFile);
      }
    } else {
      wasmBinaryFile = new URL("vtkObjectManager.wasm", import.meta.url).href;
    }

    function getBinarySync(file) {
      if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary);
      }
      if (readBinary) {
        return readBinary(file);
      }
      throw "both async and sync fetching of the wasm failed";
    }

    function getBinaryPromise(binaryFile) {
      if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
        if (typeof fetch == "function") {
          return fetch(binaryFile, {
            credentials: "same-origin",
          })
            .then((response) => {
              if (!response["ok"]) {
                throw `failed to load wasm binary file at '${binaryFile}'`;
              }
              return response["arrayBuffer"]();
            })
            .catch(() => getBinarySync(binaryFile));
        }
      }
      return Promise.resolve().then(() => getBinarySync(binaryFile));
    }

    function instantiateArrayBuffer(binaryFile, imports, receiver) {
      return getBinaryPromise(binaryFile)
        .then((binary) => WebAssembly.instantiate(binary, imports))
        .then((instance) => instance)
        .then(receiver, (reason) => {
          err(`failed to asynchronously prepare wasm: ${reason}`);
          abort(reason);
        });
    }

    function instantiateAsync(binary, binaryFile, imports, callback) {
      if (
        !binary &&
        typeof WebAssembly.instantiateStreaming == "function" &&
        !isDataURI(binaryFile) &&
        !ENVIRONMENT_IS_NODE &&
        typeof fetch == "function"
      ) {
        return fetch(binaryFile, {
          credentials: "same-origin",
        }).then((response) => {
          /** @suppress {checkTypes} */ var result =
            WebAssembly.instantiateStreaming(response, imports);
          return result.then(callback, function (reason) {
            err(`wasm streaming compile failed: ${reason}`);
            err("falling back to ArrayBuffer instantiation");
            return instantiateArrayBuffer(binaryFile, imports, callback);
          });
        });
      }
      return instantiateArrayBuffer(binaryFile, imports, callback);
    }

    function createWasm() {
      var info = {
        a: wasmImports,
      };
      /** @param {WebAssembly.Module=} module*/ function receiveInstance(
        instance,
        module
      ) {
        wasmExports = instance.exports;
        wasmExports = applySignatureConversions(wasmExports);
        wasmMemory = wasmExports["ki"];
        updateMemoryViews();
        wasmTable = wasmExports["oi"];
        addOnInit(wasmExports["li"]);
        removeRunDependency("wasm-instantiate");
        return wasmExports;
      }
      addRunDependency("wasm-instantiate");
      function receiveInstantiationResult(result) {
        receiveInstance(result["instance"]);
      }
      if (Module["instantiateWasm"]) {
        try {
          return Module["instantiateWasm"](info, receiveInstance);
        } catch (e) {
          err(`Module.instantiateWasm callback failed with error: ${e}`);
          readyPromiseReject(e);
        }
      }
      instantiateAsync(
        wasmBinary,
        wasmBinaryFile,
        info,
        receiveInstantiationResult
      ).catch(readyPromiseReject);
      return {};
    }

    var tempDouble;

    var tempI64;

    var ASM_CONSTS = {
      1586156: () => {
        if (typeof AudioContext !== "undefined") {
          return true;
        } else if (typeof webkitAudioContext !== "undefined") {
          return true;
        }
        return false;
      },
      1586303: () => {
        if (
          typeof navigator.mediaDevices !== "undefined" &&
          typeof navigator.mediaDevices.getUserMedia !== "undefined"
        ) {
          return true;
        } else if (typeof navigator.webkitGetUserMedia !== "undefined") {
          return true;
        }
        return false;
      },
      1586537: ($0) => {
        if (typeof Module["SDL2"] === "undefined") {
          Module["SDL2"] = {};
        }
        var SDL2 = Module["SDL2"];
        if (!$0) {
          SDL2.audio = {};
        } else {
          SDL2.capture = {};
        }
        if (!SDL2.audioContext) {
          if (typeof AudioContext !== "undefined") {
            SDL2.audioContext = new AudioContext();
          } else if (typeof webkitAudioContext !== "undefined") {
            SDL2.audioContext = new webkitAudioContext();
          }
          if (SDL2.audioContext) {
            autoResumeAudioContext(SDL2.audioContext);
          }
        }
        return SDL2.audioContext === undefined ? -1 : 0;
      },
      1587030: () => {
        var SDL2 = Module["SDL2"];
        return SDL2.audioContext.sampleRate;
      },
      1587098: ($0, $1, $2, $3) => {
        var SDL2 = Module["SDL2"];
        var have_microphone = function (stream) {
          if (SDL2.capture.silenceTimer !== undefined) {
            clearTimeout(SDL2.capture.silenceTimer);
            SDL2.capture.silenceTimer = undefined;
          }
          SDL2.capture.mediaStreamNode =
            SDL2.audioContext.createMediaStreamSource(stream);
          SDL2.capture.scriptProcessorNode =
            SDL2.audioContext.createScriptProcessor($1, $0, 1);
          SDL2.capture.scriptProcessorNode.onaudioprocess = function (
            audioProcessingEvent
          ) {
            if (SDL2 === undefined || SDL2.capture === undefined) {
              return;
            }
            audioProcessingEvent.outputBuffer.getChannelData(0).fill(0);
            SDL2.capture.currentCaptureBuffer =
              audioProcessingEvent.inputBuffer;
            dynCall("vi", $2, [$3]);
          };
          SDL2.capture.mediaStreamNode.connect(
            SDL2.capture.scriptProcessorNode
          );
          SDL2.capture.scriptProcessorNode.connect(
            SDL2.audioContext.destination
          );
          SDL2.capture.stream = stream;
        };
        var no_microphone = function (error) {};
        SDL2.capture.silenceBuffer = SDL2.audioContext.createBuffer(
          $0,
          $1,
          SDL2.audioContext.sampleRate
        );
        SDL2.capture.silenceBuffer.getChannelData(0).fill(0);
        var silence_callback = function () {
          SDL2.capture.currentCaptureBuffer = SDL2.capture.silenceBuffer;
          dynCall("vi", $2, [$3]);
        };
        SDL2.capture.silenceTimer = setTimeout(
          silence_callback,
          ($1 / SDL2.audioContext.sampleRate) * 1e3
        );
        if (
          navigator.mediaDevices !== undefined &&
          navigator.mediaDevices.getUserMedia !== undefined
        ) {
          navigator.mediaDevices
            .getUserMedia({
              audio: true,
              video: false,
            })
            .then(have_microphone)
            .catch(no_microphone);
        } else if (navigator.webkitGetUserMedia !== undefined) {
          navigator.webkitGetUserMedia(
            {
              audio: true,
              video: false,
            },
            have_microphone,
            no_microphone
          );
        }
      },
      1588750: ($0, $1, $2, $3) => {
        var SDL2 = Module["SDL2"];
        SDL2.audio.scriptProcessorNode = SDL2.audioContext[
          "createScriptProcessor"
        ]($1, 0, $0);
        SDL2.audio.scriptProcessorNode["onaudioprocess"] = function (e) {
          if (SDL2 === undefined || SDL2.audio === undefined) {
            return;
          }
          SDL2.audio.currentOutputBuffer = e["outputBuffer"];
          dynCall("vi", $2, [$3]);
        };
        SDL2.audio.scriptProcessorNode["connect"](
          SDL2.audioContext["destination"]
        );
      },
      1589160: ($0, $1) => {
        var SDL2 = Module["SDL2"];
        var numChannels = SDL2.capture.currentCaptureBuffer.numberOfChannels;
        for (var c = 0; c < numChannels; ++c) {
          var channelData = SDL2.capture.currentCaptureBuffer.getChannelData(c);
          if (channelData.length != $1) {
            throw (
              "Web Audio capture buffer length mismatch! Destination size: " +
              channelData.length +
              " samples vs expected " +
              $1 +
              " samples!"
            );
          }
          if (numChannels == 1) {
            for (var j = 0; j < $1; ++j) {
              setValue($0 + j * 4, channelData[j], "float");
            }
          } else {
            for (var j = 0; j < $1; ++j) {
              setValue($0 + (j * numChannels + c) * 4, channelData[j], "float");
            }
          }
        }
      },
      1589765: ($0, $1) => {
        var SDL2 = Module["SDL2"];
        var numChannels = SDL2.audio.currentOutputBuffer["numberOfChannels"];
        for (var c = 0; c < numChannels; ++c) {
          var channelData = SDL2.audio.currentOutputBuffer["getChannelData"](c);
          if (channelData.length != $1) {
            throw (
              "Web Audio output buffer length mismatch! Destination size: " +
              channelData.length +
              " samples vs expected " +
              $1 +
              " samples!"
            );
          }
          for (var j = 0; j < $1; ++j) {
            channelData[j] = HEAPF32[($0 + ((j * numChannels + c) << 2)) >>> 2];
          }
        }
      },
      1590245: ($0) => {
        var SDL2 = Module["SDL2"];
        if ($0) {
          if (SDL2.capture.silenceTimer !== undefined) {
            clearTimeout(SDL2.capture.silenceTimer);
          }
          if (SDL2.capture.stream !== undefined) {
            var tracks = SDL2.capture.stream.getAudioTracks();
            for (var i = 0; i < tracks.length; i++) {
              SDL2.capture.stream.removeTrack(tracks[i]);
            }
            SDL2.capture.stream = undefined;
          }
          if (SDL2.capture.scriptProcessorNode !== undefined) {
            SDL2.capture.scriptProcessorNode.onaudioprocess = function (
              audioProcessingEvent
            ) {};
            SDL2.capture.scriptProcessorNode.disconnect();
            SDL2.capture.scriptProcessorNode = undefined;
          }
          if (SDL2.capture.mediaStreamNode !== undefined) {
            SDL2.capture.mediaStreamNode.disconnect();
            SDL2.capture.mediaStreamNode = undefined;
          }
          if (SDL2.capture.silenceBuffer !== undefined) {
            SDL2.capture.silenceBuffer = undefined;
          }
          SDL2.capture = undefined;
        } else {
          if (SDL2.audio.scriptProcessorNode != undefined) {
            SDL2.audio.scriptProcessorNode.disconnect();
            SDL2.audio.scriptProcessorNode = undefined;
          }
          SDL2.audio = undefined;
        }
        if (
          SDL2.audioContext !== undefined &&
          SDL2.audio === undefined &&
          SDL2.capture === undefined
        ) {
          SDL2.audioContext.close();
          SDL2.audioContext = undefined;
        }
      },
      1591417: ($0, $1, $2, $3, $4) =>
        Browser.safeSetTimeout(function () {
          dynCall("viiii", $0, [$1, $2, $3, $4]);
        }, $2),
      1591512: ($0) => {
        window.clearTimeout($0);
      },
      1591541: ($0, $1, $2, $3, $4) =>
        Browser.safeSetTimeout(function () {
          dynCall("viiii", $0, [$1, $2, $3, $4]);
        }, $2),
      1591636: ($0, $1, $2) => {
        var w = $0;
        var h = $1;
        var pixels = $2;
        if (!Module["SDL2"]) Module["SDL2"] = {};
        var SDL2 = Module["SDL2"];
        if (SDL2.ctxCanvas !== Module["canvas"]) {
          SDL2.ctx = Module["createContext"](Module["canvas"], false, true);
          SDL2.ctxCanvas = Module["canvas"];
        }
        if (SDL2.w !== w || SDL2.h !== h || SDL2.imageCtx !== SDL2.ctx) {
          SDL2.image = SDL2.ctx.createImageData(w, h);
          SDL2.w = w;
          SDL2.h = h;
          SDL2.imageCtx = SDL2.ctx;
        }
        var data = SDL2.image.data;
        var src = pixels >> 2;
        var dst = 0;
        var num;
        if (
          typeof CanvasPixelArray !== "undefined" &&
          data instanceof CanvasPixelArray
        ) {
          num = data.length;
          while (dst < num) {
            var val = HEAP32[src >>> 0];
            data[dst] = val & 255;
            data[dst + 1] = (val >> 8) & 255;
            data[dst + 2] = (val >> 16) & 255;
            data[dst + 3] = 255;
            src++;
            dst += 4;
          }
        } else {
          if (SDL2.data32Data !== data) {
            SDL2.data32 = new Int32Array(data.buffer);
            SDL2.data8 = new Uint8Array(data.buffer);
            SDL2.data32Data = data;
          }
          var data32 = SDL2.data32;
          num = data32.length;
          data32.set(HEAP32.subarray(src >>> 0, (src + num) >>> 0));
          var data8 = SDL2.data8;
          var i = 3;
          var j = i + 4 * num;
          if (num % 8 == 0) {
            while (i < j) {
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
              data8[i] = 255;
              i = (i + 4) | 0;
            }
          } else {
            while (i < j) {
              data8[i] = 255;
              i = (i + 4) | 0;
            }
          }
        }
        SDL2.ctx.putImageData(SDL2.image, 0, 0);
      },
      1593105: ($0, $1, $2, $3, $4) => {
        var w = $0;
        var h = $1;
        var hot_x = $2;
        var hot_y = $3;
        var pixels = $4;
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        var image = ctx.createImageData(w, h);
        var data = image.data;
        var src = pixels >> 2;
        var dst = 0;
        var num;
        if (
          typeof CanvasPixelArray !== "undefined" &&
          data instanceof CanvasPixelArray
        ) {
          num = data.length;
          while (dst < num) {
            var val = HEAP32[src >>> 0];
            data[dst] = val & 255;
            data[dst + 1] = (val >> 8) & 255;
            data[dst + 2] = (val >> 16) & 255;
            data[dst + 3] = (val >> 24) & 255;
            src++;
            dst += 4;
          }
        } else {
          var data32 = new Int32Array(data.buffer);
          num = data32.length;
          data32.set(HEAP32.subarray(src >>> 0, (src + num) >>> 0));
        }
        ctx.putImageData(image, 0, 0);
        var url =
          hot_x === 0 && hot_y === 0
            ? "url(" + canvas.toDataURL() + "), auto"
            : "url(" +
              canvas.toDataURL() +
              ") " +
              hot_x +
              " " +
              hot_y +
              ", auto";
        var urlBuf = _malloc(url.length + 1);
        stringToUTF8(url, urlBuf, url.length + 1);
        return urlBuf;
      },
      1594094: ($0) => {
        if (Module["canvas"]) {
          Module["canvas"].style["cursor"] = UTF8ToString($0);
        }
      },
      1594177: () => {
        if (Module["canvas"]) {
          Module["canvas"].style["cursor"] = "none";
        }
      },
      1594246: () => window.innerWidth,
      1594276: () => window.innerHeight,
    };

    /** @constructor */ function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }

    var listenOnce = (object, event, func) => {
      object.addEventListener(event, func, {
        once: true,
      });
    };

    /** @param {Object=} elements */ var autoResumeAudioContext = (
      ctx,
      elements
    ) => {
      if (!elements) {
        elements = [document, document.getElementById("canvas")];
      }
      ["keydown", "mousedown", "touchstart"].forEach((event) => {
        elements.forEach((element) => {
          if (element) {
            listenOnce(element, event, () => {
              if (ctx.state === "suspended") ctx.resume();
            });
          }
        });
      });
    };

    var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        callbacks.shift()(Module);
      }
    };

    var withStackSave = (f) => {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    };

    var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        if (c <= 127) {
          len++;
        } else if (c <= 2047) {
          len += 2;
        } else if (c >= 55296 && c <= 57343) {
          len += 4;
          ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };

    var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      outIdx >>>= 0;
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i);
          u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break;
          heap[outIdx++ >>> 0] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++ >>> 0] = 192 | (u >> 6);
          heap[outIdx++ >>> 0] = 128 | (u & 63);
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++ >>> 0] = 224 | (u >> 12);
          heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
          heap[outIdx++ >>> 0] = 128 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          heap[outIdx++ >>> 0] = 240 | (u >> 18);
          heap[outIdx++ >>> 0] = 128 | ((u >> 12) & 63);
          heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
          heap[outIdx++ >>> 0] = 128 | (u & 63);
        }
      }
      heap[outIdx >>> 0] = 0;
      return outIdx - startIdx;
    };

    var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
      stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

    var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };

    var UTF8Decoder =
      typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;

    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
      idx >>>= 0;
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = "";
      while (idx < endPtr) {
        var u0 = heapOrArray[idx++];
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue;
        }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode(((u0 & 31) << 6) | u1);
          continue;
        }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          u0 =
            ((u0 & 7) << 18) |
            (u1 << 12) |
            (u2 << 6) |
            (heapOrArray[idx++] & 63);
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
        }
      }
      return str;
    };

    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => {
      ptr >>>= 0;
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    };

    var demangle = (func) => {
      demangle.recursionGuard = (demangle.recursionGuard | 0) + 1;
      if (demangle.recursionGuard > 1) return func;
      return withStackSave(() => {
        try {
          var s = func;
          if (s.startsWith("__Z")) s = s.substr(1);
          var buf = stringToUTF8OnStack(s);
          var status = stackAlloc(4);
          var ret = ___cxa_demangle(buf, 0, 0, status);
          if (HEAP32[(status >>> 2) >>> 0] === 0 && ret) {
            return UTF8ToString(ret);
          }
        } catch (e) {
        } finally {
          _free(ret);
          if (demangle.recursionGuard < 2) --demangle.recursionGuard;
        }
        return func;
      });
    };

    var dynCallLegacy = (sig, ptr, args) => {
      var f = Module["dynCall_" + sig];
      return args && args.length
        ? f.apply(null, [ptr].concat(args))
        : f.call(null, ptr);
    };

    var wasmTableMirror = [];

    var wasmTable;

    var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length)
          wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      return func;
    };

    /** @param {Object=} args */ var dynCall = (sig, ptr, args) => {
      if (sig.includes("j")) {
        return dynCallLegacy(sig, ptr, args);
      }
      var rtn = getWasmTableEntry(ptr).apply(null, args);
      return rtn;
    };

    var noExitRuntime = Module["noExitRuntime"] || true;

    /**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */ function setValue(ptr, value, type = "i8") {
      if (type.endsWith("*")) type = "*";
      switch (type) {
        case "i1":
          HEAP8[(ptr >>> 0) >>> 0] = value;
          break;

        case "i8":
          HEAP8[(ptr >>> 0) >>> 0] = value;
          break;

        case "i16":
          HEAP16[(ptr >>> 1) >>> 0] = value;
          break;

        case "i32":
          HEAP32[(ptr >>> 2) >>> 0] = value;
          break;

        case "i64":
          abort("to do setValue(i64) use WASM_BIGINT");

        case "float":
          HEAPF32[(ptr >>> 2) >>> 0] = value;
          break;

        case "double":
          HEAPF64[(ptr >>> 3) >>> 0] = value;
          break;

        case "*":
          HEAPU32[(ptr >>> 2) >>> 0] = value;
          break;

        default:
          abort(`invalid type for setValue: ${type}`);
      }
    }

    class ExceptionInfo {
      constructor(excPtr) {
        this.excPtr = excPtr;
        this.ptr = excPtr - 24;
      }
      set_type(type) {
        HEAPU32[((this.ptr + 4) >>> 2) >>> 0] = type;
      }
      get_type() {
        return HEAPU32[((this.ptr + 4) >>> 2) >>> 0];
      }
      set_destructor(destructor) {
        HEAPU32[((this.ptr + 8) >>> 2) >>> 0] = destructor;
      }
      get_destructor() {
        return HEAPU32[((this.ptr + 8) >>> 2) >>> 0];
      }
      set_caught(caught) {
        caught = caught ? 1 : 0;
        HEAP8[((this.ptr + 12) >>> 0) >>> 0] = caught;
      }
      get_caught() {
        return HEAP8[((this.ptr + 12) >>> 0) >>> 0] != 0;
      }
      set_rethrown(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[((this.ptr + 13) >>> 0) >>> 0] = rethrown;
      }
      get_rethrown() {
        return HEAP8[((this.ptr + 13) >>> 0) >>> 0] != 0;
      }
      init(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor);
      }
      set_adjusted_ptr(adjustedPtr) {
        HEAPU32[((this.ptr + 16) >>> 2) >>> 0] = adjustedPtr;
      }
      get_adjusted_ptr() {
        return HEAPU32[((this.ptr + 16) >>> 2) >>> 0];
      }
      get_exception_ptr() {
        var isPointer = ___cxa_is_pointer_type(this.get_type());
        if (isPointer) {
          return HEAPU32[(this.excPtr >>> 2) >>> 0];
        }
        var adjusted = this.get_adjusted_ptr();
        if (adjusted !== 0) return adjusted;
        return this.excPtr;
      }
    }

    var exceptionLast = 0;

    var uncaughtExceptionCount = 0;

    var convertI32PairToI53Checked = (lo, hi) =>
      (hi + 2097152) >>> 0 < 4194305 - !!lo
        ? (lo >>> 0) + hi * 4294967296
        : NaN;

    function ___cxa_throw(ptr, type, destructor) {
      ptr >>>= 0;
      type >>>= 0;
      destructor >>>= 0;
      var info = new ExceptionInfo(ptr);
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      throw exceptionLast;
    }

    var PATH = {
      isAbs: (path) => path.charAt(0) === "/",
      splitPath: (filename) => {
        var splitPathRe =
          /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
      normalizeArray: (parts, allowAboveRoot) => {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === ".") {
            parts.splice(i, 1);
          } else if (last === "..") {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift("..");
          }
        }
        return parts;
      },
      normalize: (path) => {
        var isAbsolute = PATH.isAbs(path),
          trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(
          path.split("/").filter((p) => !!p),
          !isAbsolute
        ).join("/");
        if (!path && !isAbsolute) {
          path = ".";
        }
        if (path && trailingSlash) {
          path += "/";
        }
        return (isAbsolute ? "/" : "") + path;
      },
      dirname: (path) => {
        var result = PATH.splitPath(path),
          root = result[0],
          dir = result[1];
        if (!root && !dir) {
          return ".";
        }
        if (dir) {
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },
      basename: (path) => {
        if (path === "/") return "/";
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1) return path;
        return path.substr(lastSlash + 1);
      },
      join: function () {
        var paths = Array.prototype.slice.call(arguments);
        return PATH.normalize(paths.join("/"));
      },
      join2: (l, r) => PATH.normalize(l + "/" + r),
    };

    var initRandomFill = () => {
      if (
        typeof crypto == "object" &&
        typeof crypto["getRandomValues"] == "function"
      ) {
        return (view) => crypto.getRandomValues(view);
      } else if (ENVIRONMENT_IS_NODE) {
        try {
          var crypto_module = require("crypto");
          var randomFillSync = crypto_module["randomFillSync"];
          if (randomFillSync) {
            return (view) => crypto_module["randomFillSync"](view);
          }
          var randomBytes = crypto_module["randomBytes"];
          return (view) => (view.set(randomBytes(view.byteLength)), view);
        } catch (e) {}
      }
      abort("initRandomDevice");
    };

    var randomFill = (view) => (randomFill = initRandomFill())(view);

    var PATH_FS = {
      resolve: function () {
        var resolvedPath = "",
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = i >= 0 ? arguments[i] : FS.cwd();
          if (typeof path != "string") {
            throw new TypeError("Arguments to path.resolve must be strings");
          } else if (!path) {
            return "";
          }
          resolvedPath = path + "/" + resolvedPath;
          resolvedAbsolute = PATH.isAbs(path);
        }
        resolvedPath = PATH.normalizeArray(
          resolvedPath.split("/").filter((p) => !!p),
          !resolvedAbsolute
        ).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
      },
      relative: (from, to) => {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== "") break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== "") break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push("..");
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/");
      },
    };

    var FS_stdin_getChar_buffer = [];

    /** @type {function(string, boolean=, number=)} */ function intArrayFromString(
      stringy,
      dontAddNull,
      length
    ) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(
        stringy,
        u8array,
        0,
        u8array.length
      );
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    }

    var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
          /** @suppress {missingProperties} */ var fd = process.stdin.fd;
          try {
            bytesRead = fs.readSync(fd, buf);
          } catch (e) {
            if (e.toString().includes("EOF")) bytesRead = 0;
            else throw e;
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString("utf-8");
          } else {
            result = null;
          }
        } else if (
          typeof window != "undefined" &&
          typeof window.prompt == "function"
        ) {
          result = window.prompt("Input: ");
          if (result !== null) {
            result += "\n";
          }
        } else if (typeof readline == "function") {
          result = readline();
          if (result !== null) {
            result += "\n";
          }
        }
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };

    var TTY = {
      ttys: [],
      init() {},
      shutdown() {},
      register(dev, ops) {
        TTY.ttys[dev] = {
          input: [],
          output: [],
          ops: ops,
        };
        FS.registerDevice(dev, TTY.stream_ops);
      },
      stream_ops: {
        open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
        close(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
        fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
        read(stream, buffer, offset, length, pos) {
          /* ignored */ if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },
        write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        },
      },
      default_tty_ops: {
        get_char(tty) {
          return FS_stdin_getChar();
        },
        put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
        ioctl_tcgets(tty) {
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
          };
        },
        ioctl_tcsets(tty, optional_actions, data) {
          return 0;
        },
        ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
      },
      default_tty1_ops: {
        put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
      },
    };

    var zeroMemory = (address, size) => {
      HEAPU8.fill(0, address, address + size);
      return address;
    };

    var alignMemory = (size, alignment) =>
      Math.ceil(size / alignment) * alignment;

    var mmapAlloc = (size) => {
      size = alignMemory(size, 65536);
      var ptr = _emscripten_builtin_memalign(65536, size);
      if (!ptr) return 0;
      return zeroMemory(ptr, size);
    };

    var MEMFS = {
      ops_table: null,
      mount(mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, /* 0777 */ 0);
      },
      createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          throw new FS.ErrnoError(63);
        }
        MEMFS.ops_table ||= {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
            },
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              allocate: MEMFS.stream_ops.allocate,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync,
            },
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink,
            },
            stream: {},
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: FS.chrdev_stream_ops,
          },
        };
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0;
          node.contents = null;
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }
        return node;
      },
      getFileDataAsTypedArray(node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray)
          return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents);
      },
      expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(
          newCapacity,
          (prevCapacity *
            (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>>
            0
        );
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0)
          node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
      },
      resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null;
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize);
          if (oldContents) {
            node.contents.set(
              oldContents.subarray(0, Math.min(newSize, node.usedBytes))
            );
          }
          node.usedBytes = newSize;
        }
      },
      node_ops: {
        getattr(node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
        setattr(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
        lookup(parent, name) {
          throw FS.genericErrors[44];
        },
        mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
        rename(old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {}
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now();
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },
        unlink(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
        rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
        readdir(node) {
          var entries = [".", ".."];
          for (var key of Object.keys(node.contents)) {
            entries.push(key);
          }
          return entries;
        },
        symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(
            parent,
            newname,
            511 | /* 0777 */ 40960,
            0
          );
          node.link = oldpath;
          return node;
        },
        readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
      },
      stream_ops: {
        read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) {
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++)
              buffer[offset + i] = contents[position + i];
          }
          return size;
        },
        write(stream, buffer, offset, length, position, canOwn) {
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
          if (buffer.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(
                buffer.subarray(offset, offset + length),
                position
              );
              return length;
            }
          }
          MEMFS.expandFileStorage(node, position + length);
          if (node.contents.subarray && buffer.subarray) {
            node.contents.set(
              buffer.subarray(offset, offset + length),
              position
            );
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer[offset + i];
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
        llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
        allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(
            stream.node.usedBytes,
            offset + length
          );
        },
        mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(
                  contents,
                  position,
                  position + length
                );
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr >>> 0);
          }
          return {
            ptr: ptr,
            allocated: allocated,
          };
        },
        msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          return 0;
        },
      },
    };

    /** @param {boolean=} noRunDep */ var asyncLoad = (
      url,
      onload,
      onerror,
      noRunDep
    ) => {
      var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";
      readAsync(
        url,
        (arrayBuffer) => {
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        },
        (event) => {
          if (onerror) {
            onerror();
          } else {
            throw `Loading data file "${url}" failed.`;
          }
        }
      );
      if (dep) addRunDependency(dep);
    };

    var FS_createDataFile = (
      parent,
      name,
      fileData,
      canRead,
      canWrite,
      canOwn
    ) => {
      FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
    };

    var preloadPlugins = Module["preloadPlugins"] || [];

    var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
      if (typeof Browser != "undefined") Browser.init();
      var handled = false;
      preloadPlugins.forEach((plugin) => {
        if (handled) return;
        if (plugin["canHandle"](fullname)) {
          plugin["handle"](byteArray, fullname, finish, onerror);
          handled = true;
        }
      });
      return handled;
    };

    var FS_createPreloadedFile = (
      parent,
      name,
      url,
      canRead,
      canWrite,
      onload,
      onerror,
      dontCreateFile,
      canOwn,
      preFinish
    ) => {
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`);
      function processData(byteArray) {
        function finish(byteArray) {
          preFinish?.();
          if (!dontCreateFile) {
            FS_createDataFile(
              parent,
              name,
              byteArray,
              canRead,
              canWrite,
              canOwn
            );
          }
          onload?.();
          removeRunDependency(dep);
        }
        if (
          FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
            onerror?.();
            removeRunDependency(dep);
          })
        ) {
          return;
        }
        finish(byteArray);
      }
      addRunDependency(dep);
      if (typeof url == "string") {
        asyncLoad(url, processData, onerror);
      } else {
        processData(url);
      }
    };

    var FS_modeStringToFlags = (str) => {
      var flagModes = {
        r: 0,
        "r+": 2,
        w: 512 | 64 | 1,
        "w+": 512 | 64 | 2,
        a: 1024 | 64 | 1,
        "a+": 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == "undefined") {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };

    var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };

    var FS = {
      root: null,
      mounts: [],
      devices: {},
      streams: [],
      nextInode: 1,
      nameTable: null,
      currentPath: "/",
      initialized: false,
      ignorePermissions: true,
      ErrnoError: class {
        constructor(errno) {
          this.name = "ErrnoError";
          this.errno = errno;
        }
      },
      genericErrors: {},
      filesystems: null,
      syncFSRequests: 0,
      lookupPath(path, opts = {}) {
        path = PATH_FS.resolve(path);
        if (!path)
          return {
            path: "",
            node: null,
          };
        var defaults = {
          follow_mount: true,
          recurse_count: 0,
        };
        opts = Object.assign(defaults, opts);
        if (opts.recurse_count > 8) {
          throw new FS.ErrnoError(32);
        }
        var parts = path.split("/").filter((p) => !!p);
        var current = FS.root;
        var current_path = "/";
        for (var i = 0; i < parts.length; i++) {
          var islast = i === parts.length - 1;
          if (islast && opts.parent) {
            break;
          }
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
              var lookup = FS.lookupPath(current_path, {
                recurse_count: opts.recurse_count + 1,
              });
              current = lookup.node;
              if (count++ > 40) {
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
        return {
          path: current_path,
          node: current,
        };
      },
      getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length - 1] !== "/"
              ? `${mount}/${path}`
              : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
      hashName(parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
      hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
      hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
      lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        return FS.lookup(parent, name);
      },
      createNode(parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev);
        FS.hashAddNode(node);
        return node;
      },
      destroyNode(node) {
        FS.hashRemoveNode(node);
      },
      isRoot(node) {
        return node === node.parent;
      },
      isMountpoint(node) {
        return !!node.mounted;
      },
      isFile(mode) {
        return (mode & 61440) === 32768;
      },
      isDir(mode) {
        return (mode & 61440) === 16384;
      },
      isLink(mode) {
        return (mode & 61440) === 40960;
      },
      isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
      isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
      isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
      isSocket(mode) {
        return (mode & 49152) === 49152;
      },
      flagsToPermissionString(flag) {
        var perms = ["r", "w", "rw"][flag & 3];
        if (flag & 512) {
          perms += "w";
        }
        return perms;
      },
      nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        if (perms.includes("r") && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes("w") && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes("x") && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
      mayLookup(dir) {
        if (!FS.isDir(dir.mode)) return 54;
        var errCode = FS.nodePermissions(dir, "x");
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
      mayCreate(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {}
        return FS.nodePermissions(dir, "wx");
      },
      mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, "wx");
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },
      mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
      MAX_OPEN_FDS: 4096,
      nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
      getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
      getStream: (fd) => FS.streams[fd],
      createStream(stream, fd = -1) {
        if (!FS.FSStream) {
          FS.FSStream = /** @constructor */ function () {
            this.shared = {};
          };
          FS.FSStream.prototype = {};
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              /** @this {FS.FSStream} */ get() {
                return this.node;
              },
              /** @this {FS.FSStream} */ set(val) {
                this.node = val;
              },
            },
            isRead: {
              /** @this {FS.FSStream} */ get() {
                return (this.flags & 2097155) !== 1;
              },
            },
            isWrite: {
              /** @this {FS.FSStream} */ get() {
                return (this.flags & 2097155) !== 0;
              },
            },
            isAppend: {
              /** @this {FS.FSStream} */ get() {
                return this.flags & 1024;
              },
            },
            flags: {
              /** @this {FS.FSStream} */ get() {
                return this.shared.flags;
              },
              /** @this {FS.FSStream} */ set(val) {
                this.shared.flags = val;
              },
            },
            position: {
              /** @this {FS.FSStream} */ get() {
                return this.shared.position;
              },
              /** @this {FS.FSStream} */ set(val) {
                this.shared.position = val;
              },
            },
          });
        }
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
      closeStream(fd) {
        FS.streams[fd] = null;
      },
      chrdev_stream_ops: {
        open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;
          stream.stream_ops.open?.(stream);
        },
        llseek() {
          throw new FS.ErrnoError(70);
        },
      },
      major: (dev) => dev >> 8,
      minor: (dev) => dev & 255,
      makedev: (ma, mi) => (ma << 8) | mi,
      registerDevice(dev, ops) {
        FS.devices[dev] = {
          stream_ops: ops,
        };
      },
      getDevice: (dev) => FS.devices[dev],
      getMounts(mount) {
        var mounts = [];
        var check = [mount];
        while (check.length) {
          var m = check.pop();
          mounts.push(m);
          check.push.apply(check, m.mounts);
        }
        return mounts;
      },
      syncfs(populate, callback) {
        if (typeof populate == "function") {
          callback = populate;
          populate = false;
        }
        FS.syncFSRequests++;
        if (FS.syncFSRequests > 1) {
          err(
            `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
          );
        }
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
        function doCallback(errCode) {
          FS.syncFSRequests--;
          return callback(errCode);
        }
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        }
        mounts.forEach((mount) => {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },
      mount(type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false,
          });
          mountpoint = lookup.path;
          node = lookup.node;
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: [],
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          node.mounted = mount;
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
        return mountRoot;
      },
      unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
          follow_mount: false,
        });
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach((hash) => {
          var current = FS.nameTable[hash];
          while (current) {
            var next = current.name_next;
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
            current = next;
          }
        });
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1);
      },
      lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
      mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === "." || name === "..") {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
      create(path, mode) {
        mode = mode !== undefined ? mode : 438;
        /* 0666 */ mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
      mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511;
        /* 0777 */ mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
      mkdirTree(path, mode) {
        var dirs = path.split("/");
        var d = "";
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += "/" + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch (e) {
            if (e.errno != 20) throw e;
          }
        }
      },
      mkdev(path, mode, dev) {
        if (typeof dev == "undefined") {
          dev = mode;
          mode = 438;
        }
        /* 0666 */ mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
      symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, {
          parent: true,
        });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
      rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup, old_dir, new_dir;
        lookup = FS.lookupPath(old_path, {
          parent: true,
        });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, {
          parent: true,
        });
        new_dir = lookup.node;
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(28);
        }
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(55);
        }
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {}
        if (old_node === new_node) {
          return;
        }
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        errCode = new_node
          ? FS.mayDelete(new_dir, new_name, isdir)
          : FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (
          FS.isMountpoint(old_node) ||
          (new_node && FS.isMountpoint(new_node))
        ) {
          throw new FS.ErrnoError(10);
        }
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, "w");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        FS.hashRemoveNode(old_node);
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          FS.hashAddNode(old_node);
        }
      },
      rmdir(path) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
      readdir(path) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },
      unlink(path) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
      readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(
          FS.getPath(link.parent),
          link.node_ops.readlink(link)
        );
      },
      stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow,
        });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },
      lstat(path) {
        return FS.stat(path, true);
      },
      chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow,
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now(),
        });
      },
      lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
      fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.chmod(stream.node, mode);
      },
      chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow,
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now(),
        });
      },
      lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
      fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.chown(stream.node, uid, gid);
      },
      truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == "string") {
          var lookup = FS.lookupPath(path, {
            follow: true,
          });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, "w");
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now(),
        });
      },
      ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },
      utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime),
        });
      },
      open(path, flags, mode) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
        mode = typeof mode == "undefined" ? 438 : /* 0666 */ mode;
        if (flags & 64) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path == "object") {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072),
            });
            node = lookup.node;
          } catch (e) {}
        }
        var created = false;
        if (flags & 64) {
          if (node) {
            if (flags & 128) {
              throw new FS.ErrnoError(20);
            }
          } else {
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        if (flags & 65536 && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        if (flags & 512 && !created) {
          FS.truncate(node, 0);
        }
        flags &= ~(128 | 512 | 131072);
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          ungotten: [],
          error: false,
        });
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module["logReadFiles"] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
          }
        }
        return stream;
      },
      close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null;
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
      isClosed(stream) {
        return stream.fd === null;
      },
      llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
      read(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != "undefined";
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(
          stream,
          buffer,
          offset,
          length,
          position
        );
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
      write(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != "undefined";
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(
          stream,
          buffer,
          offset,
          length,
          position,
          canOwn
        );
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
      allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },
      mmap(stream, length, position, prot, flags) {
        if (
          (prot & 2) !== 0 &&
          (flags & 2) === 0 &&
          (stream.flags & 2097155) !== 2
        ) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
      msync(stream, buffer, offset, length, mmapFlags) {
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(
          stream,
          buffer,
          offset,
          length,
          mmapFlags
        );
      },
      munmap: (stream) => 0,
      ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
      readFile(path, opts = {}) {
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || "binary";
        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
          throw new Error(`Invalid encoding type "${opts.encoding}"`);
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === "utf8") {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === "binary") {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },
      writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == "string") {
          var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error("Unsupported data type");
        }
        FS.close(stream);
      },
      cwd: () => FS.currentPath,
      chdir(path) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, "x");
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
      createDefaultDirectories() {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user");
      },
      createDefaultDevices() {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var randomBuffer = new Uint8Array(1024),
          randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomLeft = randomFill(randomBuffer).byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice("/dev", "random", randomByte);
        FS.createDevice("/dev", "urandom", randomByte);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp");
      },
      createSpecialDirectories() {
        FS.mkdir("/proc");
        var proc_self = FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount(
          {
            mount() {
              var node = FS.createNode(
                proc_self,
                "fd",
                16384 | 511,
                /* 0777 */ 73
              );
              node.node_ops = {
                lookup(parent, name) {
                  var fd = +name;
                  var stream = FS.getStreamChecked(fd);
                  var ret = {
                    parent: null,
                    mount: {
                      mountpoint: "fake",
                    },
                    node_ops: {
                      readlink: () => stream.path,
                    },
                  };
                  ret.parent = ret;
                  return ret;
                },
              };
              return node;
            },
          },
          {},
          "/proc/self/fd"
        );
      },
      createStandardStreams() {
        if (Module["stdin"]) {
          FS.createDevice("/dev", "stdin", Module["stdin"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdin");
        }
        if (Module["stdout"]) {
          FS.createDevice("/dev", "stdout", null, Module["stdout"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdout");
        }
        if (Module["stderr"]) {
          FS.createDevice("/dev", "stderr", null, Module["stderr"]);
        } else {
          FS.symlink("/dev/tty1", "/dev/stderr");
        }
        var stdin = FS.open("/dev/stdin", 0);
        var stdout = FS.open("/dev/stdout", 1);
        var stderr = FS.open("/dev/stderr", 1);
      },
      staticInit() {
        [44].forEach((code) => {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = "<generic error, no stack>";
        });
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
        FS.filesystems = {
          MEMFS: MEMFS,
        };
      },
      init(input, output, error) {
        FS.init.initialized = true;
        Module["stdin"] = input || Module["stdin"];
        Module["stdout"] = output || Module["stdout"];
        Module["stderr"] = error || Module["stderr"];
        FS.createStandardStreams();
      },
      quit() {
        FS.init.initialized = false;
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },
      findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
      analyzePath(path, dontResolveLastLink) {
        try {
          var lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink,
          });
          path = lookup.path;
        } catch (e) {}
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null,
        };
        try {
          var lookup = FS.lookupPath(path, {
            parent: true,
          });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink,
          });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === "/";
        } catch (e) {
          ret.error = e.errno;
        }
        return ret;
      },
      createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {}
          parent = current;
        }
        return current;
      },
      createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(
          typeof parent == "string" ? parent : FS.getPath(parent),
          name
        );
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
      createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == "string" ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data == "string") {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i)
              arr[i] = data.charCodeAt(i);
            data = arr;
          }
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
      },
      createDevice(parent, name, input, output) {
        var path = PATH.join2(
          typeof parent == "string" ? parent : FS.getPath(parent),
          name
        );
        var mode = FS_getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            if (output?.buffer?.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos) {
            /* ignored */ var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset + i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          },
        });
        return FS.mkdev(path, mode, dev);
      },
      forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
          return true;
        if (typeof XMLHttpRequest != "undefined") {
          throw new Error(
            "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
          );
        } else if (read_) {
          try {
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error("Cannot load without read() or XMLHttpRequest.");
        }
      },
      createLazyFile(parent, name, url, canRead, canWrite) {
        /** @constructor */ function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = [];
        }
        LazyUint8Array.prototype.get =
          /** @this{Object} */ function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = (idx / this.chunkSize) | 0;
            return this.getter(chunkNum)[chunkOffset];
          };
        LazyUint8Array.prototype.setDataGetter =
          function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
          };
        LazyUint8Array.prototype.cacheLength =
          function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest();
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (
              !((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304)
            )
              throw new Error(
                "Couldn't load " + url + ". Status: " + xhr.status
              );
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing =
              (header = xhr.getResponseHeader("Accept-Ranges")) &&
              header === "bytes";
            var usesGzip =
              (header = xhr.getResponseHeader("Content-Encoding")) &&
              header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing) chunkSize = datalength;
            var doXHR = (from, to) => {
              if (from > to)
                throw new Error(
                  "invalid range (" +
                    from +
                    ", " +
                    to +
                    ") or no bytes requested!"
                );
              if (to > datalength - 1)
                throw new Error(
                  "only " + datalength + " bytes available! programmer error!"
                );
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              if (datalength !== chunkSize)
                xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
              xhr.responseType = "arraybuffer";
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType("text/plain; charset=x-user-defined");
              }
              xhr.send(null);
              if (
                !((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304)
              )
                throw new Error(
                  "Couldn't load " + url + ". Status: " + xhr.status
                );
              if (xhr.response !== undefined) {
                return new Uint8Array(
                  /** @type{Array<number>} */ (xhr.response || [])
                );
              }
              return intArrayFromString(xhr.responseText || "", true);
            };
            var lazyArray = this;
            lazyArray.setDataGetter((chunkNum) => {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray.chunks[chunkNum] == "undefined") {
                lazyArray.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray.chunks[chunkNum] == "undefined")
                throw new Error("doXHR failed!");
              return lazyArray.chunks[chunkNum];
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out(
                "LazyFiles on gzip forces download of the whole file when length is accessed"
              );
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          };
        if (typeof XMLHttpRequest != "undefined") {
          if (!ENVIRONMENT_IS_WORKER)
            throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: /** @this{Object} */ function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              },
            },
            chunkSize: {
              get: /** @this{Object} */ function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              },
            },
          });
          var properties = {
            isDevice: false,
            contents: lazyArray,
          };
        } else {
          var properties = {
            isDevice: false,
            url: url,
          };
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        Object.defineProperties(node, {
          usedBytes: {
            get: /** @this {FSNode} */ function () {
              return this.contents.length;
            },
          },
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach((key) => {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length) return 0;
          var size = Math.min(contents.length - position, length);
          if (contents.slice) {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position);
        };
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return {
            ptr: ptr,
            allocated: true,
          };
        };
        node.stream_ops = stream_ops;
        return node;
      },
    };

    var SYSCALLS = {
      DEFAULT_POLLMASK: 5,
      calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },
      doStat(func, path, buf) {
        var stat = func(path);
        HEAP32[(buf >>> 2) >>> 0] = stat.dev;
        HEAP32[((buf + 4) >>> 2) >>> 0] = stat.mode;
        HEAPU32[((buf + 8) >>> 2) >>> 0] = stat.nlink;
        HEAP32[((buf + 12) >>> 2) >>> 0] = stat.uid;
        HEAP32[((buf + 16) >>> 2) >>> 0] = stat.gid;
        HEAP32[((buf + 20) >>> 2) >>> 0] = stat.rdev;
        (tempI64 = [
          stat.size >>> 0,
          ((tempDouble = stat.size),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[((buf + 24) >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((buf + 28) >>> 2) >>> 0] = tempI64[1]);
        HEAP32[((buf + 32) >>> 2) >>> 0] = 4096;
        HEAP32[((buf + 36) >>> 2) >>> 0] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        (tempI64 = [
          Math.floor(atime / 1e3) >>> 0,
          ((tempDouble = Math.floor(atime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[((buf + 40) >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((buf + 44) >>> 2) >>> 0] = tempI64[1]);
        HEAPU32[((buf + 48) >>> 2) >>> 0] = (atime % 1e3) * 1e3;
        (tempI64 = [
          Math.floor(mtime / 1e3) >>> 0,
          ((tempDouble = Math.floor(mtime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[((buf + 56) >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((buf + 60) >>> 2) >>> 0] = tempI64[1]);
        HEAPU32[((buf + 64) >>> 2) >>> 0] = (mtime % 1e3) * 1e3;
        (tempI64 = [
          Math.floor(ctime / 1e3) >>> 0,
          ((tempDouble = Math.floor(ctime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[((buf + 72) >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((buf + 76) >>> 2) >>> 0] = tempI64[1]);
        HEAPU32[((buf + 80) >>> 2) >>> 0] = (ctime % 1e3) * 1e3;
        (tempI64 = [
          stat.ino >>> 0,
          ((tempDouble = stat.ino),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[((buf + 88) >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((buf + 92) >>> 2) >>> 0] = tempI64[1]);
        return 0;
      },
      doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          return 0;
        }
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
      varargs: undefined,
      get() {
        var ret = HEAP32[(+SYSCALLS.varargs >>> 2) >>> 0];
        SYSCALLS.varargs += 4;
        return ret;
      },
      getp() {
        return SYSCALLS.get();
      },
      getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
      getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
    };

    function ___syscall_faccessat(dirfd, path, amode, flags) {
      path >>>= 0;
      try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        if (amode & ~7) {
          return -28;
        }
        var lookup = FS.lookupPath(path, {
          follow: true,
        });
        var node = lookup.node;
        if (!node) {
          return -44;
        }
        var perms = "";
        if (amode & 4) perms += "r";
        if (amode & 2) perms += "w";
        if (amode & 1) perms += "x";
        if (
          perms &&
          /* otherwise, they've just passed F_OK */ FS.nodePermissions(
            node,
            perms
          )
        ) {
          return -2;
        }
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_fcntl64(fd, cmd, varargs) {
      varargs >>>= 0;
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (cmd) {
          case 0: {
            var arg = SYSCALLS.get();
            if (arg < 0) {
              return -28;
            }
            while (FS.streams[arg]) {
              arg++;
            }
            var newStream;
            newStream = FS.createStream(stream, arg);
            return newStream.fd;
          }

          case 1:
          case 2:
            return 0;

          case 3:
            return stream.flags;

          case 4: {
            var arg = SYSCALLS.get();
            stream.flags |= arg;
            return 0;
          }

          case 12: {
            var arg = SYSCALLS.getp();
            var offset = 0;
            HEAP16[((arg + offset) >>> 1) >>> 0] = 2;
            return 0;
          }

          case 13:
          case 14:
            return 0;
        }
        return -28;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_fstat64(fd, buf) {
      buf >>>= 0;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        return SYSCALLS.doStat(FS.stat, stream.path, buf);
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_getcwd(buf, size) {
      buf >>>= 0;
      size >>>= 0;
      try {
        if (size === 0) return -28;
        var cwd = FS.cwd();
        var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
        if (size < cwdLengthInBytes) return -68;
        stringToUTF8(cwd, buf, size);
        return cwdLengthInBytes;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_getdents64(fd, dirp, count) {
      dirp >>>= 0;
      count >>>= 0;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        stream.getdents ||= FS.readdir(stream.path);
        var struct_size = 280;
        var pos = 0;
        var off = FS.llseek(stream, 0, 1);
        var idx = Math.floor(off / struct_size);
        while (idx < stream.getdents.length && pos + struct_size <= count) {
          var id;
          var type;
          var name = stream.getdents[idx];
          if (name === ".") {
            id = stream.node.id;
            type = 4;
          } else if (name === "..") {
            var lookup = FS.lookupPath(stream.path, {
              parent: true,
            });
            id = lookup.node.id;
            type = 4;
          } else {
            var child = FS.lookupNode(stream.node, name);
            id = child.id;
            type = FS.isChrdev(child.mode)
              ? 2
              : FS.isDir(child.mode)
              ? 4
              : FS.isLink(child.mode)
              ? 10
              : 8;
          }
          (tempI64 = [
            id >>> 0,
            ((tempDouble = id),
            +Math.abs(tempDouble) >= 1
              ? tempDouble > 0
                ? +Math.floor(tempDouble / 4294967296) >>> 0
                : ~~+Math.ceil(
                    (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                  ) >>> 0
              : 0),
          ]),
            (HEAP32[((dirp + pos) >>> 2) >>> 0] = tempI64[0]),
            (HEAP32[((dirp + pos + 4) >>> 2) >>> 0] = tempI64[1]);
          (tempI64 = [
            ((idx + 1) * struct_size) >>> 0,
            ((tempDouble = (idx + 1) * struct_size),
            +Math.abs(tempDouble) >= 1
              ? tempDouble > 0
                ? +Math.floor(tempDouble / 4294967296) >>> 0
                : ~~+Math.ceil(
                    (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                  ) >>> 0
              : 0),
          ]),
            (HEAP32[((dirp + pos + 8) >>> 2) >>> 0] = tempI64[0]),
            (HEAP32[((dirp + pos + 12) >>> 2) >>> 0] = tempI64[1]);
          HEAP16[((dirp + pos + 16) >>> 1) >>> 0] = 280;
          HEAP8[((dirp + pos + 18) >>> 0) >>> 0] = type;
          stringToUTF8(name, dirp + pos + 19, 256);
          pos += struct_size;
          idx += 1;
        }
        FS.llseek(stream, idx * struct_size, 0);
        return pos;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_ioctl(fd, op, varargs) {
      varargs >>>= 0;
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (op) {
          case 21509: {
            if (!stream.tty) return -59;
            return 0;
          }

          case 21505: {
            if (!stream.tty) return -59;
            if (stream.tty.ops.ioctl_tcgets) {
              var termios = stream.tty.ops.ioctl_tcgets(stream);
              var argp = SYSCALLS.getp();
              HEAP32[(argp >>> 2) >>> 0] = termios.c_iflag || 0;
              HEAP32[((argp + 4) >>> 2) >>> 0] = termios.c_oflag || 0;
              HEAP32[((argp + 8) >>> 2) >>> 0] = termios.c_cflag || 0;
              HEAP32[((argp + 12) >>> 2) >>> 0] = termios.c_lflag || 0;
              for (var i = 0; i < 32; i++) {
                HEAP8[((argp + i + 17) >>> 0) >>> 0] = termios.c_cc[i] || 0;
              }
              return 0;
            }
            return 0;
          }

          case 21510:
          case 21511:
          case 21512: {
            if (!stream.tty) return -59;
            return 0;
          }

          case 21506:
          case 21507:
          case 21508: {
            if (!stream.tty) return -59;
            if (stream.tty.ops.ioctl_tcsets) {
              var argp = SYSCALLS.getp();
              var c_iflag = HEAP32[(argp >>> 2) >>> 0];
              var c_oflag = HEAP32[((argp + 4) >>> 2) >>> 0];
              var c_cflag = HEAP32[((argp + 8) >>> 2) >>> 0];
              var c_lflag = HEAP32[((argp + 12) >>> 2) >>> 0];
              var c_cc = [];
              for (var i = 0; i < 32; i++) {
                c_cc.push(HEAP8[((argp + i + 17) >>> 0) >>> 0]);
              }
              return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                c_iflag: c_iflag,
                c_oflag: c_oflag,
                c_cflag: c_cflag,
                c_lflag: c_lflag,
                c_cc: c_cc,
              });
            }
            return 0;
          }

          case 21519: {
            if (!stream.tty) return -59;
            var argp = SYSCALLS.getp();
            HEAP32[(argp >>> 2) >>> 0] = 0;
            return 0;
          }

          case 21520: {
            if (!stream.tty) return -59;
            return -28;
          }

          case 21531: {
            var argp = SYSCALLS.getp();
            return FS.ioctl(stream, op, argp);
          }

          case 21523: {
            if (!stream.tty) return -59;
            if (stream.tty.ops.ioctl_tiocgwinsz) {
              var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
              var argp = SYSCALLS.getp();
              HEAP16[(argp >>> 1) >>> 0] = winsize[0];
              HEAP16[((argp + 2) >>> 1) >>> 0] = winsize[1];
            }
            return 0;
          }

          case 21524: {
            if (!stream.tty) return -59;
            return 0;
          }

          case 21515: {
            if (!stream.tty) return -59;
            return 0;
          }

          default:
            return -28;
        }
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_lstat64(path, buf) {
      path >>>= 0;
      buf >>>= 0;
      try {
        path = SYSCALLS.getStr(path);
        return SYSCALLS.doStat(FS.lstat, path, buf);
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_newfstatat(dirfd, path, buf, flags) {
      path >>>= 0;
      buf >>>= 0;
      try {
        path = SYSCALLS.getStr(path);
        var nofollow = flags & 256;
        var allowEmpty = flags & 4096;
        flags = flags & ~6400;
        path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
        return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_openat(dirfd, path, flags, varargs) {
      path >>>= 0;
      varargs >>>= 0;
      SYSCALLS.varargs = varargs;
      try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        var mode = varargs ? SYSCALLS.get() : 0;
        return FS.open(path, flags, mode).fd;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
      path >>>= 0;
      buf >>>= 0;
      bufsize >>>= 0;
      try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[(buf + len) >>> 0];
        stringToUTF8(ret, buf, bufsize + 1);
        HEAP8[(buf + len) >>> 0] = endChar;
        return len;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function ___syscall_stat64(path, buf) {
      path >>>= 0;
      buf >>>= 0;
      try {
        path = SYSCALLS.getStr(path);
        return SYSCALLS.doStat(FS.stat, path, buf);
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function __embind_register_bigint(
      primitiveType,
      name,
      size,
      minRange,
      maxRange
    ) {
      primitiveType >>>= 0;
      name >>>= 0;
      size >>>= 0;
    }

    var embind_init_charCodes = () => {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    };

    var embind_charCodes;

    var readLatin1String = (ptr) => {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c >>> 0]) {
        ret += embind_charCodes[HEAPU8[c++ >>> 0]];
      }
      return ret;
    };

    var awaitingDependencies = {};

    var registeredTypes = {};

    var typeDependencies = {};

    var BindingError;

    var throwBindingError = (message) => {
      throw new BindingError(message);
    };

    var InternalError;

    var throwInternalError = (message) => {
      throw new InternalError(message);
    };

    var whenDependentTypesAreResolved = (
      myTypes,
      dependentTypes,
      getTypeConverters
    ) => {
      myTypes.forEach(function (type) {
        typeDependencies[type] = dependentTypes;
      });
      function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
          throwInternalError("Mismatched type converter count");
        }
        for (var i = 0; i < myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      }
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach((dt, i) => {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);
          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }
          awaitingDependencies[dt].push(() => {
            typeConverters[i] = registeredTypes[dt];
            ++registered;
            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      });
      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    };

    /** @param {Object=} options */ function sharedRegisterType(
      rawType,
      registeredInstance,
      options = {}
    ) {
      var name = registeredInstance.name;
      if (!rawType) {
        throwBindingError(
          `type "${name}" must have a positive integer typeid pointer`
        );
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError(`Cannot register type '${name}' twice`);
        }
      }
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach((cb) => cb());
      }
    }

    /** @param {Object=} options */ function registerType(
      rawType,
      registeredInstance,
      options = {}
    ) {
      if (!("argPackAdvance" in registeredInstance)) {
        throw new TypeError(
          "registerType registeredInstance requires argPackAdvance"
        );
      }
      return sharedRegisterType(rawType, registeredInstance, options);
    }

    var GenericWireTypeSize = 8;

    /** @suppress {globalThis} */ function __embind_register_bool(
      rawType,
      name,
      trueValue,
      falseValue
    ) {
      rawType >>>= 0;
      name >>>= 0;
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        fromWireType: function (wt) {
          return !!wt;
        },
        toWireType: function (destructors, o) {
          return o ? trueValue : falseValue;
        },
        argPackAdvance: GenericWireTypeSize,
        readValueFromPointer: function (pointer) {
          return this["fromWireType"](HEAPU8[pointer >>> 0]);
        },
        destructorFunction: null,
      });
    }

    class HandleAllocator {
      constructor() {
        this.allocated = [undefined];
        this.freelist = [];
      }
      get(id) {
        return this.allocated[id];
      }
      has(id) {
        return this.allocated[id] !== undefined;
      }
      allocate(handle) {
        var id = this.freelist.pop() || this.allocated.length;
        this.allocated[id] = handle;
        return id;
      }
      free(id) {
        this.allocated[id] = undefined;
        this.freelist.push(id);
      }
    }

    var emval_handles = new HandleAllocator();

    function __emval_decref(handle) {
      handle >>>= 0;
      if (
        handle >= emval_handles.reserved &&
        0 === --emval_handles.get(handle).refcount
      ) {
        emval_handles.free(handle);
      }
    }

    var count_emval_handles = () => {
      var count = 0;
      for (
        var i = emval_handles.reserved;
        i < emval_handles.allocated.length;
        ++i
      ) {
        if (emval_handles.allocated[i] !== undefined) {
          ++count;
        }
      }
      return count;
    };

    var init_emval = () => {
      emval_handles.allocated.push(
        {
          value: undefined,
        },
        {
          value: null,
        },
        {
          value: true,
        },
        {
          value: false,
        }
      );
      Object.assign(
        emval_handles,
        /** @lends {emval_handles} */ {
          reserved: emval_handles.allocated.length,
        }
      ),
        (Module["count_emval_handles"] = count_emval_handles);
    };

    var Emval = {
      toValue: (handle) => {
        if (!handle) {
          throwBindingError("Cannot use deleted val. handle = " + handle);
        }
        return emval_handles.get(handle).value;
      },
      toHandle: (value) => {
        switch (value) {
          case undefined:
            return 1;

          case null:
            return 2;

          case true:
            return 3;

          case false:
            return 4;

          default: {
            return emval_handles.allocate({
              refcount: 1,
              value: value,
            });
          }
        }
      },
    };

    /** @suppress {globalThis} */ function simpleReadValueFromPointer(pointer) {
      return this["fromWireType"](HEAP32[(pointer >>> 2) >>> 0]);
    }

    var EmValType = {
      name: "emscripten::val",
      fromWireType: (handle) => {
        var rv = Emval.toValue(handle);
        __emval_decref(handle);
        return rv;
      },
      toWireType: (destructors, value) => Emval.toHandle(value),
      argPackAdvance: GenericWireTypeSize,
      readValueFromPointer: simpleReadValueFromPointer,
      destructorFunction: null,
    };

    function __embind_register_emval(rawType) {
      rawType >>>= 0;
      return registerType(rawType, EmValType);
    }

    var floatReadValueFromPointer = (name, width) => {
      switch (width) {
        case 4:
          return function (pointer) {
            return this["fromWireType"](HEAPF32[(pointer >>> 2) >>> 0]);
          };

        case 8:
          return function (pointer) {
            return this["fromWireType"](HEAPF64[(pointer >>> 3) >>> 0]);
          };

        default:
          throw new TypeError(`invalid float width (${width}): ${name}`);
      }
    };

    var __embind_register_float = function (rawType, name, size) {
      rawType >>>= 0;
      name >>>= 0;
      size >>>= 0;
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        fromWireType: (value) => value,
        toWireType: (destructors, value) => value,
        argPackAdvance: GenericWireTypeSize,
        readValueFromPointer: floatReadValueFromPointer(name, size),
        destructorFunction: null,
      });
    };

    var createNamedFunction = (name, body) =>
      Object.defineProperty(body, "name", {
        value: name,
      });

    var runDestructors = (destructors) => {
      while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
      }
    };

    function usesDestructorStack(argTypes) {
      for (var i = 1; i < argTypes.length; ++i) {
        if (
          argTypes[i] !== null &&
          argTypes[i].destructorFunction === undefined
        ) {
          return true;
        }
      }
      return false;
    }

    function newFunc(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
        throw new TypeError(
          `new_ called with constructor type ${typeof constructor} which is not a function`
        );
      }
      /*
       * Previously, the following line was just:
       *   function dummy() {};
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even
       * though at creation, the 'dummy' has the correct constructor name.  Thus,
       * objects created with IMVU.new would show up in the debugger as 'dummy',
       * which isn't very helpful.  Using IMVU.createNamedFunction addresses the
       * issue.  Doublely-unfortunately, there's no way to write a test for this
       * behavior.  -NRD 2013.02.22
       */ var dummy = createNamedFunction(
        constructor.name || "unknownFunctionName",
        function () {}
      );
      dummy.prototype = constructor.prototype;
      var obj = new dummy();
      var r = constructor.apply(obj, argumentList);
      return r instanceof Object ? r : obj;
    }

    function createJsInvoker(argTypes, isClassMethodFunc, returns, isAsync) {
      var needsDestructorStack = usesDestructorStack(argTypes);
      var argCount = argTypes.length;
      var argsList = "";
      var argsListWired = "";
      for (var i = 0; i < argCount - 2; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
      }
      var invokerFnBody = `\n        return function (${argsList}) {\n        if (arguments.length !== ${
        argCount - 2
      }) {\n          throwBindingError('function ' + humanName + ' called with ' + arguments.length + ' arguments, expected ${
        argCount - 2
      }');\n        }`;
      if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n";
      }
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = [
        "humanName",
        "throwBindingError",
        "invoker",
        "fn",
        "runDestructors",
        "retType",
        "classParam",
      ];
      if (isClassMethodFunc) {
        invokerFnBody +=
          "var thisWired = classParam['toWireType'](" +
          dtorStack +
          ", this);\n";
      }
      for (var i = 0; i < argCount - 2; ++i) {
        invokerFnBody +=
          "var arg" +
          i +
          "Wired = argType" +
          i +
          "['toWireType'](" +
          dtorStack +
          ", arg" +
          i +
          ");\n";
        args1.push("argType" + i);
      }
      if (isClassMethodFunc) {
        argsListWired =
          "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
      invokerFnBody +=
        (returns || isAsync ? "var rv = " : "") +
        "invoker(fn" +
        (argsListWired.length > 0 ? ", " : "") +
        argsListWired +
        ");\n";
      if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
      } else {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
          var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
          if (argTypes[i].destructorFunction !== null) {
            invokerFnBody += paramName + "_dtor(" + paramName + ");\n";
            args1.push(paramName + "_dtor");
          }
        }
      }
      if (returns) {
        invokerFnBody +=
          "var ret = retType['fromWireType'](rv);\n" + "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
      return [args1, invokerFnBody];
    }

    function craftInvokerFunction(
      humanName,
      argTypes,
      classType,
      cppInvokerFunc,
      cppTargetFunc,
      /** boolean= */ isAsync
    ) {
      var argCount = argTypes.length;
      if (argCount < 2) {
        throwBindingError(
          "argTypes array size mismatch! Must at least get return value and 'this' types!"
        );
      }
      var isClassMethodFunc = argTypes[1] !== null && classType !== null;
      var needsDestructorStack = usesDestructorStack(argTypes);
      var returns = argTypes[0].name !== "void";
      var closureArgs = [
        humanName,
        throwBindingError,
        cppInvokerFunc,
        cppTargetFunc,
        runDestructors,
        argTypes[0],
        argTypes[1],
      ];
      for (var i = 0; i < argCount - 2; ++i) {
        closureArgs.push(argTypes[i + 2]);
      }
      if (!needsDestructorStack) {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
          if (argTypes[i].destructorFunction !== null) {
            closureArgs.push(argTypes[i].destructorFunction);
          }
        }
      }
      let [args, invokerFnBody] = createJsInvoker(
        argTypes,
        isClassMethodFunc,
        returns,
        isAsync
      );
      args.push(invokerFnBody);
      var invokerFn = newFunc(Function, args).apply(null, closureArgs);
      return createNamedFunction(humanName, invokerFn);
    }

    var ensureOverloadTable = (proto, methodName, humanName) => {
      if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        proto[methodName] = function () {
          if (
            !proto[methodName].overloadTable.hasOwnProperty(arguments.length)
          ) {
            throwBindingError(
              `Function '${humanName}' called with an invalid number of arguments (${arguments.length}) - expects one of (${proto[methodName].overloadTable})!`
            );
          }
          return proto[methodName].overloadTable[arguments.length].apply(
            this,
            arguments
          );
        };
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    };

    /** @param {number=} numArguments */ var exposePublicSymbol = (
      name,
      value,
      numArguments
    ) => {
      if (Module.hasOwnProperty(name)) {
        if (
          undefined === numArguments ||
          (undefined !== Module[name].overloadTable &&
            undefined !== Module[name].overloadTable[numArguments])
        ) {
          throwBindingError(`Cannot register public name '${name}' twice`);
        }
        ensureOverloadTable(Module, name, name);
        if (Module.hasOwnProperty(numArguments)) {
          throwBindingError(
            `Cannot register multiple overloads of a function with the same number of arguments (${numArguments})!`
          );
        }
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        if (undefined !== numArguments) {
          Module[name].numArguments = numArguments;
        }
      }
    };

    var heap32VectorToArray = (count, firstElement) => {
      var array = [];
      for (var i = 0; i < count; i++) {
        array.push(HEAPU32[((firstElement + i * 4) >>> 2) >>> 0]);
      }
      return array;
    };

    /** @param {number=} numArguments */ var replacePublicSymbol = (
      name,
      value,
      numArguments
    ) => {
      if (!Module.hasOwnProperty(name)) {
        throwInternalError("Replacing nonexistant public symbol");
      }
      if (
        undefined !== Module[name].overloadTable &&
        undefined !== numArguments
      ) {
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    };

    var getDynCaller = (sig, ptr) => {
      var argCache = [];
      return function () {
        argCache.length = 0;
        Object.assign(argCache, arguments);
        return dynCall(sig, ptr, argCache);
      };
    };

    var embind__requireFunction = (signature, rawFunction) => {
      signature = readLatin1String(signature);
      function makeDynCaller() {
        if (signature.includes("j")) {
          return getDynCaller(signature, rawFunction);
        }
        return getWasmTableEntry(rawFunction);
      }
      var fp = makeDynCaller();
      if (typeof fp != "function") {
        throwBindingError(
          `unknown function pointer with signature ${signature}: ${rawFunction}`
        );
      }
      return fp;
    };

    var extendError = (baseErrorType, errorName) => {
      var errorClass = createNamedFunction(errorName, function (message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;
        if (stack !== undefined) {
          this.stack =
            this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
        }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function () {
        if (this.message === undefined) {
          return this.name;
        } else {
          return `${this.name}: ${this.message}`;
        }
      };
      return errorClass;
    };

    var UnboundTypeError;

    var getTypeName = (type) => {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    };

    var throwUnboundTypeError = (message, types) => {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
        if (seen[type]) {
          return;
        }
        if (registeredTypes[type]) {
          return;
        }
        if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit);
          return;
        }
        unboundTypes.push(type);
        seen[type] = true;
      }
      types.forEach(visit);
      throw new UnboundTypeError(
        `${message}: ` + unboundTypes.map(getTypeName).join([", "])
      );
    };

    var getFunctionName = (signature) => {
      signature = signature.trim();
      const argsIndex = signature.indexOf("(");
      if (argsIndex !== -1) {
        return signature.substr(0, argsIndex);
      } else {
        return signature;
      }
    };

    function __embind_register_function(
      name,
      argCount,
      rawArgTypesAddr,
      signature,
      rawInvoker,
      fn,
      isAsync
    ) {
      name >>>= 0;
      rawArgTypesAddr >>>= 0;
      signature >>>= 0;
      rawInvoker >>>= 0;
      fn >>>= 0;
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
      name = getFunctionName(name);
      rawInvoker = embind__requireFunction(signature, rawInvoker);
      exposePublicSymbol(
        name,
        function () {
          throwUnboundTypeError(
            `Cannot call ${name} due to unbound types`,
            argTypes
          );
        },
        argCount - 1
      );
      whenDependentTypesAreResolved([], argTypes, function (argTypes) {
        var invokerArgsArray = [argTypes[0], /* return value */ null].concat(
          /* no class 'this'*/ argTypes.slice(1)
        );
        /* actual params */ replacePublicSymbol(
          name,
          craftInvokerFunction(
            name,
            invokerArgsArray,
            null,
            /* no class 'this'*/ rawInvoker,
            fn,
            isAsync
          ),
          argCount - 1
        );
        return [];
      });
    }

    var integerReadValueFromPointer = (name, width, signed) => {
      switch (width) {
        case 1:
          return signed
            ? (pointer) => HEAP8[(pointer >>> 0) >>> 0]
            : (pointer) => HEAPU8[(pointer >>> 0) >>> 0];

        case 2:
          return signed
            ? (pointer) => HEAP16[(pointer >>> 1) >>> 0]
            : (pointer) => HEAPU16[(pointer >>> 1) >>> 0];

        case 4:
          return signed
            ? (pointer) => HEAP32[(pointer >>> 2) >>> 0]
            : (pointer) => HEAPU32[(pointer >>> 2) >>> 0];

        default:
          throw new TypeError(`invalid integer width (${width}): ${name}`);
      }
    };

    /** @suppress {globalThis} */ function __embind_register_integer(
      primitiveType,
      name,
      size,
      minRange,
      maxRange
    ) {
      primitiveType >>>= 0;
      name >>>= 0;
      size >>>= 0;
      name = readLatin1String(name);
      if (maxRange === -1) {
        maxRange = 4294967295;
      }
      var fromWireType = (value) => value;
      if (minRange === 0) {
        var bitshift = 32 - 8 * size;
        fromWireType = (value) => (value << bitshift) >>> bitshift;
      }
      var isUnsignedType = name.includes("unsigned");
      var checkAssertions = (value, toTypeName) => {};
      var toWireType;
      if (isUnsignedType) {
        toWireType = function (destructors, value) {
          checkAssertions(value, this.name);
          return value >>> 0;
        };
      } else {
        toWireType = function (destructors, value) {
          checkAssertions(value, this.name);
          return value;
        };
      }
      registerType(primitiveType, {
        name: name,
        fromWireType: fromWireType,
        toWireType: toWireType,
        argPackAdvance: GenericWireTypeSize,
        readValueFromPointer: integerReadValueFromPointer(
          name,
          size,
          minRange !== 0
        ),
        destructorFunction: null,
      });
    }

    function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      rawType >>>= 0;
      name >>>= 0;
      var typeMapping = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
      ];
      var TA = typeMapping[dataTypeIndex];
      function decodeMemoryView(handle) {
        var size = HEAPU32[(handle >>> 2) >>> 0];
        var data = HEAPU32[((handle + 4) >>> 2) >>> 0];
        return new TA(HEAP8.buffer, data, size);
      }
      name = readLatin1String(name);
      registerType(
        rawType,
        {
          name: name,
          fromWireType: decodeMemoryView,
          argPackAdvance: GenericWireTypeSize,
          readValueFromPointer: decodeMemoryView,
        },
        {
          ignoreDuplicateRegistrations: true,
        }
      );
    }

    /** @suppress {globalThis} */ function readPointer(pointer) {
      return this["fromWireType"](HEAPU32[(pointer >>> 2) >>> 0]);
    }

    function __embind_register_std_string(rawType, name) {
      rawType >>>= 0;
      name >>>= 0;
      name = readLatin1String(name);
      var stdStringIsUTF8 = name === "std::string";
      registerType(rawType, {
        name: name,
        fromWireType(value) {
          var length = HEAPU32[(value >>> 2) >>> 0];
          var payload = value + 4;
          var str;
          if (stdStringIsUTF8) {
            var decodeStartPtr = payload;
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = payload + i;
              if (i == length || HEAPU8[currentBytePtr >>> 0] == 0) {
                var maxRead = currentBytePtr - decodeStartPtr;
                var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                if (str === undefined) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + 1;
              }
            }
          } else {
            var a = new Array(length);
            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAPU8[(payload + i) >>> 0]);
            }
            str = a.join("");
          }
          _free(value);
          return str;
        },
        toWireType(destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }
          var length;
          var valueIsOfTypeString = typeof value == "string";
          if (
            !(
              valueIsOfTypeString ||
              value instanceof Uint8Array ||
              value instanceof Uint8ClampedArray ||
              value instanceof Int8Array
            )
          ) {
            throwBindingError("Cannot pass non-string to std::string");
          }
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            length = lengthBytesUTF8(value);
          } else {
            length = value.length;
          }
          var base = _malloc(4 + length + 1);
          var ptr = base + 4;
          HEAPU32[(base >>> 2) >>> 0] = length;
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            stringToUTF8(value, ptr, length + 1);
          } else {
            if (valueIsOfTypeString) {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);
                if (charCode > 255) {
                  _free(ptr);
                  throwBindingError(
                    "String has UTF-16 code units that do not fit in 8 bits"
                  );
                }
                HEAPU8[(ptr + i) >>> 0] = charCode;
              }
            } else {
              for (var i = 0; i < length; ++i) {
                HEAPU8[(ptr + i) >>> 0] = value[i];
              }
            }
          }
          if (destructors !== null) {
            destructors.push(_free, base);
          }
          return base;
        },
        argPackAdvance: GenericWireTypeSize,
        readValueFromPointer: readPointer,
        destructorFunction(ptr) {
          _free(ptr);
        },
      });
    }

    var UTF16Decoder =
      typeof TextDecoder != "undefined"
        ? new TextDecoder("utf-16le")
        : undefined;

    var UTF16ToString = (ptr, maxBytesToRead) => {
      var endPtr = ptr;
      var idx = endPtr >> 1;
      var maxIdx = idx + maxBytesToRead / 2;
      while (!(idx >= maxIdx) && HEAPU16[idx >>> 0]) ++idx;
      endPtr = idx << 1;
      if (endPtr - ptr > 32 && UTF16Decoder)
        return UTF16Decoder.decode(HEAPU8.subarray(ptr >>> 0, endPtr >>> 0));
      var str = "";
      for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
        var codeUnit = HEAP16[((ptr + i * 2) >>> 1) >>> 0];
        if (codeUnit == 0) break;
        str += String.fromCharCode(codeUnit);
      }
      return str;
    };

    var stringToUTF16 = (str, outPtr, maxBytesToWrite) => {
      maxBytesToWrite ??= 2147483647;
      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2;
      var startPtr = outPtr;
      var numCharsToWrite =
        maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
      for (var i = 0; i < numCharsToWrite; ++i) {
        var codeUnit = str.charCodeAt(i);
        HEAP16[(outPtr >>> 1) >>> 0] = codeUnit;
        outPtr += 2;
      }
      HEAP16[(outPtr >>> 1) >>> 0] = 0;
      return outPtr - startPtr;
    };

    var lengthBytesUTF16 = (str) => str.length * 2;

    var UTF32ToString = (ptr, maxBytesToRead) => {
      var i = 0;
      var str = "";
      while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[((ptr + i * 4) >>> 2) >>> 0];
        if (utf32 == 0) break;
        ++i;
        if (utf32 >= 65536) {
          var ch = utf32 - 65536;
          str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
        } else {
          str += String.fromCharCode(utf32);
        }
      }
      return str;
    };

    var stringToUTF32 = (str, outPtr, maxBytesToWrite) => {
      outPtr >>>= 0;
      maxBytesToWrite ??= 2147483647;
      if (maxBytesToWrite < 4) return 0;
      var startPtr = outPtr;
      var endPtr = startPtr + maxBytesToWrite - 4;
      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) {
          var trailSurrogate = str.charCodeAt(++i);
          codeUnit =
            (65536 + ((codeUnit & 1023) << 10)) | (trailSurrogate & 1023);
        }
        HEAP32[(outPtr >>> 2) >>> 0] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
      }
      HEAP32[(outPtr >>> 2) >>> 0] = 0;
      return outPtr - startPtr;
    };

    var lengthBytesUTF32 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
        len += 4;
      }
      return len;
    };

    var __embind_register_std_wstring = function (rawType, charSize, name) {
      rawType >>>= 0;
      charSize >>>= 0;
      name >>>= 0;
      name = readLatin1String(name);
      var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
      if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
        getHeap = () => HEAPU16;
        shift = 1;
      } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
        getHeap = () => HEAPU32;
        shift = 2;
      }
      registerType(rawType, {
        name: name,
        fromWireType: (value) => {
          var length = HEAPU32[(value >>> 2) >>> 0];
          var HEAP = getHeap();
          var str;
          var decodeStartPtr = value + 4;
          for (var i = 0; i <= length; ++i) {
            var currentBytePtr = value + 4 + i * charSize;
            if (i == length || HEAP[currentBytePtr >>> shift] == 0) {
              var maxReadBytes = currentBytePtr - decodeStartPtr;
              var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
              if (str === undefined) {
                str = stringSegment;
              } else {
                str += String.fromCharCode(0);
                str += stringSegment;
              }
              decodeStartPtr = currentBytePtr + charSize;
            }
          }
          _free(value);
          return str;
        },
        toWireType: (destructors, value) => {
          if (!(typeof value == "string")) {
            throwBindingError(
              `Cannot pass non-string to C++ string type ${name}`
            );
          }
          var length = lengthBytesUTF(value);
          var ptr = _malloc(4 + length + charSize);
          HEAPU32[(ptr >>> 2) >>> 0] = length >> shift;
          encodeString(value, ptr + 4, length + charSize);
          if (destructors !== null) {
            destructors.push(_free, ptr);
          }
          return ptr;
        },
        argPackAdvance: GenericWireTypeSize,
        readValueFromPointer: simpleReadValueFromPointer,
        destructorFunction(ptr) {
          _free(ptr);
        },
      });
    };

    var __embind_register_void = function (rawType, name) {
      rawType >>>= 0;
      name >>>= 0;
      name = readLatin1String(name);
      registerType(rawType, {
        isVoid: true,
        name: name,
        argPackAdvance: 0,
        fromWireType: () => undefined,
        toWireType: (destructors, o) => undefined,
      });
    };

    var nowIsMonotonic = 1;

    var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

    var __emscripten_throw_longjmp = () => {
      throw Infinity;
    };

    var requireRegisteredType = (rawType, humanName) => {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
        throwBindingError(
          humanName + " has unknown type " + getTypeName(rawType)
        );
      }
      return impl;
    };

    var emval_returnValue = (returnType, destructorsRef, handle) => {
      var destructors = [];
      var result = returnType["toWireType"](destructors, handle);
      if (destructors.length) {
        HEAPU32[(destructorsRef >>> 2) >>> 0] = Emval.toHandle(destructors);
      }
      return result;
    };

    function __emval_as(handle, returnType, destructorsRef) {
      handle >>>= 0;
      returnType >>>= 0;
      destructorsRef >>>= 0;
      handle = Emval.toValue(handle);
      returnType = requireRegisteredType(returnType, "emval::as");
      return emval_returnValue(returnType, destructorsRef, handle);
    }

    var emval_symbols = {};

    var getStringOrSymbol = (address) => {
      var symbol = emval_symbols[address];
      if (symbol === undefined) {
        return readLatin1String(address);
      }
      return symbol;
    };

    var emval_methodCallers = [];

    function __emval_call_method(
      caller,
      objHandle,
      methodName,
      destructorsRef,
      args
    ) {
      caller >>>= 0;
      objHandle >>>= 0;
      methodName >>>= 0;
      destructorsRef >>>= 0;
      args >>>= 0;
      caller = emval_methodCallers[caller];
      objHandle = Emval.toValue(objHandle);
      methodName = getStringOrSymbol(methodName);
      return caller(objHandle, objHandle[methodName], destructorsRef, args);
    }

    var emval_get_global = () => {
      if (typeof globalThis == "object") {
        return globalThis;
      }
      return (function () {
        return Function;
      })()("return this")();
    };

    function __emval_get_global(name) {
      name >>>= 0;
      if (name === 0) {
        return Emval.toHandle(emval_get_global());
      } else {
        name = getStringOrSymbol(name);
        return Emval.toHandle(emval_get_global()[name]);
      }
    }

    var emval_addMethodCaller = (caller) => {
      var id = emval_methodCallers.length;
      emval_methodCallers.push(caller);
      return id;
    };

    var emval_lookupTypes = (argCount, argTypes) => {
      var a = new Array(argCount);
      for (var i = 0; i < argCount; ++i) {
        a[i] = requireRegisteredType(
          HEAPU32[((argTypes + i * 4) >>> 2) >>> 0],
          "parameter " + i
        );
      }
      return a;
    };

    var reflectConstruct = Reflect.construct;

    function __emval_get_method_caller(argCount, argTypes, kind) {
      argTypes >>>= 0;
      var types = emval_lookupTypes(argCount, argTypes);
      var retType = types.shift();
      argCount--;
      var functionBody = `return function (obj, func, destructorsRef, args) {\n`;
      var offset = 0;
      var argsList = [];
      if (kind === /* FUNCTION */ 0) {
        argsList.push("obj");
      }
      var params = ["retType"];
      var args = [retType];
      for (var i = 0; i < argCount; ++i) {
        argsList.push("arg" + i);
        params.push("argType" + i);
        args.push(types[i]);
        functionBody += `  var arg${i} = argType${i}.readValueFromPointer(args${
          offset ? "+" + offset : ""
        });\n`;
        offset += types[i]["argPackAdvance"];
      }
      var invoker = kind === /* CONSTRUCTOR */ 1 ? "new func" : "func.call";
      functionBody += `  var rv = ${invoker}(${argsList.join(", ")});\n`;
      if (!retType.isVoid) {
        params.push("emval_returnValue");
        args.push(emval_returnValue);
        functionBody +=
          "  return emval_returnValue(retType, destructorsRef, rv);\n";
      }
      functionBody += "};\n";
      params.push(functionBody);
      var invokerFunction = newFunc(Function, params).apply(null, args);
      var functionName = `methodCaller<(${types
        .map((t) => t.name)
        .join(", ")}) => ${retType.name}>`;
      return emval_addMethodCaller(
        createNamedFunction(functionName, invokerFunction)
      );
    }

    function __emval_get_property(handle, key) {
      handle >>>= 0;
      key >>>= 0;
      handle = Emval.toValue(handle);
      key = Emval.toValue(key);
      return Emval.toHandle(handle[key]);
    }

    function __emval_incref(handle) {
      handle >>>= 0;
      if (handle > 4) {
        emval_handles.get(handle).refcount += 1;
      }
    }

    function __emval_instanceof(object, constructor) {
      object >>>= 0;
      constructor >>>= 0;
      object = Emval.toValue(object);
      constructor = Emval.toValue(constructor);
      return object instanceof constructor;
    }

    function __emval_new_array() {
      return Emval.toHandle([]);
    }

    function __emval_new_cstring(v) {
      v >>>= 0;
      return Emval.toHandle(getStringOrSymbol(v));
    }

    function __emval_run_destructors(handle) {
      handle >>>= 0;
      var destructors = Emval.toValue(handle);
      runDestructors(destructors);
      __emval_decref(handle);
    }

    function __emval_take_value(type, arg) {
      type >>>= 0;
      arg >>>= 0;
      type = requireRegisteredType(type, "_emval_take_value");
      var v = type["readValueFromPointer"](arg);
      return Emval.toHandle(v);
    }

    function __mmap_js(
      len,
      prot,
      flags,
      fd,
      offset_low,
      offset_high,
      allocated,
      addr
    ) {
      len >>>= 0;
      var offset = convertI32PairToI53Checked(offset_low, offset_high);
      allocated >>>= 0;
      addr >>>= 0;
      try {
        if (isNaN(offset)) return 61;
        var stream = SYSCALLS.getStreamFromFD(fd);
        var res = FS.mmap(stream, len, offset, prot, flags);
        var ptr = res.ptr;
        HEAP32[(allocated >>> 2) >>> 0] = res.allocated;
        HEAPU32[(addr >>> 2) >>> 0] = ptr;
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    function __munmap_js(addr, len, prot, flags, fd, offset_low, offset_high) {
      addr >>>= 0;
      len >>>= 0;
      var offset = convertI32PairToI53Checked(offset_low, offset_high);
      try {
        if (isNaN(offset)) return 61;
        var stream = SYSCALLS.getStreamFromFD(fd);
        if (prot & 2) {
          SYSCALLS.doMsync(addr, stream, len, flags, offset);
        }
        FS.munmap(stream);
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno;
      }
    }

    var _abort = () => {
      abort("");
    };

    var _emscripten_set_main_loop_timing = (mode, value) => {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
      if (!Browser.mainLoop.func) {
        return 1;
      }
      if (!Browser.mainLoop.running) {
        Browser.mainLoop.running = true;
      }
      if (mode == 0) {
        Browser.mainLoop.scheduler =
          function Browser_mainLoop_scheduler_setTimeout() {
            var timeUntilNextTick =
              Math.max(
                0,
                Browser.mainLoop.tickStartTime + value - _emscripten_get_now()
              ) | 0;
            setTimeout(Browser.mainLoop.runner, timeUntilNextTick);
          };
        Browser.mainLoop.method = "timeout";
      } else if (mode == 1) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = "rAF";
      } else if (mode == 2) {
        if (typeof Browser.setImmediate == "undefined") {
          if (typeof setImmediate == "undefined") {
            var setImmediates = [];
            var emscriptenMainLoopMessageId = "setimmediate";
            /** @param {Event} event */ var Browser_setImmediate_messageHandler =
              (event) => {
                if (
                  event.data === emscriptenMainLoopMessageId ||
                  event.data.target === emscriptenMainLoopMessageId
                ) {
                  event.stopPropagation();
                  setImmediates.shift()();
                }
              };
            addEventListener(
              "message",
              Browser_setImmediate_messageHandler,
              true
            );
            Browser.setImmediate =
              /** @type{function(function(): ?, ...?): number} */ (
                function Browser_emulated_setImmediate(func) {
                  setImmediates.push(func);
                  if (ENVIRONMENT_IS_WORKER) {
                    if (Module["setImmediates"] === undefined)
                      Module["setImmediates"] = [];
                    Module["setImmediates"].push(func);
                    postMessage({
                      target: emscriptenMainLoopMessageId,
                    });
                  } else postMessage(emscriptenMainLoopMessageId, "*");
                }
              );
          } else {
            Browser.setImmediate = setImmediate;
          }
        }
        Browser.mainLoop.scheduler =
          function Browser_mainLoop_scheduler_setImmediate() {
            Browser.setImmediate(Browser.mainLoop.runner);
          };
        Browser.mainLoop.method = "immediate";
      }
      return 0;
    };

    var _emscripten_get_now;

    _emscripten_get_now = () => performance.now();

    /**
     * @param {number=} arg
     * @param {boolean=} noSetTiming
     */ var setMainLoop = (
      browserIterationFunc,
      fps,
      simulateInfiniteLoop,
      arg,
      noSetTiming
    ) => {
      assert(
        !Browser.mainLoop.func,
        "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters."
      );
      Browser.mainLoop.func = browserIterationFunc;
      Browser.mainLoop.arg = arg;
      /** @type{number} */ var thisMainLoopId = (() =>
        Browser.mainLoop.currentlyRunningMainloop)();
      function checkIsRunning() {
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) {
          return false;
        }
        return true;
      }
      Browser.mainLoop.running = false;
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next =
              remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              next = next + 0.5;
              Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
            }
          }
          Browser.mainLoop.updateStatus();
          if (!checkIsRunning()) return;
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
        if (!checkIsRunning()) return;
        Browser.mainLoop.currentFrameNumber =
          (Browser.mainLoop.currentFrameNumber + 1) | 0;
        if (
          Browser.mainLoop.timingMode == 1 &&
          Browser.mainLoop.timingValue > 1 &&
          Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue !=
            0
        ) {
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
        GL.newRenderingFrameStarted();
        Browser.mainLoop.runIter(browserIterationFunc);
        if (!checkIsRunning()) return;
        if (typeof SDL == "object") SDL.audio?.queueNewAudioData?.();
        Browser.mainLoop.scheduler();
      };
      if (!noSetTiming) {
        if (fps && fps > 0) {
          _emscripten_set_main_loop_timing(0, 1e3 / fps);
        } else {
          _emscripten_set_main_loop_timing(1, 1);
        }
        Browser.mainLoop.scheduler();
      }
      if (simulateInfiniteLoop) {
        throw "unwind";
      }
    };

    var handleException = (e) => {
      if (e instanceof ExitStatus || e == "unwind") {
        return EXITSTATUS;
      }
      quit_(1, e);
    };

    var runtimeKeepaliveCounter = 0;

    var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

    var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        Module["onExit"]?.(code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };

    /** @param {boolean|number=} implicit */ var exitJS = (
      status,
      implicit
    ) => {
      EXITSTATUS = status;
      _proc_exit(status);
    };

    var _exit = exitJS;

    var maybeExit = () => {
      if (!keepRuntimeAlive()) {
        try {
          _exit(EXITSTATUS);
        } catch (e) {
          handleException(e);
        }
      }
    };

    var callUserCallback = (func) => {
      if (ABORT) {
        return;
      }
      try {
        func();
        maybeExit();
      } catch (e) {
        handleException(e);
      }
    };

    /** @param {number=} timeout */ var safeSetTimeout = (func, timeout) =>
      setTimeout(() => {
        callUserCallback(func);
      }, timeout);

    var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
        err(text);
      }
    };

    var Browser = {
      mainLoop: {
        running: false,
        scheduler: null,
        method: "",
        currentlyRunningMainloop: 0,
        func: null,
        arg: 0,
        timingMode: 0,
        timingValue: 0,
        currentFrameNumber: 0,
        queue: [],
        pause() {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++;
        },
        resume() {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          setMainLoop(func, 0, false, Browser.mainLoop.arg, true);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },
        updateStatus() {
          if (Module["setStatus"]) {
            var message = Module["statusMessage"] || "Please wait...";
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module["setStatus"](
                  message + " (" + (expected - remaining) + "/" + expected + ")"
                );
              } else {
                Module["setStatus"](message);
              }
            } else {
              Module["setStatus"]("");
            }
          }
        },
        runIter(func) {
          if (ABORT) return;
          if (Module["preMainLoop"]) {
            var preRet = Module["preMainLoop"]();
            if (preRet === false) {
              return;
            }
          }
          callUserCallback(func);
          Module["postMainLoop"]?.();
        },
      },
      isFullscreen: false,
      pointerLock: false,
      moduleContextCreatedCallbacks: [],
      workers: [],
      init() {
        if (Browser.initted) return;
        Browser.initted = true;
        var imagePlugin = {};
        imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin["handle"] = function imagePlugin_handle(
          byteArray,
          name,
          onload,
          onerror
        ) {
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name),
          });
          if (b.size !== byteArray.length) {
            b = new Blob([new Uint8Array(byteArray).buffer], {
              type: Browser.getMimetype(name),
            });
          }
          var url = URL.createObjectURL(b);
          var img = new Image();
          img.onload = () => {
            assert(img.complete, `Image ${name} could not be decoded`);
            var canvas = /** @type {!HTMLCanvasElement} */ (
              document.createElement("canvas")
            );
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            preloadedImages[name] = canvas;
            URL.revokeObjectURL(url);
            onload?.(byteArray);
          };
          img.onerror = (event) => {
            err(`Image ${url} could not be decoded`);
            onerror?.();
          };
          img.src = url;
        };
        preloadPlugins.push(imagePlugin);
        var audioPlugin = {};
        audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
          return (
            !Module.noAudioDecoding &&
            name.substr(-4) in
              {
                ".ogg": 1,
                ".wav": 1,
                ".mp3": 1,
              }
          );
        };
        audioPlugin["handle"] = function audioPlugin_handle(
          byteArray,
          name,
          onload,
          onerror
        ) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            preloadedAudios[name] = audio;
            onload?.(byteArray);
          }
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name),
          });
          var url = URL.createObjectURL(b);
          var audio = new Audio();
          audio.addEventListener("canplaythrough", () => finish(audio), false);
          audio.onerror = function audio_onerror(event) {
            if (done) return;
            err(
              `warning: browser could not fully decode audio ${name}, trying slower base64 approach`
            );
            function encode64(data) {
              var BASE =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
              var PAD = "=";
              var ret = "";
              var leftchar = 0;
              var leftbits = 0;
              for (var i = 0; i < data.length; i++) {
                leftchar = (leftchar << 8) | data[i];
                leftbits += 8;
                while (leftbits >= 6) {
                  var curr = (leftchar >> (leftbits - 6)) & 63;
                  leftbits -= 6;
                  ret += BASE[curr];
                }
              }
              if (leftbits == 2) {
                ret += BASE[(leftchar & 3) << 4];
                ret += PAD + PAD;
              } else if (leftbits == 4) {
                ret += BASE[(leftchar & 15) << 2];
                ret += PAD;
              }
              return ret;
            }
            audio.src =
              "data:audio/x-" +
              name.substr(-3) +
              ";base64," +
              encode64(byteArray);
            finish(audio);
          };
          audio.src = url;
          safeSetTimeout(() => {
            finish(audio);
          }, 1e4);
        };
        preloadPlugins.push(audioPlugin);
        function pointerLockChange() {
          Browser.pointerLock =
            document["pointerLockElement"] === Module["canvas"] ||
            document["mozPointerLockElement"] === Module["canvas"] ||
            document["webkitPointerLockElement"] === Module["canvas"] ||
            document["msPointerLockElement"] === Module["canvas"];
        }
        var canvas = Module["canvas"];
        if (canvas) {
          canvas.requestPointerLock =
            canvas["requestPointerLock"] ||
            canvas["mozRequestPointerLock"] ||
            canvas["webkitRequestPointerLock"] ||
            canvas["msRequestPointerLock"] ||
            (() => {});
          canvas.exitPointerLock =
            document["exitPointerLock"] ||
            document["mozExitPointerLock"] ||
            document["webkitExitPointerLock"] ||
            document["msExitPointerLock"] ||
            (() => {});
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
          document.addEventListener(
            "pointerlockchange",
            pointerLockChange,
            false
          );
          document.addEventListener(
            "mozpointerlockchange",
            pointerLockChange,
            false
          );
          document.addEventListener(
            "webkitpointerlockchange",
            pointerLockChange,
            false
          );
          document.addEventListener(
            "mspointerlockchange",
            pointerLockChange,
            false
          );
          if (Module["elementPointerLock"]) {
            canvas.addEventListener(
              "click",
              (ev) => {
                if (
                  !Browser.pointerLock &&
                  Module["canvas"].requestPointerLock
                ) {
                  Module["canvas"].requestPointerLock();
                  ev.preventDefault();
                }
              },
              false
            );
          }
        }
      },
      createContext(
        /** @type {HTMLCanvasElement} */ canvas,
        useWebGL,
        setInModule,
        webGLContextAttributes
      ) {
        if (useWebGL && Module.ctx && canvas == Module.canvas)
          return Module.ctx;
        var ctx;
        var contextHandle;
        if (useWebGL) {
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 2,
          };
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
          if (typeof GL != "undefined") {
            contextHandle = GL.createContext(canvas, contextAttributes);
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx;
            }
          }
        } else {
          ctx = canvas.getContext("2d");
        }
        if (!ctx) return null;
        if (setInModule) {
          if (!useWebGL)
            assert(
              typeof GLctx == "undefined",
              "cannot set in module if GLctx is used, but we are a non-GL context that would replace it"
            );
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach((callback) =>
            callback()
          );
          Browser.init();
        }
        return ctx;
      },
      destroyContext(canvas, useWebGL, setInModule) {},
      fullscreenHandlersInstalled: false,
      lockPointer: undefined,
      resizeCanvas: undefined,
      requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer == "undefined")
          Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas == "undefined")
          Browser.resizeCanvas = false;
        var canvas = Module["canvas"];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if (
            (document["fullscreenElement"] ||
              document["mozFullScreenElement"] ||
              document["msFullscreenElement"] ||
              document["webkitFullscreenElement"] ||
              document["webkitCurrentFullScreenElement"]) === canvasContainer
          ) {
            canvas.exitFullscreen = Browser.exitFullscreen;
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          Module["onFullScreen"]?.(Browser.isFullscreen);
          Module["onFullscreen"]?.(Browser.isFullscreen);
        }
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener(
            "fullscreenchange",
            fullscreenChange,
            false
          );
          document.addEventListener(
            "mozfullscreenchange",
            fullscreenChange,
            false
          );
          document.addEventListener(
            "webkitfullscreenchange",
            fullscreenChange,
            false
          );
          document.addEventListener(
            "MSFullscreenChange",
            fullscreenChange,
            false
          );
        }
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
        canvasContainer.requestFullscreen =
          canvasContainer["requestFullscreen"] ||
          canvasContainer["mozRequestFullScreen"] ||
          canvasContainer["msRequestFullscreen"] ||
          (canvasContainer["webkitRequestFullscreen"]
            ? () =>
                canvasContainer["webkitRequestFullscreen"](
                  Element["ALLOW_KEYBOARD_INPUT"]
                )
            : null) ||
          (canvasContainer["webkitRequestFullScreen"]
            ? () =>
                canvasContainer["webkitRequestFullScreen"](
                  Element["ALLOW_KEYBOARD_INPUT"]
                )
            : null);
        canvasContainer.requestFullscreen();
      },
      exitFullscreen() {
        if (!Browser.isFullscreen) {
          return false;
        }
        var CFS =
          document["exitFullscreen"] ||
          document["cancelFullScreen"] ||
          document["mozCancelFullScreen"] ||
          document["msExitFullscreen"] ||
          document["webkitCancelFullScreen"] ||
          (() => {});
        CFS.apply(document, []);
        return true;
      },
      nextRAF: 0,
      fakeRequestAnimationFrame(func) {
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1e3 / 60;
        } else {
          while (now + 2 >= Browser.nextRAF) {
            Browser.nextRAF += 1e3 / 60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },
      requestAnimationFrame(func) {
        if (typeof requestAnimationFrame == "function") {
          requestAnimationFrame(func);
          return;
        }
        var RAF = Browser.fakeRequestAnimationFrame;
        RAF(func);
      },
      safeSetTimeout(func, timeout) {
        return safeSetTimeout(func, timeout);
      },
      safeRequestAnimationFrame(func) {
        return Browser.requestAnimationFrame(() => {
          callUserCallback(func);
        });
      },
      getMimetype(name) {
        return {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          bmp: "image/bmp",
          ogg: "audio/ogg",
          wav: "audio/wav",
          mp3: "audio/mpeg",
        }[name.substr(name.lastIndexOf(".") + 1)];
      },
      getUserMedia(func) {
        window.getUserMedia ||=
          navigator["getUserMedia"] || navigator["mozGetUserMedia"];
        window.getUserMedia(func);
      },
      getMovementX(event) {
        return (
          event["movementX"] ||
          event["mozMovementX"] ||
          event["webkitMovementX"] ||
          0
        );
      },
      getMovementY(event) {
        return (
          event["movementY"] ||
          event["mozMovementY"] ||
          event["webkitMovementY"] ||
          0
        );
      },
      getMouseWheelDelta(event) {
        var delta = 0;
        switch (event.type) {
          case "DOMMouseScroll":
            delta = event.detail / 3;
            break;

          case "mousewheel":
            delta = event.wheelDelta / 120;
            break;

          case "wheel":
            delta = event.deltaY;
            switch (event.deltaMode) {
              case 0:
                delta /= 100;
                break;

              case 1:
                delta /= 3;
                break;

              case 2:
                delta *= 80;
                break;

              default:
                throw "unrecognized mouse wheel delta mode: " + event.deltaMode;
            }
            break;

          default:
            throw "unrecognized mouse wheel event: " + event.type;
        }
        return delta;
      },
      mouseX: 0,
      mouseY: 0,
      mouseMovementX: 0,
      mouseMovementY: 0,
      touches: {},
      lastTouches: {},
      calculateMouseCoords(pageX, pageY) {
        var rect = Module["canvas"].getBoundingClientRect();
        var cw = Module["canvas"].width;
        var ch = Module["canvas"].height;
        var scrollX =
          typeof window.scrollX != "undefined"
            ? window.scrollX
            : window.pageXOffset;
        var scrollY =
          typeof window.scrollY != "undefined"
            ? window.scrollY
            : window.pageYOffset;
        var adjustedX = pageX - (scrollX + rect.left);
        var adjustedY = pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        return {
          x: adjustedX,
          y: adjustedY,
        };
      },
      setMouseCoords(pageX, pageY) {
        const { x: x, y: y } = Browser.calculateMouseCoords(pageX, pageY);
        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y;
      },
      calculateMouseEvent(event) {
        if (Browser.pointerLock) {
          if (event.type != "mousemove" && "mozMovementX" in event) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }
        } else {
          if (
            event.type === "touchstart" ||
            event.type === "touchend" ||
            event.type === "touchmove"
          ) {
            var touch = event.touch;
            if (touch === undefined) {
              return;
            }
            var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
            if (event.type === "touchstart") {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (
              event.type === "touchend" ||
              event.type === "touchmove"
            ) {
              var last = Browser.touches[touch.identifier];
              last ||= coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
          Browser.setMouseCoords(event.pageX, event.pageY);
        }
      },
      resizeListeners: [],
      updateResizeListeners() {
        var canvas = Module["canvas"];
        Browser.resizeListeners.forEach((listener) =>
          listener(canvas.width, canvas.height)
        );
      },
      setCanvasSize(width, height, noUpdates) {
        var canvas = Module["canvas"];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },
      windowedWidth: 0,
      windowedHeight: 0,
      setFullscreenCanvasSize() {
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[(SDL.screen >>> 2) >>> 0];
          flags = flags | 8388608;
          HEAP32[(SDL.screen >>> 2) >>> 0] = flags;
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners();
      },
      setWindowedCanvasSize() {
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[(SDL.screen >>> 2) >>> 0];
          flags = flags & ~8388608;
          HEAP32[(SDL.screen >>> 2) >>> 0] = flags;
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners();
      },
      updateCanvasDimensions(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
          if (w / h < Module["forcedAspectRatio"]) {
            w = Math.round(h * Module["forcedAspectRatio"]);
          } else {
            h = Math.round(w / Module["forcedAspectRatio"]);
          }
        }
        if (
          (document["fullscreenElement"] ||
            document["mozFullScreenElement"] ||
            document["msFullscreenElement"] ||
            document["webkitFullscreenElement"] ||
            document["webkitCurrentFullScreenElement"]) === canvas.parentNode &&
          typeof screen != "undefined"
        ) {
          var factor = Math.min(screen.width / w, screen.height / h);
          w = Math.round(w * factor);
          h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width != w) canvas.width = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != "undefined") {
            canvas.style.removeProperty("width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width != wNative) canvas.width = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != "undefined") {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty("width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty("width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },
    };

    var EGL = {
      errorCode: 12288,
      defaultDisplayInitialized: false,
      currentContext: 0,
      currentReadSurface: 0,
      currentDrawSurface: 0,
      contextAttributes: {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
      },
      stringCache: {},
      setErrorCode(code) {
        EGL.errorCode = code;
      },
      chooseConfig(display, attribList, config, config_size, numConfigs) {
        if (display != 62e3) {
          EGL.setErrorCode(12296);
          /* EGL_BAD_DISPLAY */ return 0;
        }
        if (attribList) {
          for (;;) {
            var param = HEAP32[(attribList >>> 2) >>> 0];
            if (param == 12321) {
              /*EGL_ALPHA_SIZE*/ var alphaSize =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.alpha = alphaSize > 0;
            } else if (param == 12325) {
              /*EGL_DEPTH_SIZE*/ var depthSize =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.depth = depthSize > 0;
            } else if (param == 12326) {
              /*EGL_STENCIL_SIZE*/ var stencilSize =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.stencil = stencilSize > 0;
            } else if (param == 12337) {
              /*EGL_SAMPLES*/ var samples =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.antialias = samples > 0;
            } else if (param == 12338) {
              /*EGL_SAMPLE_BUFFERS*/ var samples =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.antialias = samples == 1;
            } else if (param == 12544) {
              /*EGL_CONTEXT_PRIORITY_LEVEL_IMG*/ var requestedPriority =
                HEAP32[((attribList + 4) >>> 2) >>> 0];
              EGL.contextAttributes.lowLatency = requestedPriority != 12547;
            } else if (param == 12344) {
              /*EGL_NONE*/ break;
            }
            attribList += 8;
          }
        }
        if ((!config || !config_size) && !numConfigs) {
          EGL.setErrorCode(12300);
          /* EGL_BAD_PARAMETER */ return 0;
        }
        if (numConfigs) {
          HEAP32[(numConfigs >>> 2) >>> 0] = 1;
        }
        if (config && config_size > 0) {
          HEAPU32[(config >>> 2) >>> 0] = 62002;
        }
        EGL.setErrorCode(12288);
        /* EGL_SUCCESS */ return 1;
      },
    };

    var _eglBindAPI = (api) => {
      if (api == 12448) {
        /* EGL_OPENGL_ES_API */ EGL.setErrorCode(12288);
        /* EGL_SUCCESS */ return 1;
      }
      EGL.setErrorCode(12300);
      /* EGL_BAD_PARAMETER */ return 0;
    };

    function _eglChooseConfig(
      display,
      attrib_list,
      configs,
      config_size,
      numConfigs
    ) {
      display >>>= 0;
      attrib_list >>>= 0;
      configs >>>= 0;
      numConfigs >>>= 0;
      return EGL.chooseConfig(
        display,
        attrib_list,
        configs,
        config_size,
        numConfigs
      );
    }

    var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = (ctx) =>
      !!(ctx.dibvbi = ctx.getExtension(
        "WEBGL_draw_instanced_base_vertex_base_instance"
      ));

    var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = (
      ctx
    ) =>
      !!(ctx.mdibvbi = ctx.getExtension(
        "WEBGL_multi_draw_instanced_base_vertex_base_instance"
      ));

    var webgl_enable_WEBGL_multi_draw = (ctx) =>
      !!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

    var getEmscriptenSupportedExtensions = function (ctx) {
      var supportedExtensions = [
        "EXT_color_buffer_float",
        "EXT_disjoint_timer_query_webgl2",
        "EXT_texture_norm16",
        "WEBGL_clip_cull_distance",
        "EXT_color_buffer_half_float",
        "EXT_float_blend",
        "EXT_texture_compression_bptc",
        "EXT_texture_compression_rgtc",
        "EXT_texture_filter_anisotropic",
        "KHR_parallel_shader_compile",
        "OES_texture_float_linear",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_compressed_texture_s3tc_srgb",
        "WEBGL_debug_renderer_info",
        "WEBGL_debug_shaders",
        "WEBGL_lose_context",
        "WEBGL_multi_draw",
      ];
      return (ctx.getSupportedExtensions() || []).filter((ext) =>
        supportedExtensions.includes(ext)
      );
    };

    var GL = {
      counter: 1,
      buffers: [],
      mappedBuffers: {},
      programs: [],
      framebuffers: [],
      renderbuffers: [],
      textures: [],
      shaders: [],
      vaos: [],
      contexts: [],
      offscreenCanvases: {},
      queries: [],
      samplers: [],
      transformFeedbacks: [],
      syncs: [],
      byteSizeByTypeRoot: 5120,
      byteSizeByType: [1, 1, 2, 2, 4, 4, 4, 2, 3, 4, 8],
      stringCache: {},
      stringiCache: {},
      unpackAlignment: 4,
      recordError: function recordError(errorCode) {
        if (!GL.lastError) {
          GL.lastError = errorCode;
        }
      },
      getNewId: (table) => {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
          table[i] = null;
        }
        return ret;
      },
      MAX_TEMP_BUFFER_SIZE: 2097152,
      numTempVertexBuffersPerSize: 64,
      log2ceilLookup: (i) => 32 - Math.clz32(i === 0 ? 0 : i - 1),
      generateTempBuffers: (quads, context) => {
        var largestIndex = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE);
        context.tempVertexBufferCounters1 = [];
        context.tempVertexBufferCounters2 = [];
        context.tempVertexBufferCounters1.length =
          context.tempVertexBufferCounters2.length = largestIndex + 1;
        context.tempVertexBuffers1 = [];
        context.tempVertexBuffers2 = [];
        context.tempVertexBuffers1.length = context.tempVertexBuffers2.length =
          largestIndex + 1;
        context.tempIndexBuffers = [];
        context.tempIndexBuffers.length = largestIndex + 1;
        for (var i = 0; i <= largestIndex; ++i) {
          context.tempIndexBuffers[i] = null;
          context.tempVertexBufferCounters1[i] =
            context.tempVertexBufferCounters2[i] = 0;
          var ringbufferLength = GL.numTempVertexBuffersPerSize;
          context.tempVertexBuffers1[i] = [];
          context.tempVertexBuffers2[i] = [];
          var ringbuffer1 = context.tempVertexBuffers1[i];
          var ringbuffer2 = context.tempVertexBuffers2[i];
          ringbuffer1.length = ringbuffer2.length = ringbufferLength;
          for (var j = 0; j < ringbufferLength; ++j) {
            ringbuffer1[j] = ringbuffer2[j] = null;
          }
        }
        if (quads) {
          context.tempQuadIndexBuffer = GLctx.createBuffer();
          context.GLctx.bindBuffer(
            34963,
            /*GL_ELEMENT_ARRAY_BUFFER*/ context.tempQuadIndexBuffer
          );
          var numIndexes = GL.MAX_TEMP_BUFFER_SIZE >> 1;
          var quadIndexes = new Uint16Array(numIndexes);
          var i = 0,
            v = 0;
          while (1) {
            quadIndexes[i++] = v;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v + 1;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v + 2;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v + 2;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v + 3;
            if (i >= numIndexes) break;
            v += 4;
          }
          context.GLctx.bufferData(
            34963,
            /*GL_ELEMENT_ARRAY_BUFFER*/ quadIndexes,
            35044
          );
          /*GL_STATIC_DRAW*/ context.GLctx.bindBuffer(
            34963,
            /*GL_ELEMENT_ARRAY_BUFFER*/ null
          );
        }
      },
      getTempVertexBuffer: function getTempVertexBuffer(sizeBytes) {
        var idx = GL.log2ceilLookup(sizeBytes);
        var ringbuffer = GL.currentContext.tempVertexBuffers1[idx];
        var nextFreeBufferIndex =
          GL.currentContext.tempVertexBufferCounters1[idx];
        GL.currentContext.tempVertexBufferCounters1[idx] =
          (GL.currentContext.tempVertexBufferCounters1[idx] + 1) &
          (GL.numTempVertexBuffersPerSize - 1);
        var vbo = ringbuffer[nextFreeBufferIndex];
        if (vbo) {
          return vbo;
        }
        var prevVBO = GLctx.getParameter(34964);
        /*GL_ARRAY_BUFFER_BINDING*/ ringbuffer[nextFreeBufferIndex] =
          GLctx.createBuffer();
        GLctx.bindBuffer(
          34962,
          /*GL_ARRAY_BUFFER*/ ringbuffer[nextFreeBufferIndex]
        );
        GLctx.bufferData(34962, /*GL_ARRAY_BUFFER*/ 1 << idx, 35048);
        /*GL_DYNAMIC_DRAW*/ GLctx.bindBuffer(
          34962,
          /*GL_ARRAY_BUFFER*/ prevVBO
        );
        return ringbuffer[nextFreeBufferIndex];
      },
      getTempIndexBuffer: function getTempIndexBuffer(sizeBytes) {
        var idx = GL.log2ceilLookup(sizeBytes);
        var ibo = GL.currentContext.tempIndexBuffers[idx];
        if (ibo) {
          return ibo;
        }
        var prevIBO = GLctx.getParameter(34965);
        /*ELEMENT_ARRAY_BUFFER_BINDING*/ GL.currentContext.tempIndexBuffers[
          idx
        ] = GLctx.createBuffer();
        GLctx.bindBuffer(
          34963,
          /*GL_ELEMENT_ARRAY_BUFFER*/ GL.currentContext.tempIndexBuffers[idx]
        );
        GLctx.bufferData(34963, /*GL_ELEMENT_ARRAY_BUFFER*/ 1 << idx, 35048);
        /*GL_DYNAMIC_DRAW*/ GLctx.bindBuffer(
          34963,
          /*GL_ELEMENT_ARRAY_BUFFER*/ prevIBO
        );
        return GL.currentContext.tempIndexBuffers[idx];
      },
      newRenderingFrameStarted: function newRenderingFrameStarted() {
        if (!GL.currentContext) {
          return;
        }
        var vb = GL.currentContext.tempVertexBuffers1;
        GL.currentContext.tempVertexBuffers1 =
          GL.currentContext.tempVertexBuffers2;
        GL.currentContext.tempVertexBuffers2 = vb;
        vb = GL.currentContext.tempVertexBufferCounters1;
        GL.currentContext.tempVertexBufferCounters1 =
          GL.currentContext.tempVertexBufferCounters2;
        GL.currentContext.tempVertexBufferCounters2 = vb;
        var largestIndex = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE);
        for (var i = 0; i <= largestIndex; ++i) {
          GL.currentContext.tempVertexBufferCounters1[i] = 0;
        }
      },
      getSource: (shader, count, string, length) => {
        var source = "";
        for (var i = 0; i < count; ++i) {
          var len = length
            ? HEAPU32[((length + i * 4) >>> 2) >>> 0]
            : undefined;
          source += UTF8ToString(HEAPU32[((string + i * 4) >>> 2) >>> 0], len);
        }
        return source;
      },
      calcBufLength: function calcBufLength(size, type, stride, count) {
        if (stride > 0) {
          return count * stride;
        }
        var typeSize = GL.byteSizeByType[type - GL.byteSizeByTypeRoot];
        return size * typeSize * count;
      },
      usedTempBuffers: [],
      preDrawHandleClientVertexAttribBindings:
        function preDrawHandleClientVertexAttribBindings(count) {
          GL.resetBufferBinding = false;
          for (var i = 0; i < GL.currentContext.maxVertexAttribs; ++i) {
            var cb = GL.currentContext.clientBuffers[i];
            if (!cb.clientside || !cb.enabled) continue;
            GL.resetBufferBinding = true;
            var size = GL.calcBufLength(cb.size, cb.type, cb.stride, count);
            var buf = GL.getTempVertexBuffer(size);
            GLctx.bindBuffer(34962, /*GL_ARRAY_BUFFER*/ buf);
            GLctx.bufferSubData(
              34962,
              0,
              HEAPU8.subarray(cb.ptr >>> 0, (cb.ptr + size) >>> 0)
            );
            cb.vertexAttribPointerAdaptor.call(
              GLctx,
              i,
              cb.size,
              cb.type,
              cb.normalized,
              cb.stride,
              0
            );
          }
        },
      postDrawHandleClientVertexAttribBindings:
        function postDrawHandleClientVertexAttribBindings() {
          if (GL.resetBufferBinding) {
            GLctx.bindBuffer(
              34962,
              /*GL_ARRAY_BUFFER*/ GL.buffers[GLctx.currentArrayBufferBinding]
            );
          }
        },
      createContext: (
        /** @type {HTMLCanvasElement} */ canvas,
        webGLContextAttributes
      ) => {
        if (!canvas.getContextSafariWebGL2Fixed) {
          canvas.getContextSafariWebGL2Fixed = canvas.getContext;
          /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */ function fixedGetContext(
            ver,
            attrs
          ) {
            var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
            return (ver == "webgl") == gl instanceof WebGLRenderingContext
              ? gl
              : null;
          }
          canvas.getContext = fixedGetContext;
        }
        var ctx = canvas.getContext("webgl2", webGLContextAttributes);
        if (!ctx) return 0;
        var handle = GL.registerContext(ctx, webGLContextAttributes);
        return handle;
      },
      registerContext: (ctx, webGLContextAttributes) => {
        var handle = GL.getNewId(GL.contexts);
        var context = {
          handle: handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes.majorVersion,
          GLctx: ctx,
        };
        if (ctx.canvas) ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (
          typeof webGLContextAttributes.enableExtensionsByDefault ==
            "undefined" ||
          webGLContextAttributes.enableExtensionsByDefault
        ) {
          GL.initExtensions(context);
        }
        context.maxVertexAttribs = context.GLctx.getParameter(34921);
        /*GL_MAX_VERTEX_ATTRIBS*/ context.clientBuffers = [];
        for (var i = 0; i < context.maxVertexAttribs; i++) {
          context.clientBuffers[i] = {
            enabled: false,
            clientside: false,
            size: 0,
            type: 0,
            normalized: 0,
            stride: 0,
            ptr: 0,
            vertexAttribPointerAdaptor: null,
          };
        }
        GL.generateTempBuffers(false, context);
        return handle;
      },
      makeContextCurrent: (contextHandle) => {
        GL.currentContext = GL.contexts[contextHandle];
        Module.ctx = GLctx = GL.currentContext?.GLctx;
        return !(contextHandle && !GLctx);
      },
      getContext: (contextHandle) => GL.contexts[contextHandle],
      deleteContext: (contextHandle) => {
        if (GL.currentContext === GL.contexts[contextHandle]) {
          GL.currentContext = null;
        }
        if (typeof JSEvents == "object") {
          JSEvents.removeAllHandlersOnTarget(
            GL.contexts[contextHandle].GLctx.canvas
          );
        }
        if (
          GL.contexts[contextHandle] &&
          GL.contexts[contextHandle].GLctx.canvas
        ) {
          GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
        }
        GL.contexts[contextHandle] = null;
      },
      initExtensions: (context) => {
        context ||= GL.currentContext;
        if (context.initExtensionsDone) return;
        context.initExtensionsDone = true;
        var GLctx = context.GLctx;
        webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
        webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(
          GLctx
        );
        if (context.version >= 2) {
          GLctx.disjointTimerQueryExt = GLctx.getExtension(
            "EXT_disjoint_timer_query_webgl2"
          );
        }
        if (context.version < 2 || !GLctx.disjointTimerQueryExt) {
          GLctx.disjointTimerQueryExt = GLctx.getExtension(
            "EXT_disjoint_timer_query"
          );
        }
        webgl_enable_WEBGL_multi_draw(GLctx);
        getEmscriptenSupportedExtensions(GLctx).forEach((ext) => {
          if (!ext.includes("lose_context") && !ext.includes("debug")) {
            GLctx.getExtension(ext);
          }
        });
      },
    };

    function _eglCreateContext(display, config, hmm, contextAttribs) {
      display >>>= 0;
      config >>>= 0;
      hmm >>>= 0;
      contextAttribs >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      var glesContextVersion = 1;
      for (;;) {
        var param = HEAP32[(contextAttribs >>> 2) >>> 0];
        if (param == 12440) {
          /*EGL_CONTEXT_CLIENT_VERSION*/ glesContextVersion =
            HEAP32[((contextAttribs + 4) >>> 2) >>> 0];
        } else if (param == 12344) {
          /*EGL_NONE*/ break;
        } else {
          /* EGL1.4 specifies only EGL_CONTEXT_CLIENT_VERSION as supported attribute */ EGL.setErrorCode(
            12292
          );
          /*EGL_BAD_ATTRIBUTE*/ return 0;
        }
        contextAttribs += 8;
      }
      if (glesContextVersion < 2 || glesContextVersion > 3) {
        EGL.setErrorCode(12293);
        /* EGL_BAD_CONFIG */ return 0;
      }
      /* EGL_NO_CONTEXT */ EGL.contextAttributes.majorVersion =
        glesContextVersion - 1;
      EGL.contextAttributes.minorVersion = 0;
      EGL.context = GL.createContext(Module["canvas"], EGL.contextAttributes);
      if (EGL.context != 0) {
        EGL.setErrorCode(12288);
        GL.makeContextCurrent(EGL.context);
        Module.useWebGL = true;
        Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
          callback();
        });
        GL.makeContextCurrent(null);
        return 62004;
      } else {
        EGL.setErrorCode(12297);
        return 0;
      }
    }

    function _eglCreateWindowSurface(display, config, win, attrib_list) {
      display >>>= 0;
      config >>>= 0;
      attrib_list >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (config != 62002) {
        EGL.setErrorCode(12293);
        /* EGL_BAD_CONFIG */ return 0;
      }
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 62006;
    }

    function _eglDestroyContext(display, context) {
      display >>>= 0;
      context >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (context != 62004) {
        EGL.setErrorCode(12294);
        /* EGL_BAD_CONTEXT */ return 0;
      }
      GL.deleteContext(EGL.context);
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ if (EGL.currentContext == context) {
        EGL.currentContext = 0;
      }
      return 1;
    }

    function _eglDestroySurface(display, surface) {
      display >>>= 0;
      surface >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (surface != 62006) {
        /* Magic ID for the only EGLSurface supported by Emscripten */ EGL.setErrorCode(
          12301
        );
        /* EGL_BAD_SURFACE */ return 1;
      }
      if (EGL.currentReadSurface == surface) {
        EGL.currentReadSurface = 0;
      }
      if (EGL.currentDrawSurface == surface) {
        EGL.currentDrawSurface = 0;
      }
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    }

    function _eglGetConfigAttrib(display, config, attribute, value) {
      display >>>= 0;
      config >>>= 0;
      value >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (config != 62002) {
        EGL.setErrorCode(12293);
        /* EGL_BAD_CONFIG */ return 0;
      }
      if (!value) {
        EGL.setErrorCode(12300);
        /* EGL_BAD_PARAMETER */ return 0;
      }
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ switch (attribute) {
        case 12320:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.alpha ? 32 : 24;
          return 1;

        case 12321:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.alpha ? 8 : 0;
          return 1;

        case 12322:
          HEAP32[(value >>> 2) >>> 0] = 8;
          return 1;

        case 12323:
          HEAP32[(value >>> 2) >>> 0] = 8;
          return 1;

        case 12324:
          HEAP32[(value >>> 2) >>> 0] = 8;
          return 1;

        case 12325:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.depth ? 24 : 0;
          return 1;

        case 12326:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.stencil ? 8 : 0;
          return 1;

        case 12327:
          HEAP32[(value >>> 2) >>> 0] = 12344;
          return 1;

        case 12328:
          HEAP32[(value >>> 2) >>> 0] = 62002;
          return 1;

        case 12329:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12330:
          HEAP32[(value >>> 2) >>> 0] = 4096;
          return 1;

        case 12331:
          HEAP32[(value >>> 2) >>> 0] = 16777216;
          return 1;

        case 12332:
          HEAP32[(value >>> 2) >>> 0] = 4096;
          return 1;

        case 12333:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12334:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12335:
          HEAP32[(value >>> 2) >>> 0] = 12344;
          return 1;

        case 12337:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.antialias ? 4 : 0;
          return 1;

        case 12338:
          HEAP32[(value >>> 2) >>> 0] = EGL.contextAttributes.antialias ? 1 : 0;
          return 1;

        case 12339:
          HEAP32[(value >>> 2) >>> 0] = 4;
          return 1;

        case 12340:
          HEAP32[(value >>> 2) >>> 0] = 12344;
          return 1;

        case 12341:
        case 12342:
        case 12343:
          HEAP32[(value >>> 2) >>> 0] = -1;
          return 1;

        case 12345:
        case 12346:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12347:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12348:
          HEAP32[(value >>> 2) >>> 0] = 1;
          return 1;

        case 12349:
        case 12350:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        case 12351:
          HEAP32[(value >>> 2) >>> 0] = 12430;
          return 1;

        case 12352:
          HEAP32[(value >>> 2) >>> 0] = 4;
          return 1;

        case 12354:
          HEAP32[(value >>> 2) >>> 0] = 0;
          return 1;

        default:
          EGL.setErrorCode(12292);
          /* EGL_BAD_ATTRIBUTE */ return 0;
      }
    }

    function _eglGetDisplay(nativeDisplayType) {
      nativeDisplayType >>>= 0;
      EGL.setErrorCode(12288);
      if (
        nativeDisplayType != 0 &&
        /* EGL_DEFAULT_DISPLAY */ nativeDisplayType != 1
      ) {
        /* see library_xlib.js */ return 0;
      }
      return 62e3;
    }

    var _eglGetError = () => EGL.errorCode;

    function _eglInitialize(display, majorVersion, minorVersion) {
      display >>>= 0;
      majorVersion >>>= 0;
      minorVersion >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (majorVersion) {
        HEAP32[(majorVersion >>> 2) >>> 0] = 1;
      }
      if (minorVersion) {
        HEAP32[(minorVersion >>> 2) >>> 0] = 4;
      }
      EGL.defaultDisplayInitialized = true;
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    }

    function _eglMakeCurrent(display, draw, read, context) {
      display >>>= 0;
      draw >>>= 0;
      read >>>= 0;
      context >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (context != 0 && context != 62004) {
        EGL.setErrorCode(12294);
        /* EGL_BAD_CONTEXT */ return 0;
      }
      if ((read != 0 && read != 62006) || (draw != 0 && draw != 62006)) {
        /* Magic ID for Emscripten 'default surface' */ EGL.setErrorCode(12301);
        /* EGL_BAD_SURFACE */ return 0;
      }
      GL.makeContextCurrent(context ? EGL.context : null);
      EGL.currentContext = context;
      EGL.currentDrawSurface = draw;
      EGL.currentReadSurface = read;
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    }

    var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };

    function _eglQueryString(display, name) {
      display >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ if (EGL.stringCache[name]) return EGL.stringCache[name];
      var ret;
      switch (name) {
        case 12371:
          /* EGL_VENDOR */ ret = stringToNewUTF8("Emscripten");
          break;

        case 12372:
          /* EGL_VERSION */ ret = stringToNewUTF8("1.4 Emscripten EGL");
          break;

        case 12373:
          /* EGL_EXTENSIONS */ ret = stringToNewUTF8("");
          break;

        case 12429:
          /* EGL_CLIENT_APIS */ ret = stringToNewUTF8("OpenGL_ES");
          break;

        default:
          EGL.setErrorCode(12300);
          /* EGL_BAD_PARAMETER */ return 0;
      }
      EGL.stringCache[name] = ret;
      return ret;
    }

    function _eglSwapBuffers(dpy, surface) {
      dpy >>>= 0;
      surface >>>= 0;
      if (!EGL.defaultDisplayInitialized) {
        EGL.setErrorCode(12289);
      } /* EGL_NOT_INITIALIZED */ else if (!Module.ctx) {
        EGL.setErrorCode(12290);
      } /* EGL_BAD_ACCESS */ else if (Module.ctx.isContextLost()) {
        EGL.setErrorCode(12302);
      } /* EGL_CONTEXT_LOST */ else {
        EGL.setErrorCode(12288);
        /* EGL_SUCCESS */ return 1;
      }
      /* EGL_TRUE */ return 0;
    }

    function _eglSwapInterval(display, interval) {
      display >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      if (interval == 0) _emscripten_set_main_loop_timing(0, 0);
      else _emscripten_set_main_loop_timing(1, interval);
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    }

    function _eglTerminate(display) {
      display >>>= 0;
      if (display != 62e3) {
        EGL.setErrorCode(12296);
        /* EGL_BAD_DISPLAY */ return 0;
      }
      EGL.currentContext = 0;
      EGL.currentReadSurface = 0;
      EGL.currentDrawSurface = 0;
      EGL.defaultDisplayInitialized = false;
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    }

    /** @suppress {duplicate } */ var _eglWaitClient = () => {
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    };

    var _eglWaitGL = _eglWaitClient;

    var _eglWaitNative = (nativeEngineId) => {
      EGL.setErrorCode(12288);
      /* EGL_SUCCESS */ return 1;
    };

    var readEmAsmArgsArray = [];

    var readEmAsmArgs = (sigPtr, buf) => {
      readEmAsmArgsArray.length = 0;
      var ch;
      while ((ch = HEAPU8[sigPtr++ >>> 0])) {
        var wide = ch != 105;
        wide &= ch != 112;
        buf += wide && buf % 8 ? 4 : 0;
        readEmAsmArgsArray.push(
          ch == 112
            ? HEAPU32[(buf >>> 2) >>> 0]
            : ch == 105
            ? HEAP32[(buf >>> 2) >>> 0]
            : HEAPF64[(buf >>> 3) >>> 0]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };

    var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      return ASM_CONSTS[code].apply(null, args);
    };

    function _emscripten_asm_const_int(code, sigPtr, argbuf) {
      code >>>= 0;
      sigPtr >>>= 0;
      argbuf >>>= 0;
      return runEmAsmFunction(code, sigPtr, argbuf);
    }

    var runMainThreadEmAsm = (code, sigPtr, argbuf, sync) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      return ASM_CONSTS[code].apply(null, args);
    };

    function _emscripten_asm_const_int_sync_on_main_thread(
      code,
      sigPtr,
      argbuf
    ) {
      code >>>= 0;
      sigPtr >>>= 0;
      argbuf >>>= 0;
      return runMainThreadEmAsm(code, sigPtr, argbuf, 1);
    }

    var _emscripten_cancel_main_loop = () => {
      Browser.mainLoop.pause();
      Browser.mainLoop.func = null;
    };

    var _emscripten_date_now = () => Date.now();

    var JSEvents = {
      removeAllEventListeners() {
        while (JSEvents.eventHandlers.length) {
          JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
        }
        JSEvents.deferredCalls = [];
      },
      inEventHandler: 0,
      deferredCalls: [],
      deferCall(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
          if (arrA.length != arrB.length) return false;
          for (var i in arrA) {
            if (arrA[i] != arrB[i]) return false;
          }
          return true;
        }
        for (var i in JSEvents.deferredCalls) {
          var call = JSEvents.deferredCalls[i];
          if (
            call.targetFunction == targetFunction &&
            arraysHaveEqualContent(call.argsList, argsList)
          ) {
            return;
          }
        }
        JSEvents.deferredCalls.push({
          targetFunction: targetFunction,
          precedence: precedence,
          argsList: argsList,
        });
        JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence);
      },
      removeDeferredCalls(targetFunction) {
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
            JSEvents.deferredCalls.splice(i, 1);
            --i;
          }
        }
      },
      canPerformEventHandlerRequests() {
        if (navigator.userActivation) {
          return navigator.userActivation.isActive;
        }
        return (
          JSEvents.inEventHandler &&
          JSEvents.currentEventHandler.allowsDeferredCalls
        );
      },
      runDeferredCalls() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
          return;
        }
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          var call = JSEvents.deferredCalls[i];
          JSEvents.deferredCalls.splice(i, 1);
          --i;
          call.targetFunction.apply(null, call.argsList);
        }
      },
      eventHandlers: [],
      removeAllHandlersOnTarget: (target, eventTypeString) => {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
          if (
            JSEvents.eventHandlers[i].target == target &&
            (!eventTypeString ||
              eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
          ) {
            JSEvents._removeHandler(i--);
          }
        }
      },
      _removeHandler(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(
          h.eventTypeString,
          h.eventListenerFunc,
          h.useCapture
        );
        JSEvents.eventHandlers.splice(i, 1);
      },
      registerOrRemoveHandler(eventHandler) {
        if (!eventHandler.target) {
          return -4;
        }
        if (eventHandler.callbackfunc) {
          eventHandler.eventListenerFunc = function (event) {
            ++JSEvents.inEventHandler;
            JSEvents.currentEventHandler = eventHandler;
            JSEvents.runDeferredCalls();
            eventHandler.handlerFunc(event);
            JSEvents.runDeferredCalls();
            --JSEvents.inEventHandler;
          };
          eventHandler.target.addEventListener(
            eventHandler.eventTypeString,
            eventHandler.eventListenerFunc,
            eventHandler.useCapture
          );
          JSEvents.eventHandlers.push(eventHandler);
        } else {
          for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (
              JSEvents.eventHandlers[i].target == eventHandler.target &&
              JSEvents.eventHandlers[i].eventTypeString ==
                eventHandler.eventTypeString
            ) {
              JSEvents._removeHandler(i--);
            }
          }
        }
        return 0;
      },
      getNodeNameForTarget(target) {
        if (!target) return "";
        if (target == window) return "#window";
        if (target == screen) return "#screen";
        return target?.nodeName || "";
      },
      fullscreenEnabled() {
        return document.fullscreenEnabled || document.webkitFullscreenEnabled;
      },
    };

    var currentFullscreenStrategy = {};

    var maybeCStringToJsString = (cString) =>
      cString > 2 ? UTF8ToString(cString) : cString;

    var specialHTMLTargets = [
      0,
      typeof document != "undefined" ? document : 0,
      typeof window != "undefined" ? window : 0,
    ];

    /** @suppress {duplicate } */ var findEventTarget = (target) => {
      target = maybeCStringToJsString(target);
      var domElement =
        specialHTMLTargets[target] ||
        (typeof document != "undefined"
          ? document.querySelector(target)
          : undefined);
      return domElement;
    };

    var findCanvasEventTarget = findEventTarget;

    function _emscripten_get_canvas_element_size(target, width, height) {
      target >>>= 0;
      width >>>= 0;
      height >>>= 0;
      var canvas = findCanvasEventTarget(target);
      if (!canvas) return -4;
      HEAP32[(width >>> 2) >>> 0] = canvas.width;
      HEAP32[(height >>> 2) >>> 0] = canvas.height;
    }

    var getCanvasElementSize = (target) =>
      withStackSave(() => {
        var w = stackAlloc(8);
        var h = w + 4;
        var targetInt = stringToUTF8OnStack(target.id);
        var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
        var size = [HEAP32[(w >>> 2) >>> 0], HEAP32[(h >>> 2) >>> 0]];
        return size;
      });

    function _emscripten_set_canvas_element_size(target, width, height) {
      target >>>= 0;
      var canvas = findCanvasEventTarget(target);
      if (!canvas) return -4;
      canvas.width = width;
      canvas.height = height;
      return 0;
    }

    var setCanvasElementSize = (target, width, height) => {
      if (!target.controlTransferredOffscreen) {
        target.width = width;
        target.height = height;
      } else {
        withStackSave(() => {
          var targetInt = stringToUTF8OnStack(target.id);
          _emscripten_set_canvas_element_size(targetInt, width, height);
        });
      }
    };

    var registerRestoreOldStyle = (canvas) => {
      var canvasSize = getCanvasElementSize(canvas);
      var oldWidth = canvasSize[0];
      var oldHeight = canvasSize[1];
      var oldCssWidth = canvas.style.width;
      var oldCssHeight = canvas.style.height;
      var oldBackgroundColor = canvas.style.backgroundColor;
      var oldDocumentBackgroundColor = document.body.style.backgroundColor;
      var oldPaddingLeft = canvas.style.paddingLeft;
      var oldPaddingRight = canvas.style.paddingRight;
      var oldPaddingTop = canvas.style.paddingTop;
      var oldPaddingBottom = canvas.style.paddingBottom;
      var oldMarginLeft = canvas.style.marginLeft;
      var oldMarginRight = canvas.style.marginRight;
      var oldMarginTop = canvas.style.marginTop;
      var oldMarginBottom = canvas.style.marginBottom;
      var oldDocumentBodyMargin = document.body.style.margin;
      var oldDocumentOverflow = document.documentElement.style.overflow;
      var oldDocumentScroll = document.body.scroll;
      var oldImageRendering = canvas.style.imageRendering;
      function restoreOldStyle() {
        var fullscreenElement =
          document.fullscreenElement || document.webkitFullscreenElement;
        if (!fullscreenElement) {
          document.removeEventListener("fullscreenchange", restoreOldStyle);
          document.removeEventListener(
            "webkitfullscreenchange",
            restoreOldStyle
          );
          setCanvasElementSize(canvas, oldWidth, oldHeight);
          canvas.style.width = oldCssWidth;
          canvas.style.height = oldCssHeight;
          canvas.style.backgroundColor = oldBackgroundColor;
          if (!oldDocumentBackgroundColor)
            document.body.style.backgroundColor = "white";
          document.body.style.backgroundColor = oldDocumentBackgroundColor;
          canvas.style.paddingLeft = oldPaddingLeft;
          canvas.style.paddingRight = oldPaddingRight;
          canvas.style.paddingTop = oldPaddingTop;
          canvas.style.paddingBottom = oldPaddingBottom;
          canvas.style.marginLeft = oldMarginLeft;
          canvas.style.marginRight = oldMarginRight;
          canvas.style.marginTop = oldMarginTop;
          canvas.style.marginBottom = oldMarginBottom;
          document.body.style.margin = oldDocumentBodyMargin;
          document.documentElement.style.overflow = oldDocumentOverflow;
          document.body.scroll = oldDocumentScroll;
          canvas.style.imageRendering = oldImageRendering;
          if (canvas.GLctxObject)
            canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
          if (currentFullscreenStrategy.canvasResizedCallback) {
            getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(
              37,
              0,
              currentFullscreenStrategy.canvasResizedCallbackUserData
            );
          }
        }
      }
      document.addEventListener("fullscreenchange", restoreOldStyle);
      document.addEventListener("webkitfullscreenchange", restoreOldStyle);
      return restoreOldStyle;
    };

    var setLetterbox = (element, topBottom, leftRight) => {
      element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
      element.style.paddingTop = element.style.paddingBottom = topBottom + "px";
    };

    var getBoundingClientRect = (e) =>
      specialHTMLTargets.indexOf(e) < 0
        ? e.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
          };

    var JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
      var restoreOldStyle = registerRestoreOldStyle(target);
      var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
      var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
      var rect = getBoundingClientRect(target);
      var windowedCssWidth = rect.width;
      var windowedCssHeight = rect.height;
      var canvasSize = getCanvasElementSize(target);
      var windowedRttWidth = canvasSize[0];
      var windowedRttHeight = canvasSize[1];
      if (strategy.scaleMode == 3) {
        setLetterbox(
          target,
          (cssHeight - windowedCssHeight) / 2,
          (cssWidth - windowedCssWidth) / 2
        );
        cssWidth = windowedCssWidth;
        cssHeight = windowedCssHeight;
      } else if (strategy.scaleMode == 2) {
        if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
          var desiredCssHeight =
            (windowedRttHeight * cssWidth) / windowedRttWidth;
          setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
          cssHeight = desiredCssHeight;
        } else {
          var desiredCssWidth =
            (windowedRttWidth * cssHeight) / windowedRttHeight;
          setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
          cssWidth = desiredCssWidth;
        }
      }
      if (!target.style.backgroundColor) target.style.backgroundColor = "black";
      if (!document.body.style.backgroundColor)
        document.body.style.backgroundColor = "black";
      target.style.width = cssWidth + "px";
      target.style.height = cssHeight + "px";
      if (strategy.filteringMode == 1) {
        target.style.imageRendering = "optimizeSpeed";
        target.style.imageRendering = "-moz-crisp-edges";
        target.style.imageRendering = "-o-crisp-edges";
        target.style.imageRendering = "-webkit-optimize-contrast";
        target.style.imageRendering = "optimize-contrast";
        target.style.imageRendering = "crisp-edges";
        target.style.imageRendering = "pixelated";
      }
      var dpiScale =
        strategy.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1;
      if (strategy.canvasResolutionScaleMode != 0) {
        var newWidth = (cssWidth * dpiScale) | 0;
        var newHeight = (cssHeight * dpiScale) | 0;
        setCanvasElementSize(target, newWidth, newHeight);
        if (target.GLctxObject)
          target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
      }
      return restoreOldStyle;
    };

    var JSEvents_requestFullscreen = (target, strategy) => {
      if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
        JSEvents_resizeCanvasForFullscreen(target, strategy);
      }
      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      } else {
        return JSEvents.fullscreenEnabled() ? -3 : -1;
      }
      currentFullscreenStrategy = strategy;
      if (strategy.canvasResizedCallback) {
        getWasmTableEntry(strategy.canvasResizedCallback)(
          37,
          0,
          strategy.canvasResizedCallbackUserData
        );
      }
      return 0;
    };

    var _emscripten_exit_fullscreen = () => {
      if (!JSEvents.fullscreenEnabled()) return -1;
      JSEvents.removeDeferredCalls(JSEvents_requestFullscreen);
      var d = specialHTMLTargets[1];
      if (d.exitFullscreen) {
        d.fullscreenElement && d.exitFullscreen();
      } else if (d.webkitExitFullscreen) {
        d.webkitFullscreenElement && d.webkitExitFullscreen();
      } else {
        return -1;
      }
      return 0;
    };

    var requestPointerLock = (target) => {
      if (target.requestPointerLock) {
        target.requestPointerLock();
      } else {
        if (document.body.requestPointerLock) {
          return -3;
        }
        return -1;
      }
      return 0;
    };

    var _emscripten_exit_pointerlock = () => {
      JSEvents.removeDeferredCalls(requestPointerLock);
      if (document.exitPointerLock) {
        document.exitPointerLock();
      } else {
        return -1;
      }
      return 0;
    };

    var _emscripten_get_device_pixel_ratio = () =>
      (typeof devicePixelRatio == "number" && devicePixelRatio) || 1;

    function _emscripten_get_element_css_size(target, width, height) {
      target >>>= 0;
      width >>>= 0;
      height >>>= 0;
      target = findEventTarget(target);
      if (!target) return -4;
      var rect = getBoundingClientRect(target);
      HEAPF64[(width >>> 3) >>> 0] = rect.width;
      HEAPF64[(height >>> 3) >>> 0] = rect.height;
      return 0;
    }

    var fillGamepadEventData = (eventStruct, e) => {
      HEAPF64[(eventStruct >>> 3) >>> 0] = e.timestamp;
      for (var i = 0; i < e.axes.length; ++i) {
        HEAPF64[((eventStruct + i * 8 + 16) >>> 3) >>> 0] = e.axes[i];
      }
      for (var i = 0; i < e.buttons.length; ++i) {
        if (typeof e.buttons[i] == "object") {
          HEAPF64[((eventStruct + i * 8 + 528) >>> 3) >>> 0] =
            e.buttons[i].value;
        } else {
          HEAPF64[((eventStruct + i * 8 + 528) >>> 3) >>> 0] = e.buttons[i];
        }
      }
      for (var i = 0; i < e.buttons.length; ++i) {
        if (typeof e.buttons[i] == "object") {
          HEAP32[((eventStruct + i * 4 + 1040) >>> 2) >>> 0] =
            e.buttons[i].pressed;
        } else {
          /** @suppress {checkTypes} */ HEAP32[
            ((eventStruct + i * 4 + 1040) >>> 2) >>> 0
          ] = e.buttons[i] == 1;
        }
      }
      HEAP32[((eventStruct + 1296) >>> 2) >>> 0] = e.connected;
      HEAP32[((eventStruct + 1300) >>> 2) >>> 0] = e.index;
      HEAP32[((eventStruct + 8) >>> 2) >>> 0] = e.axes.length;
      HEAP32[((eventStruct + 12) >>> 2) >>> 0] = e.buttons.length;
      stringToUTF8(e.id, eventStruct + 1304, 64);
      stringToUTF8(e.mapping, eventStruct + 1368, 64);
    };

    function _emscripten_get_gamepad_status(index, gamepadState) {
      gamepadState >>>= 0;
      if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5;
      if (!JSEvents.lastGamepadState[index]) return -7;
      fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index]);
      return 0;
    }

    var getHeapMax = () => 4294901760;

    function _emscripten_get_heap_max() {
      return getHeapMax();
    }

    var _emscripten_get_num_gamepads = () => JSEvents.lastGamepadState.length;

    function _emscripten_get_screen_size(width, height) {
      width >>>= 0;
      height >>>= 0;
      HEAP32[(width >>> 2) >>> 0] = screen.width;
      HEAP32[(height >>> 2) >>> 0] = screen.height;
    }

    /** @suppress {duplicate } */ function _glActiveTexture(x0) {
      GLctx.activeTexture(x0);
    }

    var _emscripten_glActiveTexture = _glActiveTexture;

    /** @suppress {duplicate } */ var _glAttachShader = (program, shader) => {
      GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
    };

    var _emscripten_glAttachShader = _glAttachShader;

    /** @suppress {duplicate } */ var _glBeginQuery = (target, id) => {
      GLctx.beginQuery(target, GL.queries[id]);
    };

    var _emscripten_glBeginQuery = _glBeginQuery;

    /** @suppress {duplicate } */ var _glBeginQueryEXT = (target, id) => {
      GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.queries[id]);
    };

    var _emscripten_glBeginQueryEXT = _glBeginQueryEXT;

    /** @suppress {duplicate } */ function _glBeginTransformFeedback(x0) {
      GLctx.beginTransformFeedback(x0);
    }

    var _emscripten_glBeginTransformFeedback = _glBeginTransformFeedback;

    /** @suppress {duplicate } */ function _glBindAttribLocation(
      program,
      index,
      name
    ) {
      name >>>= 0;
      GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
    }

    var _emscripten_glBindAttribLocation = _glBindAttribLocation;

    /** @suppress {duplicate } */ var _glBindBuffer = (target, buffer) => {
      if (target == 34962) {
        /*GL_ARRAY_BUFFER*/ GLctx.currentArrayBufferBinding = buffer;
      } else if (target == 34963) {
        /*GL_ELEMENT_ARRAY_BUFFER*/ GLctx.currentElementArrayBufferBinding =
          buffer;
      }
      if (target == 35051) {
        /*GL_PIXEL_PACK_BUFFER*/ GLctx.currentPixelPackBufferBinding = buffer;
      } else if (target == 35052) {
        /*GL_PIXEL_UNPACK_BUFFER*/ GLctx.currentPixelUnpackBufferBinding =
          buffer;
      }
      GLctx.bindBuffer(target, GL.buffers[buffer]);
    };

    var _emscripten_glBindBuffer = _glBindBuffer;

    /** @suppress {duplicate } */ var _glBindBufferBase = (
      target,
      index,
      buffer
    ) => {
      GLctx.bindBufferBase(target, index, GL.buffers[buffer]);
    };

    var _emscripten_glBindBufferBase = _glBindBufferBase;

    /** @suppress {duplicate } */ function _glBindBufferRange(
      target,
      index,
      buffer,
      offset,
      ptrsize
    ) {
      offset >>>= 0;
      ptrsize >>>= 0;
      GLctx.bindBufferRange(target, index, GL.buffers[buffer], offset, ptrsize);
    }

    var _emscripten_glBindBufferRange = _glBindBufferRange;

    /** @suppress {duplicate } */ var _glBindFramebuffer = (
      target,
      framebuffer
    ) => {
      GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
    };

    var _emscripten_glBindFramebuffer = _glBindFramebuffer;

    /** @suppress {duplicate } */ var _glBindRenderbuffer = (
      target,
      renderbuffer
    ) => {
      GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
    };

    var _emscripten_glBindRenderbuffer = _glBindRenderbuffer;

    /** @suppress {duplicate } */ var _glBindSampler = (unit, sampler) => {
      GLctx.bindSampler(unit, GL.samplers[sampler]);
    };

    var _emscripten_glBindSampler = _glBindSampler;

    /** @suppress {duplicate } */ var _glBindTexture = (target, texture) => {
      GLctx.bindTexture(target, GL.textures[texture]);
    };

    var _emscripten_glBindTexture = _glBindTexture;

    /** @suppress {duplicate } */ var _glBindTransformFeedback = (
      target,
      id
    ) => {
      GLctx.bindTransformFeedback(target, GL.transformFeedbacks[id]);
    };

    var _emscripten_glBindTransformFeedback = _glBindTransformFeedback;

    /** @suppress {duplicate } */ var _glBindVertexArray = (vao) => {
      GLctx.bindVertexArray(GL.vaos[vao]);
      var ibo = GLctx.getParameter(34965);
      /*ELEMENT_ARRAY_BUFFER_BINDING*/ GLctx.currentElementArrayBufferBinding =
        ibo ? ibo.name | 0 : 0;
    };

    var _emscripten_glBindVertexArray = _glBindVertexArray;

    /** @suppress {duplicate } */ var _glBindVertexArrayOES =
      _glBindVertexArray;

    var _emscripten_glBindVertexArrayOES = _glBindVertexArrayOES;

    /** @suppress {duplicate } */ function _glBlendColor(x0, x1, x2, x3) {
      GLctx.blendColor(x0, x1, x2, x3);
    }

    var _emscripten_glBlendColor = _glBlendColor;

    /** @suppress {duplicate } */ function _glBlendEquation(x0) {
      GLctx.blendEquation(x0);
    }

    var _emscripten_glBlendEquation = _glBlendEquation;

    /** @suppress {duplicate } */ function _glBlendEquationSeparate(x0, x1) {
      GLctx.blendEquationSeparate(x0, x1);
    }

    var _emscripten_glBlendEquationSeparate = _glBlendEquationSeparate;

    /** @suppress {duplicate } */ function _glBlendFunc(x0, x1) {
      GLctx.blendFunc(x0, x1);
    }

    var _emscripten_glBlendFunc = _glBlendFunc;

    /** @suppress {duplicate } */ function _glBlendFuncSeparate(
      x0,
      x1,
      x2,
      x3
    ) {
      GLctx.blendFuncSeparate(x0, x1, x2, x3);
    }

    var _emscripten_glBlendFuncSeparate = _glBlendFuncSeparate;

    /** @suppress {duplicate } */ function _glBlitFramebuffer(
      x0,
      x1,
      x2,
      x3,
      x4,
      x5,
      x6,
      x7,
      x8,
      x9
    ) {
      GLctx.blitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9);
    }

    var _emscripten_glBlitFramebuffer = _glBlitFramebuffer;

    /** @suppress {duplicate } */ function _glBufferData(
      target,
      size,
      data,
      usage
    ) {
      size >>>= 0;
      data >>>= 0;
      if (true) {
        if (data && size) {
          GLctx.bufferData(target, HEAPU8, usage, data, size);
        } else {
          GLctx.bufferData(target, size, usage);
        }
      } else {
        GLctx.bufferData(
          target,
          data ? HEAPU8.subarray(data >>> 0, (data + size) >>> 0) : size,
          usage
        );
      }
    }

    var _emscripten_glBufferData = _glBufferData;

    /** @suppress {duplicate } */ function _glBufferSubData(
      target,
      offset,
      size,
      data
    ) {
      offset >>>= 0;
      size >>>= 0;
      data >>>= 0;
      if (true) {
        size && GLctx.bufferSubData(target, offset, HEAPU8, data, size);
        return;
      }
      GLctx.bufferSubData(
        target,
        offset,
        HEAPU8.subarray(data >>> 0, (data + size) >>> 0)
      );
    }

    var _emscripten_glBufferSubData = _glBufferSubData;

    /** @suppress {duplicate } */ function _glCheckFramebufferStatus(x0) {
      return GLctx.checkFramebufferStatus(x0);
    }

    var _emscripten_glCheckFramebufferStatus = _glCheckFramebufferStatus;

    /** @suppress {duplicate } */ function _glClear(x0) {
      GLctx.clear(x0);
    }

    var _emscripten_glClear = _glClear;

    /** @suppress {duplicate } */ function _glClearBufferfi(x0, x1, x2, x3) {
      GLctx.clearBufferfi(x0, x1, x2, x3);
    }

    var _emscripten_glClearBufferfi = _glClearBufferfi;

    /** @suppress {duplicate } */ function _glClearBufferfv(
      buffer,
      drawbuffer,
      value
    ) {
      value >>>= 0;
      GLctx.clearBufferfv(buffer, drawbuffer, HEAPF32, value >> 2);
    }

    var _emscripten_glClearBufferfv = _glClearBufferfv;

    /** @suppress {duplicate } */ function _glClearBufferiv(
      buffer,
      drawbuffer,
      value
    ) {
      value >>>= 0;
      GLctx.clearBufferiv(buffer, drawbuffer, HEAP32, value >> 2);
    }

    var _emscripten_glClearBufferiv = _glClearBufferiv;

    /** @suppress {duplicate } */ function _glClearBufferuiv(
      buffer,
      drawbuffer,
      value
    ) {
      value >>>= 0;
      GLctx.clearBufferuiv(buffer, drawbuffer, HEAPU32, value >> 2);
    }

    var _emscripten_glClearBufferuiv = _glClearBufferuiv;

    /** @suppress {duplicate } */ function _glClearColor(x0, x1, x2, x3) {
      GLctx.clearColor(x0, x1, x2, x3);
    }

    var _emscripten_glClearColor = _glClearColor;

    /** @suppress {duplicate } */ function _glClearDepthf(x0) {
      GLctx.clearDepth(x0);
    }

    var _emscripten_glClearDepthf = _glClearDepthf;

    /** @suppress {duplicate } */ function _glClearStencil(x0) {
      GLctx.clearStencil(x0);
    }

    var _emscripten_glClearStencil = _glClearStencil;

    var convertI32PairToI53 = (lo, hi) => (lo >>> 0) + hi * 4294967296;

    /** @suppress {duplicate } */ function _glClientWaitSync(
      sync,
      flags,
      timeout_low,
      timeout_high
    ) {
      sync >>>= 0;
      var timeout = convertI32PairToI53(timeout_low, timeout_high);
      return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
    }

    var _emscripten_glClientWaitSync = _glClientWaitSync;

    /** @suppress {duplicate } */ var _glColorMask = (
      red,
      green,
      blue,
      alpha
    ) => {
      GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
    };

    var _emscripten_glColorMask = _glColorMask;

    /** @suppress {duplicate } */ var _glCompileShader = (shader) => {
      GLctx.compileShader(GL.shaders[shader]);
    };

    var _emscripten_glCompileShader = _glCompileShader;

    /** @suppress {duplicate } */ function _glCompressedTexImage2D(
      target,
      level,
      internalFormat,
      width,
      height,
      border,
      imageSize,
      data
    ) {
      data >>>= 0;
      if (true) {
        if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
          GLctx.compressedTexImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            border,
            imageSize,
            data
          );
        } else {
          GLctx.compressedTexImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            border,
            HEAPU8,
            data,
            imageSize
          );
        }
        return;
      }
      GLctx.compressedTexImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        data ? HEAPU8.subarray(data >>> 0, (data + imageSize) >>> 0) : null
      );
    }

    var _emscripten_glCompressedTexImage2D = _glCompressedTexImage2D;

    /** @suppress {duplicate } */ function _glCompressedTexImage3D(
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      imageSize,
      data
    ) {
      data >>>= 0;
      if (GLctx.currentPixelUnpackBufferBinding) {
        GLctx.compressedTexImage3D(
          target,
          level,
          internalFormat,
          width,
          height,
          depth,
          border,
          imageSize,
          data
        );
      } else {
        GLctx.compressedTexImage3D(
          target,
          level,
          internalFormat,
          width,
          height,
          depth,
          border,
          HEAPU8,
          data,
          imageSize
        );
      }
    }

    var _emscripten_glCompressedTexImage3D = _glCompressedTexImage3D;

    /** @suppress {duplicate } */ function _glCompressedTexSubImage2D(
      target,
      level,
      xoffset,
      yoffset,
      width,
      height,
      format,
      imageSize,
      data
    ) {
      data >>>= 0;
      if (true) {
        if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
          GLctx.compressedTexSubImage2D(
            target,
            level,
            xoffset,
            yoffset,
            width,
            height,
            format,
            imageSize,
            data
          );
        } else {
          GLctx.compressedTexSubImage2D(
            target,
            level,
            xoffset,
            yoffset,
            width,
            height,
            format,
            HEAPU8,
            data,
            imageSize
          );
        }
        return;
      }
      GLctx.compressedTexSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        data ? HEAPU8.subarray(data >>> 0, (data + imageSize) >>> 0) : null
      );
    }

    var _emscripten_glCompressedTexSubImage2D = _glCompressedTexSubImage2D;

    /** @suppress {duplicate } */ function _glCompressedTexSubImage3D(
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      imageSize,
      data
    ) {
      data >>>= 0;
      if (GLctx.currentPixelUnpackBufferBinding) {
        GLctx.compressedTexSubImage3D(
          target,
          level,
          xoffset,
          yoffset,
          zoffset,
          width,
          height,
          depth,
          format,
          imageSize,
          data
        );
      } else {
        GLctx.compressedTexSubImage3D(
          target,
          level,
          xoffset,
          yoffset,
          zoffset,
          width,
          height,
          depth,
          format,
          HEAPU8,
          data,
          imageSize
        );
      }
    }

    var _emscripten_glCompressedTexSubImage3D = _glCompressedTexSubImage3D;

    /** @suppress {duplicate } */ function _glCopyBufferSubData(
      x0,
      x1,
      x2,
      x3,
      x4
    ) {
      x2 >>>= 0;
      x3 >>>= 0;
      x4 >>>= 0;
      GLctx.copyBufferSubData(x0, x1, x2, x3, x4);
    }

    var _emscripten_glCopyBufferSubData = _glCopyBufferSubData;

    /** @suppress {duplicate } */ function _glCopyTexImage2D(
      x0,
      x1,
      x2,
      x3,
      x4,
      x5,
      x6,
      x7
    ) {
      GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7);
    }

    var _emscripten_glCopyTexImage2D = _glCopyTexImage2D;

    /** @suppress {duplicate } */ function _glCopyTexSubImage2D(
      x0,
      x1,
      x2,
      x3,
      x4,
      x5,
      x6,
      x7
    ) {
      GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7);
    }

    var _emscripten_glCopyTexSubImage2D = _glCopyTexSubImage2D;

    /** @suppress {duplicate } */ function _glCopyTexSubImage3D(
      x0,
      x1,
      x2,
      x3,
      x4,
      x5,
      x6,
      x7,
      x8
    ) {
      GLctx.copyTexSubImage3D(x0, x1, x2, x3, x4, x5, x6, x7, x8);
    }

    var _emscripten_glCopyTexSubImage3D = _glCopyTexSubImage3D;

    /** @suppress {duplicate } */ var _glCreateProgram = () => {
      var id = GL.getNewId(GL.programs);
      var program = GLctx.createProgram();
      program.name = id;
      program.maxUniformLength =
        program.maxAttributeLength =
        program.maxUniformBlockNameLength =
          0;
      program.uniformIdCounter = 1;
      GL.programs[id] = program;
      return id;
    };

    var _emscripten_glCreateProgram = _glCreateProgram;

    /** @suppress {duplicate } */ var _glCreateShader = (shaderType) => {
      var id = GL.getNewId(GL.shaders);
      GL.shaders[id] = GLctx.createShader(shaderType);
      return id;
    };

    var _emscripten_glCreateShader = _glCreateShader;

    /** @suppress {duplicate } */ function _glCullFace(x0) {
      GLctx.cullFace(x0);
    }

    var _emscripten_glCullFace = _glCullFace;

    /** @suppress {duplicate } */ function _glDeleteBuffers(n, buffers) {
      buffers >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((buffers + i * 4) >>> 2) >>> 0];
        var buffer = GL.buffers[id];
        if (!buffer) continue;
        GLctx.deleteBuffer(buffer);
        buffer.name = 0;
        GL.buffers[id] = null;
        if (id == GLctx.currentArrayBufferBinding)
          GLctx.currentArrayBufferBinding = 0;
        if (id == GLctx.currentElementArrayBufferBinding)
          GLctx.currentElementArrayBufferBinding = 0;
        if (id == GLctx.currentPixelPackBufferBinding)
          GLctx.currentPixelPackBufferBinding = 0;
        if (id == GLctx.currentPixelUnpackBufferBinding)
          GLctx.currentPixelUnpackBufferBinding = 0;
      }
    }

    var _emscripten_glDeleteBuffers = _glDeleteBuffers;

    /** @suppress {duplicate } */ function _glDeleteFramebuffers(
      n,
      framebuffers
    ) {
      framebuffers >>>= 0;
      for (var i = 0; i < n; ++i) {
        var id = HEAP32[((framebuffers + i * 4) >>> 2) >>> 0];
        var framebuffer = GL.framebuffers[id];
        if (!framebuffer) continue;
        GLctx.deleteFramebuffer(framebuffer);
        framebuffer.name = 0;
        GL.framebuffers[id] = null;
      }
    }

    var _emscripten_glDeleteFramebuffers = _glDeleteFramebuffers;

    /** @suppress {duplicate } */ var _glDeleteProgram = (id) => {
      if (!id) return;
      var program = GL.programs[id];
      if (!program) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      GLctx.deleteProgram(program);
      program.name = 0;
      GL.programs[id] = null;
    };

    var _emscripten_glDeleteProgram = _glDeleteProgram;

    /** @suppress {duplicate } */ function _glDeleteQueries(n, ids) {
      ids >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((ids + i * 4) >>> 2) >>> 0];
        var query = GL.queries[id];
        if (!query) continue;
        GLctx.deleteQuery(query);
        GL.queries[id] = null;
      }
    }

    var _emscripten_glDeleteQueries = _glDeleteQueries;

    /** @suppress {duplicate } */ function _glDeleteQueriesEXT(n, ids) {
      ids >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((ids + i * 4) >>> 2) >>> 0];
        var query = GL.queries[id];
        if (!query) continue;
        GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
        GL.queries[id] = null;
      }
    }

    var _emscripten_glDeleteQueriesEXT = _glDeleteQueriesEXT;

    /** @suppress {duplicate } */ function _glDeleteRenderbuffers(
      n,
      renderbuffers
    ) {
      renderbuffers >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((renderbuffers + i * 4) >>> 2) >>> 0];
        var renderbuffer = GL.renderbuffers[id];
        if (!renderbuffer) continue;
        GLctx.deleteRenderbuffer(renderbuffer);
        renderbuffer.name = 0;
        GL.renderbuffers[id] = null;
      }
    }

    var _emscripten_glDeleteRenderbuffers = _glDeleteRenderbuffers;

    /** @suppress {duplicate } */ function _glDeleteSamplers(n, samplers) {
      samplers >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((samplers + i * 4) >>> 2) >>> 0];
        var sampler = GL.samplers[id];
        if (!sampler) continue;
        GLctx.deleteSampler(sampler);
        sampler.name = 0;
        GL.samplers[id] = null;
      }
    }

    var _emscripten_glDeleteSamplers = _glDeleteSamplers;

    /** @suppress {duplicate } */ var _glDeleteShader = (id) => {
      if (!id) return;
      var shader = GL.shaders[id];
      if (!shader) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      GLctx.deleteShader(shader);
      GL.shaders[id] = null;
    };

    var _emscripten_glDeleteShader = _glDeleteShader;

    /** @suppress {duplicate } */ function _glDeleteSync(id) {
      id >>>= 0;
      if (!id) return;
      var sync = GL.syncs[id];
      if (!sync) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      GLctx.deleteSync(sync);
      sync.name = 0;
      GL.syncs[id] = null;
    }

    var _emscripten_glDeleteSync = _glDeleteSync;

    /** @suppress {duplicate } */ function _glDeleteTextures(n, textures) {
      textures >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((textures + i * 4) >>> 2) >>> 0];
        var texture = GL.textures[id];
        if (!texture) continue;
        GLctx.deleteTexture(texture);
        texture.name = 0;
        GL.textures[id] = null;
      }
    }

    var _emscripten_glDeleteTextures = _glDeleteTextures;

    /** @suppress {duplicate } */ function _glDeleteTransformFeedbacks(n, ids) {
      ids >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((ids + i * 4) >>> 2) >>> 0];
        var transformFeedback = GL.transformFeedbacks[id];
        if (!transformFeedback) continue;
        GLctx.deleteTransformFeedback(transformFeedback);
        transformFeedback.name = 0;
        GL.transformFeedbacks[id] = null;
      }
    }

    var _emscripten_glDeleteTransformFeedbacks = _glDeleteTransformFeedbacks;

    /** @suppress {duplicate } */ function _glDeleteVertexArrays(n, vaos) {
      vaos >>>= 0;
      for (var i = 0; i < n; i++) {
        var id = HEAP32[((vaos + i * 4) >>> 2) >>> 0];
        GLctx.deleteVertexArray(GL.vaos[id]);
        GL.vaos[id] = null;
      }
    }

    var _emscripten_glDeleteVertexArrays = _glDeleteVertexArrays;

    /** @suppress {duplicate } */ var _glDeleteVertexArraysOES =
      _glDeleteVertexArrays;

    var _emscripten_glDeleteVertexArraysOES = _glDeleteVertexArraysOES;

    /** @suppress {duplicate } */ function _glDepthFunc(x0) {
      GLctx.depthFunc(x0);
    }

    var _emscripten_glDepthFunc = _glDepthFunc;

    /** @suppress {duplicate } */ var _glDepthMask = (flag) => {
      GLctx.depthMask(!!flag);
    };

    var _emscripten_glDepthMask = _glDepthMask;

    /** @suppress {duplicate } */ function _glDepthRangef(x0, x1) {
      GLctx.depthRange(x0, x1);
    }

    var _emscripten_glDepthRangef = _glDepthRangef;

    /** @suppress {duplicate } */ var _glDetachShader = (program, shader) => {
      GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
    };

    var _emscripten_glDetachShader = _glDetachShader;

    /** @suppress {duplicate } */ function _glDisable(x0) {
      GLctx.disable(x0);
    }

    var _emscripten_glDisable = _glDisable;

    /** @suppress {duplicate } */ var _glDisableVertexAttribArray = (index) => {
      var cb = GL.currentContext.clientBuffers[index];
      cb.enabled = false;
      GLctx.disableVertexAttribArray(index);
    };

    var _emscripten_glDisableVertexAttribArray = _glDisableVertexAttribArray;

    /** @suppress {duplicate } */ var _glDrawArrays = (mode, first, count) => {
      GL.preDrawHandleClientVertexAttribBindings(first + count);
      GLctx.drawArrays(mode, first, count);
      GL.postDrawHandleClientVertexAttribBindings();
    };

    var _emscripten_glDrawArrays = _glDrawArrays;

    /** @suppress {duplicate } */ var _glDrawArraysInstanced = (
      mode,
      first,
      count,
      primcount
    ) => {
      GLctx.drawArraysInstanced(mode, first, count, primcount);
    };

    var _emscripten_glDrawArraysInstanced = _glDrawArraysInstanced;

    /** @suppress {duplicate } */ var _glDrawArraysInstancedANGLE =
      _glDrawArraysInstanced;

    var _emscripten_glDrawArraysInstancedANGLE = _glDrawArraysInstancedANGLE;

    /** @suppress {duplicate } */ var _glDrawArraysInstancedARB =
      _glDrawArraysInstanced;

    var _emscripten_glDrawArraysInstancedARB = _glDrawArraysInstancedARB;

    /** @suppress {duplicate } */ var _glDrawArraysInstancedEXT =
      _glDrawArraysInstanced;

    var _emscripten_glDrawArraysInstancedEXT = _glDrawArraysInstancedEXT;

    /** @suppress {duplicate } */ var _glDrawArraysInstancedNV =
      _glDrawArraysInstanced;

    var _emscripten_glDrawArraysInstancedNV = _glDrawArraysInstancedNV;

    var tempFixedLengthArray = [];

    /** @suppress {duplicate } */ function _glDrawBuffers(n, bufs) {
      bufs >>>= 0;
      var bufArray = tempFixedLengthArray[n];
      for (var i = 0; i < n; i++) {
        bufArray[i] = HEAP32[((bufs + i * 4) >>> 2) >>> 0];
      }
      GLctx.drawBuffers(bufArray);
    }

    var _emscripten_glDrawBuffers = _glDrawBuffers;

    /** @suppress {duplicate } */ var _glDrawBuffersEXT = _glDrawBuffers;

    var _emscripten_glDrawBuffersEXT = _glDrawBuffersEXT;

    /** @suppress {duplicate } */ var _glDrawBuffersWEBGL = _glDrawBuffers;

    var _emscripten_glDrawBuffersWEBGL = _glDrawBuffersWEBGL;

    /** @suppress {duplicate } */ function _glDrawElements(
      mode,
      count,
      type,
      indices
    ) {
      indices >>>= 0;
      var buf;
      if (!GLctx.currentElementArrayBufferBinding) {
        var size = GL.calcBufLength(1, type, 0, count);
        buf = GL.getTempIndexBuffer(size);
        GLctx.bindBuffer(34963, /*GL_ELEMENT_ARRAY_BUFFER*/ buf);
        GLctx.bufferSubData(
          34963,
          0,
          HEAPU8.subarray(indices >>> 0, (indices + size) >>> 0)
        );
        indices = 0;
      }
      GL.preDrawHandleClientVertexAttribBindings(count);
      GLctx.drawElements(mode, count, type, indices);
      GL.postDrawHandleClientVertexAttribBindings(count);
      if (!GLctx.currentElementArrayBufferBinding) {
        GLctx.bindBuffer(34963, /*GL_ELEMENT_ARRAY_BUFFER*/ null);
      }
    }

    var _emscripten_glDrawElements = _glDrawElements;

    /** @suppress {duplicate } */ function _glDrawElementsInstanced(
      mode,
      count,
      type,
      indices,
      primcount
    ) {
      indices >>>= 0;
      GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
    }

    var _emscripten_glDrawElementsInstanced = _glDrawElementsInstanced;

    /** @suppress {duplicate } */ var _glDrawElementsInstancedANGLE =
      _glDrawElementsInstanced;

    var _emscripten_glDrawElementsInstancedANGLE =
      _glDrawElementsInstancedANGLE;

    /** @suppress {duplicate } */ var _glDrawElementsInstancedARB =
      _glDrawElementsInstanced;

    var _emscripten_glDrawElementsInstancedARB = _glDrawElementsInstancedARB;

    /** @suppress {duplicate } */ var _glDrawElementsInstancedEXT =
      _glDrawElementsInstanced;

    var _emscripten_glDrawElementsInstancedEXT = _glDrawElementsInstancedEXT;

    /** @suppress {duplicate } */ var _glDrawElementsInstancedNV =
      _glDrawElementsInstanced;

    var _emscripten_glDrawElementsInstancedNV = _glDrawElementsInstancedNV;

    /** @suppress {duplicate } */ function _glDrawRangeElements(
      mode,
      start,
      end,
      count,
      type,
      indices
    ) {
      indices >>>= 0;
      _glDrawElements(mode, count, type, indices);
    }

    var _emscripten_glDrawRangeElements = _glDrawRangeElements;

    /** @suppress {duplicate } */ function _glEnable(x0) {
      GLctx.enable(x0);
    }

    var _emscripten_glEnable = _glEnable;

    /** @suppress {duplicate } */ var _glEnableVertexAttribArray = (index) => {
      var cb = GL.currentContext.clientBuffers[index];
      cb.enabled = true;
      GLctx.enableVertexAttribArray(index);
    };

    var _emscripten_glEnableVertexAttribArray = _glEnableVertexAttribArray;

    /** @suppress {duplicate } */ function _glEndQuery(x0) {
      GLctx.endQuery(x0);
    }

    var _emscripten_glEndQuery = _glEndQuery;

    /** @suppress {duplicate } */ var _glEndQueryEXT = (target) => {
      GLctx.disjointTimerQueryExt["endQueryEXT"](target);
    };

    var _emscripten_glEndQueryEXT = _glEndQueryEXT;

    /** @suppress {duplicate } */ function _glEndTransformFeedback() {
      GLctx.endTransformFeedback();
    }

    var _emscripten_glEndTransformFeedback = _glEndTransformFeedback;

    /** @suppress {duplicate } */ function _glFenceSync(condition, flags) {
      var sync = GLctx.fenceSync(condition, flags);
      if (sync) {
        var id = GL.getNewId(GL.syncs);
        sync.name = id;
        GL.syncs[id] = sync;
        return id;
      }
      return 0;
    }

    var _emscripten_glFenceSync = _glFenceSync;

    /** @suppress {duplicate } */ function _glFinish() {
      GLctx.finish();
    }

    var _emscripten_glFinish = _glFinish;

    /** @suppress {duplicate } */ function _glFlush() {
      GLctx.flush();
    }

    var _emscripten_glFlush = _glFlush;

    var emscriptenWebGLGetBufferBinding = (target) => {
      switch (target) {
        case 34962:
          /*GL_ARRAY_BUFFER*/ target = 34964;
          /*GL_ARRAY_BUFFER_BINDING*/ break;

        case 34963:
          /*GL_ELEMENT_ARRAY_BUFFER*/ target = 34965;
          /*GL_ELEMENT_ARRAY_BUFFER_BINDING*/ break;

        case 35051:
          /*GL_PIXEL_PACK_BUFFER*/ target = 35053;
          /*GL_PIXEL_PACK_BUFFER_BINDING*/ break;

        case 35052:
          /*GL_PIXEL_UNPACK_BUFFER*/ target = 35055;
          /*GL_PIXEL_UNPACK_BUFFER_BINDING*/ break;

        case 35982:
          /*GL_TRANSFORM_FEEDBACK_BUFFER*/ target = 35983;
          /*GL_TRANSFORM_FEEDBACK_BUFFER_BINDING*/ break;

        case 36662:
          /*GL_COPY_READ_BUFFER*/ target = 36662;
          /*GL_COPY_READ_BUFFER_BINDING*/ break;

        case 36663:
          /*GL_COPY_WRITE_BUFFER*/ target = 36663;
          /*GL_COPY_WRITE_BUFFER_BINDING*/ break;

        case 35345:
          /*GL_UNIFORM_BUFFER*/ target = 35368;
          /*GL_UNIFORM_BUFFER_BINDING*/ break;
      }
      var buffer = GLctx.getParameter(target);
      if (buffer) return buffer.name | 0;
      else return 0;
    };

    var emscriptenWebGLValidateMapBufferTarget = (target) => {
      switch (target) {
        case 34962:
        case 34963:
        case 36662:
        case 36663:
        case 35051:
        case 35052:
        case 35882:
        case 35982:
        case 35345:
          return true;

        default:
          return false;
      }
    };

    /** @suppress {duplicate } */ function _glFlushMappedBufferRange(
      target,
      offset,
      length
    ) {
      offset >>>= 0;
      length >>>= 0;
      if (!emscriptenWebGLValidateMapBufferTarget(target)) {
        GL.recordError(1280);
        /*GL_INVALID_ENUM*/ err("GL_INVALID_ENUM in glFlushMappedBufferRange");
        return;
      }
      var mapping = GL.mappedBuffers[emscriptenWebGLGetBufferBinding(target)];
      if (!mapping) {
        GL.recordError(1282);
        /* GL_INVALID_OPERATION */ err(
          "buffer was never mapped in glFlushMappedBufferRange"
        );
        return;
      }
      if (!(mapping.access & 16)) {
        GL.recordError(1282);
        /* GL_INVALID_OPERATION */ err(
          "buffer was not mapped with GL_MAP_FLUSH_EXPLICIT_BIT in glFlushMappedBufferRange"
        );
        return;
      }
      if (offset < 0 || length < 0 || offset + length > mapping.length) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ err("invalid range in glFlushMappedBufferRange");
        return;
      }
      GLctx.bufferSubData(
        target,
        mapping.offset,
        HEAPU8.subarray(
          (mapping.mem + offset) >>> 0,
          (mapping.mem + offset + length) >>> 0
        )
      );
    }

    var _emscripten_glFlushMappedBufferRange = _glFlushMappedBufferRange;

    /** @suppress {duplicate } */ var _glFramebufferRenderbuffer = (
      target,
      attachment,
      renderbuffertarget,
      renderbuffer
    ) => {
      GLctx.framebufferRenderbuffer(
        target,
        attachment,
        renderbuffertarget,
        GL.renderbuffers[renderbuffer]
      );
    };

    var _emscripten_glFramebufferRenderbuffer = _glFramebufferRenderbuffer;

    /** @suppress {duplicate } */ var _glFramebufferTexture2D = (
      target,
      attachment,
      textarget,
      texture,
      level
    ) => {
      GLctx.framebufferTexture2D(
        target,
        attachment,
        textarget,
        GL.textures[texture],
        level
      );
    };

    var _emscripten_glFramebufferTexture2D = _glFramebufferTexture2D;

    /** @suppress {duplicate } */ var _glFramebufferTextureLayer = (
      target,
      attachment,
      texture,
      level,
      layer
    ) => {
      GLctx.framebufferTextureLayer(
        target,
        attachment,
        GL.textures[texture],
        level,
        layer
      );
    };

    var _emscripten_glFramebufferTextureLayer = _glFramebufferTextureLayer;

    /** @suppress {duplicate } */ function _glFrontFace(x0) {
      GLctx.frontFace(x0);
    }

    var _emscripten_glFrontFace = _glFrontFace;

    var __glGenObject = (n, buffers, createFunction, objectTable) => {
      for (var i = 0; i < n; i++) {
        var buffer = GLctx[createFunction]();
        var id = buffer && GL.getNewId(objectTable);
        if (buffer) {
          buffer.name = id;
          objectTable[id] = buffer;
        } else {
          GL.recordError(1282);
        }
        HEAP32[((buffers + i * 4) >>> 2) >>> 0] = id;
      }
    };

    /** @suppress {duplicate } */ function _glGenBuffers(n, buffers) {
      buffers >>>= 0;
      __glGenObject(n, buffers, "createBuffer", GL.buffers);
    }

    var _emscripten_glGenBuffers = _glGenBuffers;

    /** @suppress {duplicate } */ function _glGenFramebuffers(n, ids) {
      ids >>>= 0;
      __glGenObject(n, ids, "createFramebuffer", GL.framebuffers);
    }

    var _emscripten_glGenFramebuffers = _glGenFramebuffers;

    /** @suppress {duplicate } */ function _glGenQueries(n, ids) {
      ids >>>= 0;
      __glGenObject(n, ids, "createQuery", GL.queries);
    }

    var _emscripten_glGenQueries = _glGenQueries;

    /** @suppress {duplicate } */ function _glGenQueriesEXT(n, ids) {
      ids >>>= 0;
      for (var i = 0; i < n; i++) {
        var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
        if (!query) {
          GL.recordError(1282);
          /* GL_INVALID_OPERATION */ while (i < n)
            HEAP32[((ids + i++ * 4) >>> 2) >>> 0] = 0;
          return;
        }
        var id = GL.getNewId(GL.queries);
        query.name = id;
        GL.queries[id] = query;
        HEAP32[((ids + i * 4) >>> 2) >>> 0] = id;
      }
    }

    var _emscripten_glGenQueriesEXT = _glGenQueriesEXT;

    /** @suppress {duplicate } */ function _glGenRenderbuffers(
      n,
      renderbuffers
    ) {
      renderbuffers >>>= 0;
      __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
    }

    var _emscripten_glGenRenderbuffers = _glGenRenderbuffers;

    /** @suppress {duplicate } */ function _glGenSamplers(n, samplers) {
      samplers >>>= 0;
      __glGenObject(n, samplers, "createSampler", GL.samplers);
    }

    var _emscripten_glGenSamplers = _glGenSamplers;

    /** @suppress {duplicate } */ function _glGenTextures(n, textures) {
      textures >>>= 0;
      __glGenObject(n, textures, "createTexture", GL.textures);
    }

    var _emscripten_glGenTextures = _glGenTextures;

    /** @suppress {duplicate } */ function _glGenTransformFeedbacks(n, ids) {
      ids >>>= 0;
      __glGenObject(n, ids, "createTransformFeedback", GL.transformFeedbacks);
    }

    var _emscripten_glGenTransformFeedbacks = _glGenTransformFeedbacks;

    /** @suppress {duplicate } */ function _glGenVertexArrays(n, arrays) {
      arrays >>>= 0;
      __glGenObject(n, arrays, "createVertexArray", GL.vaos);
    }

    var _emscripten_glGenVertexArrays = _glGenVertexArrays;

    /** @suppress {duplicate } */ var _glGenVertexArraysOES =
      _glGenVertexArrays;

    var _emscripten_glGenVertexArraysOES = _glGenVertexArraysOES;

    /** @suppress {duplicate } */ function _glGenerateMipmap(x0) {
      GLctx.generateMipmap(x0);
    }

    var _emscripten_glGenerateMipmap = _glGenerateMipmap;

    var __glGetActiveAttribOrUniform = (
      funcName,
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) => {
      program = GL.programs[program];
      var info = GLctx[funcName](program, index);
      if (info) {
        var numBytesWrittenExclNull =
          name && stringToUTF8(info.name, name, bufSize);
        if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
        if (size) HEAP32[(size >>> 2) >>> 0] = info.size;
        if (type) HEAP32[(type >>> 2) >>> 0] = info.type;
      }
    };

    /** @suppress {duplicate } */ function _glGetActiveAttrib(
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) {
      length >>>= 0;
      size >>>= 0;
      type >>>= 0;
      name >>>= 0;
      __glGetActiveAttribOrUniform(
        "getActiveAttrib",
        program,
        index,
        bufSize,
        length,
        size,
        type,
        name
      );
    }

    var _emscripten_glGetActiveAttrib = _glGetActiveAttrib;

    /** @suppress {duplicate } */ function _glGetActiveUniform(
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) {
      length >>>= 0;
      size >>>= 0;
      type >>>= 0;
      name >>>= 0;
      __glGetActiveAttribOrUniform(
        "getActiveUniform",
        program,
        index,
        bufSize,
        length,
        size,
        type,
        name
      );
    }

    var _emscripten_glGetActiveUniform = _glGetActiveUniform;

    /** @suppress {duplicate } */ function _glGetActiveUniformBlockName(
      program,
      uniformBlockIndex,
      bufSize,
      length,
      uniformBlockName
    ) {
      length >>>= 0;
      uniformBlockName >>>= 0;
      program = GL.programs[program];
      var result = GLctx.getActiveUniformBlockName(program, uniformBlockIndex);
      if (!result) return;
      if (uniformBlockName && bufSize > 0) {
        var numBytesWrittenExclNull = stringToUTF8(
          result,
          uniformBlockName,
          bufSize
        );
        if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
      } else {
        if (length) HEAP32[(length >>> 2) >>> 0] = 0;
      }
    }

    var _emscripten_glGetActiveUniformBlockName = _glGetActiveUniformBlockName;

    /** @suppress {duplicate } */ function _glGetActiveUniformBlockiv(
      program,
      uniformBlockIndex,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      program = GL.programs[program];
      if (pname == 35393) {
        /* GL_UNIFORM_BLOCK_NAME_LENGTH */ var name =
          GLctx.getActiveUniformBlockName(program, uniformBlockIndex);
        HEAP32[(params >>> 2) >>> 0] = name.length + 1;
        return;
      }
      var result = GLctx.getActiveUniformBlockParameter(
        program,
        uniformBlockIndex,
        pname
      );
      if (result === null) return;
      if (pname == 35395) {
        /*GL_UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES*/ for (
          var i = 0;
          i < result.length;
          i++
        ) {
          HEAP32[((params + i * 4) >>> 2) >>> 0] = result[i];
        }
      } else {
        HEAP32[(params >>> 2) >>> 0] = result;
      }
    }

    var _emscripten_glGetActiveUniformBlockiv = _glGetActiveUniformBlockiv;

    /** @suppress {duplicate } */ function _glGetActiveUniformsiv(
      program,
      uniformCount,
      uniformIndices,
      pname,
      params
    ) {
      uniformIndices >>>= 0;
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (uniformCount > 0 && uniformIndices == 0) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      program = GL.programs[program];
      var ids = [];
      for (var i = 0; i < uniformCount; i++) {
        ids.push(HEAP32[((uniformIndices + i * 4) >>> 2) >>> 0]);
      }
      var result = GLctx.getActiveUniforms(program, ids, pname);
      if (!result) return;
      var len = result.length;
      for (var i = 0; i < len; i++) {
        HEAP32[((params + i * 4) >>> 2) >>> 0] = result[i];
      }
    }

    var _emscripten_glGetActiveUniformsiv = _glGetActiveUniformsiv;

    /** @suppress {duplicate } */ function _glGetAttachedShaders(
      program,
      maxCount,
      count,
      shaders
    ) {
      count >>>= 0;
      shaders >>>= 0;
      var result = GLctx.getAttachedShaders(GL.programs[program]);
      var len = result.length;
      if (len > maxCount) {
        len = maxCount;
      }
      HEAP32[(count >>> 2) >>> 0] = len;
      for (var i = 0; i < len; ++i) {
        var id = GL.shaders.indexOf(result[i]);
        HEAP32[((shaders + i * 4) >>> 2) >>> 0] = id;
      }
    }

    var _emscripten_glGetAttachedShaders = _glGetAttachedShaders;

    /** @suppress {duplicate } */ function _glGetAttribLocation(program, name) {
      name >>>= 0;
      return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
    }

    var _emscripten_glGetAttribLocation = _glGetAttribLocation;

    var writeI53ToI64 = (ptr, num) => {
      HEAPU32[(ptr >>> 2) >>> 0] = num;
      var lower = HEAPU32[(ptr >>> 2) >>> 0];
      HEAPU32[((ptr + 4) >>> 2) >>> 0] = (num - lower) / 4294967296;
    };

    var webglGetExtensions = function $webglGetExtensions() {
      var exts = getEmscriptenSupportedExtensions(GLctx);
      exts = exts.concat(exts.map((e) => "GL_" + e));
      return exts;
    };

    var emscriptenWebGLGet = (name_, p, type) => {
      if (!p) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var ret = undefined;
      switch (name_) {
        case 36346:
          ret = 1;
          break;

        case 36344:
          if (type != 0 && type != 1) {
            GL.recordError(1280);
          }
          return;

        case 34814:
        case 36345:
          ret = 0;
          break;

        case 34466:
          var formats = GLctx.getParameter(34467);
          /*GL_COMPRESSED_TEXTURE_FORMATS*/ ret = formats ? formats.length : 0;
          break;

        case 33309:
          if (GL.currentContext.version < 2) {
            GL.recordError(1282);
            /* GL_INVALID_OPERATION */ return;
          }
          ret = webglGetExtensions().length;
          break;

        case 33307:
        case 33308:
          if (GL.currentContext.version < 2) {
            GL.recordError(1280);
            return;
          }
          ret = name_ == 33307 ? 3 : 0;
          break;
      }
      if (ret === undefined) {
        var result = GLctx.getParameter(name_);
        switch (typeof result) {
          case "number":
            ret = result;
            break;

          case "boolean":
            ret = result ? 1 : 0;
            break;

          case "string":
            GL.recordError(1280);
            return;

          case "object":
            if (result === null) {
              switch (name_) {
                case 34964:
                case 35725:
                case 34965:
                case 36006:
                case 36007:
                case 32873:
                case 34229:
                case 36662:
                case 36663:
                case 35053:
                case 35055:
                case 36010:
                case 35097:
                case 35869:
                case 32874:
                case 36389:
                case 35983:
                case 35368:
                case 34068: {
                  ret = 0;
                  break;
                }

                default: {
                  GL.recordError(1280);
                  return;
                }
              }
            } else if (
              result instanceof Float32Array ||
              result instanceof Uint32Array ||
              result instanceof Int32Array ||
              result instanceof Array
            ) {
              for (var i = 0; i < result.length; ++i) {
                switch (type) {
                  case 0:
                    HEAP32[((p + i * 4) >>> 2) >>> 0] = result[i];
                    break;

                  case 2:
                    HEAPF32[((p + i * 4) >>> 2) >>> 0] = result[i];
                    break;

                  case 4:
                    HEAP8[((p + i) >>> 0) >>> 0] = result[i] ? 1 : 0;
                    break;
                }
              }
              return;
            } else {
              try {
                ret = result.name | 0;
              } catch (e) {
                GL.recordError(1280);
                err(
                  `GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`
                );
                return;
              }
            }
            break;

          default:
            GL.recordError(1280);
            err(
              `GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof result}!`
            );
            return;
        }
      }
      switch (type) {
        case 1:
          writeI53ToI64(p, ret);
          break;

        case 0:
          HEAP32[(p >>> 2) >>> 0] = ret;
          break;

        case 2:
          HEAPF32[(p >>> 2) >>> 0] = ret;
          break;

        case 4:
          HEAP8[(p >>> 0) >>> 0] = ret ? 1 : 0;
          break;
      }
    };

    /** @suppress {duplicate } */ function _glGetBooleanv(name_, p) {
      p >>>= 0;
      return emscriptenWebGLGet(name_, p, 4);
    }

    var _emscripten_glGetBooleanv = _glGetBooleanv;

    /** @suppress {duplicate } */ function _glGetBufferParameteri64v(
      target,
      value,
      data
    ) {
      data >>>= 0;
      if (!data) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      writeI53ToI64(data, GLctx.getBufferParameter(target, value));
    }

    var _emscripten_glGetBufferParameteri64v = _glGetBufferParameteri64v;

    /** @suppress {duplicate } */ function _glGetBufferParameteriv(
      target,
      value,
      data
    ) {
      data >>>= 0;
      if (!data) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(data >>> 2) >>> 0] = GLctx.getBufferParameter(target, value);
    }

    var _emscripten_glGetBufferParameteriv = _glGetBufferParameteriv;

    /** @suppress {duplicate } */ function _glGetBufferPointerv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (pname == 35005) {
        /*GL_BUFFER_MAP_POINTER*/ var ptr = 0;
        var mappedBuffer =
          GL.mappedBuffers[emscriptenWebGLGetBufferBinding(target)];
        if (mappedBuffer) {
          ptr = mappedBuffer.mem;
        }
        HEAP32[(params >>> 2) >>> 0] = ptr;
      } else {
        GL.recordError(1280);
        /*GL_INVALID_ENUM*/ err("GL_INVALID_ENUM in glGetBufferPointerv");
      }
    }

    var _emscripten_glGetBufferPointerv = _glGetBufferPointerv;

    /** @suppress {duplicate } */ var _glGetError = () => {
      var error = GLctx.getError() || GL.lastError;
      GL.lastError = 0;
      /*GL_NO_ERROR*/ return error;
    };

    var _emscripten_glGetError = _glGetError;

    /** @suppress {duplicate } */ function _glGetFloatv(name_, p) {
      p >>>= 0;
      return emscriptenWebGLGet(name_, p, 2);
    }

    var _emscripten_glGetFloatv = _glGetFloatv;

    /** @suppress {duplicate } */ function _glGetFragDataLocation(
      program,
      name
    ) {
      name >>>= 0;
      return GLctx.getFragDataLocation(
        GL.programs[program],
        UTF8ToString(name)
      );
    }

    var _emscripten_glGetFragDataLocation = _glGetFragDataLocation;

    /** @suppress {duplicate } */ function _glGetFramebufferAttachmentParameteriv(
      target,
      attachment,
      pname,
      params
    ) {
      params >>>= 0;
      var result = GLctx.getFramebufferAttachmentParameter(
        target,
        attachment,
        pname
      );
      if (
        result instanceof WebGLRenderbuffer ||
        result instanceof WebGLTexture
      ) {
        result = result.name | 0;
      }
      HEAP32[(params >>> 2) >>> 0] = result;
    }

    var _emscripten_glGetFramebufferAttachmentParameteriv =
      _glGetFramebufferAttachmentParameteriv;

    var emscriptenWebGLGetIndexed = (target, index, data, type) => {
      if (!data) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var result = GLctx.getIndexedParameter(target, index);
      var ret;
      switch (typeof result) {
        case "boolean":
          ret = result ? 1 : 0;
          break;

        case "number":
          ret = result;
          break;

        case "object":
          if (result === null) {
            switch (target) {
              case 35983:
              case 35368:
                ret = 0;
                break;

              default: {
                GL.recordError(1280);
                return;
              }
            }
          } else if (result instanceof WebGLBuffer) {
            ret = result.name | 0;
          } else {
            GL.recordError(1280);
            return;
          }
          break;

        default:
          GL.recordError(1280);
          return;
      }
      switch (type) {
        case 1:
          writeI53ToI64(data, ret);
          break;

        case 0:
          HEAP32[(data >>> 2) >>> 0] = ret;
          break;

        case 2:
          HEAPF32[(data >>> 2) >>> 0] = ret;
          break;

        case 4:
          HEAP8[(data >>> 0) >>> 0] = ret ? 1 : 0;
          break;

        default:
          throw "internal emscriptenWebGLGetIndexed() error, bad type: " + type;
      }
    };

    /** @suppress {duplicate } */ function _glGetInteger64i_v(
      target,
      index,
      data
    ) {
      data >>>= 0;
      return emscriptenWebGLGetIndexed(target, index, data, 1);
    }

    var _emscripten_glGetInteger64i_v = _glGetInteger64i_v;

    /** @suppress {duplicate } */ function _glGetInteger64v(name_, p) {
      p >>>= 0;
      emscriptenWebGLGet(name_, p, 1);
    }

    var _emscripten_glGetInteger64v = _glGetInteger64v;

    /** @suppress {duplicate } */ function _glGetIntegeri_v(
      target,
      index,
      data
    ) {
      data >>>= 0;
      return emscriptenWebGLGetIndexed(target, index, data, 0);
    }

    var _emscripten_glGetIntegeri_v = _glGetIntegeri_v;

    /** @suppress {duplicate } */ function _glGetIntegerv(name_, p) {
      p >>>= 0;
      return emscriptenWebGLGet(name_, p, 0);
    }

    var _emscripten_glGetIntegerv = _glGetIntegerv;

    /** @suppress {duplicate } */ function _glGetInternalformativ(
      target,
      internalformat,
      pname,
      bufSize,
      params
    ) {
      params >>>= 0;
      if (bufSize < 0) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var ret = GLctx.getInternalformatParameter(target, internalformat, pname);
      if (ret === null) return;
      for (var i = 0; i < ret.length && i < bufSize; ++i) {
        HEAP32[((params + i * 4) >>> 2) >>> 0] = ret[i];
      }
    }

    var _emscripten_glGetInternalformativ = _glGetInternalformativ;

    /** @suppress {duplicate } */ function _glGetProgramBinary(
      program,
      bufSize,
      length,
      binaryFormat,
      binary
    ) {
      length >>>= 0;
      binaryFormat >>>= 0;
      binary >>>= 0;
      GL.recordError(1282);
    }

    var _emscripten_glGetProgramBinary = _glGetProgramBinary;

    /** @suppress {duplicate } */ function _glGetProgramInfoLog(
      program,
      maxLength,
      length,
      infoLog
    ) {
      length >>>= 0;
      infoLog >>>= 0;
      var log = GLctx.getProgramInfoLog(GL.programs[program]);
      if (log === null) log = "(unknown error)";
      var numBytesWrittenExclNull =
        maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
    }

    var _emscripten_glGetProgramInfoLog = _glGetProgramInfoLog;

    /** @suppress {duplicate } */ function _glGetProgramiv(program, pname, p) {
      p >>>= 0;
      if (!p) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (program >= GL.counter) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      program = GL.programs[program];
      if (pname == 35716) {
        var log = GLctx.getProgramInfoLog(program);
        if (log === null) log = "(unknown error)";
        HEAP32[(p >>> 2) >>> 0] = log.length + 1;
      } else if (pname == 35719) {
        /* GL_ACTIVE_UNIFORM_MAX_LENGTH */ if (!program.maxUniformLength) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35718);
            /*GL_ACTIVE_UNIFORMS*/ ++i
          ) {
            program.maxUniformLength = Math.max(
              program.maxUniformLength,
              GLctx.getActiveUniform(program, i).name.length + 1
            );
          }
        }
        HEAP32[(p >>> 2) >>> 0] = program.maxUniformLength;
      } else if (pname == 35722) {
        /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */ if (!program.maxAttributeLength) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35721);
            /*GL_ACTIVE_ATTRIBUTES*/ ++i
          ) {
            program.maxAttributeLength = Math.max(
              program.maxAttributeLength,
              GLctx.getActiveAttrib(program, i).name.length + 1
            );
          }
        }
        HEAP32[(p >>> 2) >>> 0] = program.maxAttributeLength;
      } else if (pname == 35381) {
        /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */ if (
          !program.maxUniformBlockNameLength
        ) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35382);
            /*GL_ACTIVE_UNIFORM_BLOCKS*/ ++i
          ) {
            program.maxUniformBlockNameLength = Math.max(
              program.maxUniformBlockNameLength,
              GLctx.getActiveUniformBlockName(program, i).length + 1
            );
          }
        }
        HEAP32[(p >>> 2) >>> 0] = program.maxUniformBlockNameLength;
      } else {
        HEAP32[(p >>> 2) >>> 0] = GLctx.getProgramParameter(program, pname);
      }
    }

    var _emscripten_glGetProgramiv = _glGetProgramiv;

    /** @suppress {duplicate } */ function _glGetQueryObjecti64vEXT(
      id,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var query = GL.queries[id];
      var param;
      if (GL.currentContext.version < 2) {
        param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
      } else {
        param = GLctx.getQueryParameter(query, pname);
      }
      var ret;
      if (typeof param == "boolean") {
        ret = param ? 1 : 0;
      } else {
        ret = param;
      }
      writeI53ToI64(params, ret);
    }

    var _emscripten_glGetQueryObjecti64vEXT = _glGetQueryObjecti64vEXT;

    /** @suppress {duplicate } */ function _glGetQueryObjectivEXT(
      id,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var query = GL.queries[id];
      var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](
        query,
        pname
      );
      var ret;
      if (typeof param == "boolean") {
        ret = param ? 1 : 0;
      } else {
        ret = param;
      }
      HEAP32[(params >>> 2) >>> 0] = ret;
    }

    var _emscripten_glGetQueryObjectivEXT = _glGetQueryObjectivEXT;

    /** @suppress {duplicate } */ var _glGetQueryObjectui64vEXT =
      _glGetQueryObjecti64vEXT;

    var _emscripten_glGetQueryObjectui64vEXT = _glGetQueryObjectui64vEXT;

    /** @suppress {duplicate } */ function _glGetQueryObjectuiv(
      id,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var query = GL.queries[id];
      var param = GLctx.getQueryParameter(query, pname);
      var ret;
      if (typeof param == "boolean") {
        ret = param ? 1 : 0;
      } else {
        ret = param;
      }
      HEAP32[(params >>> 2) >>> 0] = ret;
    }

    var _emscripten_glGetQueryObjectuiv = _glGetQueryObjectuiv;

    /** @suppress {duplicate } */ var _glGetQueryObjectuivEXT =
      _glGetQueryObjectivEXT;

    var _emscripten_glGetQueryObjectuivEXT = _glGetQueryObjectuivEXT;

    /** @suppress {duplicate } */ function _glGetQueryiv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(params >>> 2) >>> 0] = GLctx.getQuery(target, pname);
    }

    var _emscripten_glGetQueryiv = _glGetQueryiv;

    /** @suppress {duplicate } */ function _glGetQueryivEXT(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(params >>> 2) >>> 0] = GLctx.disjointTimerQueryExt["getQueryEXT"](
        target,
        pname
      );
    }

    var _emscripten_glGetQueryivEXT = _glGetQueryivEXT;

    /** @suppress {duplicate } */ function _glGetRenderbufferParameteriv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(params >>> 2) >>> 0] = GLctx.getRenderbufferParameter(
        target,
        pname
      );
    }

    var _emscripten_glGetRenderbufferParameteriv =
      _glGetRenderbufferParameteriv;

    /** @suppress {duplicate } */ function _glGetSamplerParameterfv(
      sampler,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAPF32[(params >>> 2) >>> 0] = GLctx.getSamplerParameter(
        GL.samplers[sampler],
        pname
      );
    }

    var _emscripten_glGetSamplerParameterfv = _glGetSamplerParameterfv;

    /** @suppress {duplicate } */ function _glGetSamplerParameteriv(
      sampler,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(params >>> 2) >>> 0] = GLctx.getSamplerParameter(
        GL.samplers[sampler],
        pname
      );
    }

    var _emscripten_glGetSamplerParameteriv = _glGetSamplerParameteriv;

    /** @suppress {duplicate } */ function _glGetShaderInfoLog(
      shader,
      maxLength,
      length,
      infoLog
    ) {
      length >>>= 0;
      infoLog >>>= 0;
      var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
      if (log === null) log = "(unknown error)";
      var numBytesWrittenExclNull =
        maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
    }

    var _emscripten_glGetShaderInfoLog = _glGetShaderInfoLog;

    /** @suppress {duplicate } */ function _glGetShaderPrecisionFormat(
      shaderType,
      precisionType,
      range,
      precision
    ) {
      range >>>= 0;
      precision >>>= 0;
      var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
      HEAP32[(range >>> 2) >>> 0] = result.rangeMin;
      HEAP32[((range + 4) >>> 2) >>> 0] = result.rangeMax;
      HEAP32[(precision >>> 2) >>> 0] = result.precision;
    }

    var _emscripten_glGetShaderPrecisionFormat = _glGetShaderPrecisionFormat;

    /** @suppress {duplicate } */ function _glGetShaderSource(
      shader,
      bufSize,
      length,
      source
    ) {
      length >>>= 0;
      source >>>= 0;
      var result = GLctx.getShaderSource(GL.shaders[shader]);
      if (!result) return;
      var numBytesWrittenExclNull =
        bufSize > 0 && source ? stringToUTF8(result, source, bufSize) : 0;
      if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
    }

    var _emscripten_glGetShaderSource = _glGetShaderSource;

    /** @suppress {duplicate } */ function _glGetShaderiv(shader, pname, p) {
      p >>>= 0;
      if (!p) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (pname == 35716) {
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null) log = "(unknown error)";
        var logLength = log ? log.length + 1 : 0;
        HEAP32[(p >>> 2) >>> 0] = logLength;
      } else if (pname == 35720) {
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        var sourceLength = source ? source.length + 1 : 0;
        HEAP32[(p >>> 2) >>> 0] = sourceLength;
      } else {
        HEAP32[(p >>> 2) >>> 0] = GLctx.getShaderParameter(
          GL.shaders[shader],
          pname
        );
      }
    }

    var _emscripten_glGetShaderiv = _glGetShaderiv;

    /** @suppress {duplicate } */ function _glGetString(name_) {
      var ret = GL.stringCache[name_];
      if (!ret) {
        switch (name_) {
          case 7939:
            /* GL_EXTENSIONS */ ret = stringToNewUTF8(
              webglGetExtensions().join(" ")
            );
            break;

          case 7936:
          /* GL_VENDOR */ case 7937:
          /* GL_RENDERER */ case 37445:
          /* UNMASKED_VENDOR_WEBGL */ case 37446:
            /* UNMASKED_RENDERER_WEBGL */ var s = GLctx.getParameter(name_);
            if (!s) {
              GL.recordError(1280);
            }
            ret = s ? stringToNewUTF8(s) : 0;
            break;

          case 7938:
            /* GL_VERSION */ var glVersion = GLctx.getParameter(7938);
            if (true) glVersion = `OpenGL ES 3.0 (${glVersion})`;
            else {
              glVersion = `OpenGL ES 2.0 (${glVersion})`;
            }
            ret = stringToNewUTF8(glVersion);
            break;

          case 35724:
            /* GL_SHADING_LANGUAGE_VERSION */ var glslVersion =
              GLctx.getParameter(35724);
            var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
            var ver_num = glslVersion.match(ver_re);
            if (ver_num !== null) {
              if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
              glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
            }
            ret = stringToNewUTF8(glslVersion);
            break;

          default:
            GL.recordError(1280);
        }
        GL.stringCache[name_] = ret;
      }
      return ret;
    }

    var _emscripten_glGetString = _glGetString;

    /** @suppress {duplicate } */ function _glGetStringi(name, index) {
      if (GL.currentContext.version < 2) {
        GL.recordError(1282);
        return 0;
      }
      var stringiCache = GL.stringiCache[name];
      if (stringiCache) {
        if (index < 0 || index >= stringiCache.length) {
          GL.recordError(1281);
          /*GL_INVALID_VALUE*/ return 0;
        }
        return stringiCache[index];
      }
      switch (name) {
        case 7939:
          /* GL_EXTENSIONS */ var exts =
            webglGetExtensions().map(stringToNewUTF8);
          stringiCache = GL.stringiCache[name] = exts;
          if (index < 0 || index >= stringiCache.length) {
            GL.recordError(1281);
            /*GL_INVALID_VALUE*/ return 0;
          }
          return stringiCache[index];

        default:
          GL.recordError(1280);
          /*GL_INVALID_ENUM*/ return 0;
      }
    }

    var _emscripten_glGetStringi = _glGetStringi;

    /** @suppress {duplicate } */ function _glGetSynciv(
      sync,
      pname,
      bufSize,
      length,
      values
    ) {
      sync >>>= 0;
      length >>>= 0;
      values >>>= 0;
      if (bufSize < 0) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (!values) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      var ret = GLctx.getSyncParameter(GL.syncs[sync], pname);
      if (ret !== null) {
        HEAP32[(values >>> 2) >>> 0] = ret;
        if (length) HEAP32[(length >>> 2) >>> 0] = 1;
      }
    }

    var _emscripten_glGetSynciv = _glGetSynciv;

    /** @suppress {duplicate } */ function _glGetTexParameterfv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAPF32[(params >>> 2) >>> 0] = GLctx.getTexParameter(target, pname);
    }

    var _emscripten_glGetTexParameterfv = _glGetTexParameterfv;

    /** @suppress {duplicate } */ function _glGetTexParameteriv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      HEAP32[(params >>> 2) >>> 0] = GLctx.getTexParameter(target, pname);
    }

    var _emscripten_glGetTexParameteriv = _glGetTexParameteriv;

    /** @suppress {duplicate } */ function _glGetTransformFeedbackVarying(
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) {
      length >>>= 0;
      size >>>= 0;
      type >>>= 0;
      name >>>= 0;
      program = GL.programs[program];
      var info = GLctx.getTransformFeedbackVarying(program, index);
      if (!info) return;
      if (name && bufSize > 0) {
        var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
        if (length) HEAP32[(length >>> 2) >>> 0] = numBytesWrittenExclNull;
      } else {
        if (length) HEAP32[(length >>> 2) >>> 0] = 0;
      }
      if (size) HEAP32[(size >>> 2) >>> 0] = info.size;
      if (type) HEAP32[(type >>> 2) >>> 0] = info.type;
    }

    var _emscripten_glGetTransformFeedbackVarying =
      _glGetTransformFeedbackVarying;

    /** @suppress {duplicate } */ function _glGetUniformBlockIndex(
      program,
      uniformBlockName
    ) {
      uniformBlockName >>>= 0;
      return GLctx.getUniformBlockIndex(
        GL.programs[program],
        UTF8ToString(uniformBlockName)
      );
    }

    var _emscripten_glGetUniformBlockIndex = _glGetUniformBlockIndex;

    /** @suppress {duplicate } */ function _glGetUniformIndices(
      program,
      uniformCount,
      uniformNames,
      uniformIndices
    ) {
      uniformNames >>>= 0;
      uniformIndices >>>= 0;
      if (!uniformIndices) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (uniformCount > 0 && (uniformNames == 0 || uniformIndices == 0)) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      program = GL.programs[program];
      var names = [];
      for (var i = 0; i < uniformCount; i++)
        names.push(UTF8ToString(HEAP32[((uniformNames + i * 4) >>> 2) >>> 0]));
      var result = GLctx.getUniformIndices(program, names);
      if (!result) return;
      var len = result.length;
      for (var i = 0; i < len; i++) {
        HEAP32[((uniformIndices + i * 4) >>> 2) >>> 0] = result[i];
      }
    }

    var _emscripten_glGetUniformIndices = _glGetUniformIndices;

    /** @suppress {checkTypes} */ var jstoi_q = (str) => parseInt(str);

    /** @noinline */ var webglGetLeftBracePos = (name) =>
      name.slice(-1) == "]" && name.lastIndexOf("[");

    var webglPrepareUniformLocationsBeforeFirstUse = (program) => {
      var uniformLocsById = program.uniformLocsById,
        uniformSizeAndIdsByName = program.uniformSizeAndIdsByName,
        i,
        j;
      if (!uniformLocsById) {
        program.uniformLocsById = uniformLocsById = {};
        program.uniformArrayNamesById = {};
        for (
          i = 0;
          i < GLctx.getProgramParameter(program, 35718);
          /*GL_ACTIVE_UNIFORMS*/ ++i
        ) {
          var u = GLctx.getActiveUniform(program, i);
          var nm = u.name;
          var sz = u.size;
          var lb = webglGetLeftBracePos(nm);
          var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
          var id = program.uniformIdCounter;
          program.uniformIdCounter += sz;
          uniformSizeAndIdsByName[arrayName] = [sz, id];
          for (j = 0; j < sz; ++j) {
            uniformLocsById[id] = j;
            program.uniformArrayNamesById[id++] = arrayName;
          }
        }
      }
    };

    /** @suppress {duplicate } */ function _glGetUniformLocation(
      program,
      name
    ) {
      name >>>= 0;
      name = UTF8ToString(name);
      if ((program = GL.programs[program])) {
        webglPrepareUniformLocationsBeforeFirstUse(program);
        var uniformLocsById = program.uniformLocsById;
        var arrayIndex = 0;
        var uniformBaseName = name;
        var leftBrace = webglGetLeftBracePos(name);
        if (leftBrace > 0) {
          arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
          uniformBaseName = name.slice(0, leftBrace);
        }
        var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
        if (sizeAndId && arrayIndex < sizeAndId[0]) {
          arrayIndex += sizeAndId[1];
          if (
            (uniformLocsById[arrayIndex] =
              uniformLocsById[arrayIndex] ||
              GLctx.getUniformLocation(program, name))
          ) {
            return arrayIndex;
          }
        }
      } else {
        GL.recordError(1281);
      }
      /* GL_INVALID_VALUE */ return -1;
    }

    var _emscripten_glGetUniformLocation = _glGetUniformLocation;

    var webglGetUniformLocation = (location) => {
      var p = GLctx.currentProgram;
      if (p) {
        var webglLoc = p.uniformLocsById[location];
        if (typeof webglLoc == "number") {
          p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(
            p,
            p.uniformArrayNamesById[location] +
              (webglLoc > 0 ? `[${webglLoc}]` : "")
          );
        }
        return webglLoc;
      } else {
        GL.recordError(1282);
      }
    };

    /** @suppress{checkTypes} */ var emscriptenWebGLGetUniform = (
      program,
      location,
      params,
      type
    ) => {
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      program = GL.programs[program];
      webglPrepareUniformLocationsBeforeFirstUse(program);
      var data = GLctx.getUniform(program, webglGetUniformLocation(location));
      if (typeof data == "number" || typeof data == "boolean") {
        switch (type) {
          case 0:
            HEAP32[(params >>> 2) >>> 0] = data;
            break;

          case 2:
            HEAPF32[(params >>> 2) >>> 0] = data;
            break;
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          switch (type) {
            case 0:
              HEAP32[((params + i * 4) >>> 2) >>> 0] = data[i];
              break;

            case 2:
              HEAPF32[((params + i * 4) >>> 2) >>> 0] = data[i];
              break;
          }
        }
      }
    };

    /** @suppress {duplicate } */ function _glGetUniformfv(
      program,
      location,
      params
    ) {
      params >>>= 0;
      emscriptenWebGLGetUniform(program, location, params, 2);
    }

    var _emscripten_glGetUniformfv = _glGetUniformfv;

    /** @suppress {duplicate } */ function _glGetUniformiv(
      program,
      location,
      params
    ) {
      params >>>= 0;
      emscriptenWebGLGetUniform(program, location, params, 0);
    }

    var _emscripten_glGetUniformiv = _glGetUniformiv;

    /** @suppress {duplicate } */ function _glGetUniformuiv(
      program,
      location,
      params
    ) {
      params >>>= 0;
      return emscriptenWebGLGetUniform(program, location, params, 0);
    }

    var _emscripten_glGetUniformuiv = _glGetUniformuiv;

    /** @suppress{checkTypes} */ var emscriptenWebGLGetVertexAttrib = (
      index,
      pname,
      params,
      type
    ) => {
      if (!params) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (GL.currentContext.clientBuffers[index].enabled) {
        err(
          "glGetVertexAttrib*v on client-side array: not supported, bad data returned"
        );
      }
      var data = GLctx.getVertexAttrib(index, pname);
      if (pname == 34975) {
        /*VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/ HEAP32[(params >>> 2) >>> 0] =
          data && data["name"];
      } else if (typeof data == "number" || typeof data == "boolean") {
        switch (type) {
          case 0:
            HEAP32[(params >>> 2) >>> 0] = data;
            break;

          case 2:
            HEAPF32[(params >>> 2) >>> 0] = data;
            break;

          case 5:
            HEAP32[(params >>> 2) >>> 0] = Math.fround(data);
            break;
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          switch (type) {
            case 0:
              HEAP32[((params + i * 4) >>> 2) >>> 0] = data[i];
              break;

            case 2:
              HEAPF32[((params + i * 4) >>> 2) >>> 0] = data[i];
              break;

            case 5:
              HEAP32[((params + i * 4) >>> 2) >>> 0] = Math.fround(data[i]);
              break;
          }
        }
      }
    };

    /** @suppress {duplicate } */ function _glGetVertexAttribIiv(
      index,
      pname,
      params
    ) {
      params >>>= 0;
      emscriptenWebGLGetVertexAttrib(index, pname, params, 0);
    }

    var _emscripten_glGetVertexAttribIiv = _glGetVertexAttribIiv;

    /** @suppress {duplicate } */ var _glGetVertexAttribIuiv =
      _glGetVertexAttribIiv;

    var _emscripten_glGetVertexAttribIuiv = _glGetVertexAttribIuiv;

    /** @suppress {duplicate } */ function _glGetVertexAttribPointerv(
      index,
      pname,
      pointer
    ) {
      pointer >>>= 0;
      if (!pointer) {
        GL.recordError(1281);
        /* GL_INVALID_VALUE */ return;
      }
      if (GL.currentContext.clientBuffers[index].enabled) {
        err(
          "glGetVertexAttribPointer on client-side array: not supported, bad data returned"
        );
      }
      HEAP32[(pointer >>> 2) >>> 0] = GLctx.getVertexAttribOffset(index, pname);
    }

    var _emscripten_glGetVertexAttribPointerv = _glGetVertexAttribPointerv;

    /** @suppress {duplicate } */ function _glGetVertexAttribfv(
      index,
      pname,
      params
    ) {
      params >>>= 0;
      emscriptenWebGLGetVertexAttrib(index, pname, params, 2);
    }

    var _emscripten_glGetVertexAttribfv = _glGetVertexAttribfv;

    /** @suppress {duplicate } */ function _glGetVertexAttribiv(
      index,
      pname,
      params
    ) {
      params >>>= 0;
      emscriptenWebGLGetVertexAttrib(index, pname, params, 5);
    }

    var _emscripten_glGetVertexAttribiv = _glGetVertexAttribiv;

    /** @suppress {duplicate } */ function _glHint(x0, x1) {
      GLctx.hint(x0, x1);
    }

    var _emscripten_glHint = _glHint;

    /** @suppress {duplicate } */ function _glInvalidateFramebuffer(
      target,
      numAttachments,
      attachments
    ) {
      attachments >>>= 0;
      var list = tempFixedLengthArray[numAttachments];
      for (var i = 0; i < numAttachments; i++) {
        list[i] = HEAP32[((attachments + i * 4) >>> 2) >>> 0];
      }
      GLctx.invalidateFramebuffer(target, list);
    }

    var _emscripten_glInvalidateFramebuffer = _glInvalidateFramebuffer;

    /** @suppress {duplicate } */ function _glInvalidateSubFramebuffer(
      target,
      numAttachments,
      attachments,
      x,
      y,
      width,
      height
    ) {
      attachments >>>= 0;
      var list = tempFixedLengthArray[numAttachments];
      for (var i = 0; i < numAttachments; i++) {
        list[i] = HEAP32[((attachments + i * 4) >>> 2) >>> 0];
      }
      GLctx.invalidateSubFramebuffer(target, list, x, y, width, height);
    }

    var _emscripten_glInvalidateSubFramebuffer = _glInvalidateSubFramebuffer;

    /** @suppress {duplicate } */ var _glIsBuffer = (buffer) => {
      var b = GL.buffers[buffer];
      if (!b) return 0;
      return GLctx.isBuffer(b);
    };

    var _emscripten_glIsBuffer = _glIsBuffer;

    /** @suppress {duplicate } */ function _glIsEnabled(x0) {
      return GLctx.isEnabled(x0);
    }

    var _emscripten_glIsEnabled = _glIsEnabled;

    /** @suppress {duplicate } */ var _glIsFramebuffer = (framebuffer) => {
      var fb = GL.framebuffers[framebuffer];
      if (!fb) return 0;
      return GLctx.isFramebuffer(fb);
    };

    var _emscripten_glIsFramebuffer = _glIsFramebuffer;

    /** @suppress {duplicate } */ var _glIsProgram = (program) => {
      program = GL.programs[program];
      if (!program) return 0;
      return GLctx.isProgram(program);
    };

    var _emscripten_glIsProgram = _glIsProgram;

    /** @suppress {duplicate } */ var _glIsQuery = (id) => {
      var query = GL.queries[id];
      if (!query) return 0;
      return GLctx.isQuery(query);
    };

    var _emscripten_glIsQuery = _glIsQuery;

    /** @suppress {duplicate } */ var _glIsQueryEXT = (id) => {
      var query = GL.queries[id];
      if (!query) return 0;
      return GLctx.disjointTimerQueryExt["isQueryEXT"](query);
    };

    var _emscripten_glIsQueryEXT = _glIsQueryEXT;

    /** @suppress {duplicate } */ var _glIsRenderbuffer = (renderbuffer) => {
      var rb = GL.renderbuffers[renderbuffer];
      if (!rb) return 0;
      return GLctx.isRenderbuffer(rb);
    };

    var _emscripten_glIsRenderbuffer = _glIsRenderbuffer;

    /** @suppress {duplicate } */ var _glIsSampler = (id) => {
      var sampler = GL.samplers[id];
      if (!sampler) return 0;
      return GLctx.isSampler(sampler);
    };

    var _emscripten_glIsSampler = _glIsSampler;

    /** @suppress {duplicate } */ var _glIsShader = (shader) => {
      var s = GL.shaders[shader];
      if (!s) return 0;
      return GLctx.isShader(s);
    };

    var _emscripten_glIsShader = _glIsShader;

    /** @suppress {duplicate } */ function _glIsSync(sync) {
      sync >>>= 0;
      return GLctx.isSync(GL.syncs[sync]);
    }

    var _emscripten_glIsSync = _glIsSync;

    /** @suppress {duplicate } */ var _glIsTexture = (id) => {
      var texture = GL.textures[id];
      if (!texture) return 0;
      return GLctx.isTexture(texture);
    };

    var _emscripten_glIsTexture = _glIsTexture;

    /** @suppress {duplicate } */ var _glIsTransformFeedback = (id) =>
      GLctx.isTransformFeedback(GL.transformFeedbacks[id]);

    var _emscripten_glIsTransformFeedback = _glIsTransformFeedback;

    /** @suppress {duplicate } */ var _glIsVertexArray = (array) => {
      var vao = GL.vaos[array];
      if (!vao) return 0;
      return GLctx.isVertexArray(vao);
    };

    var _emscripten_glIsVertexArray = _glIsVertexArray;

    /** @suppress {duplicate } */ var _glIsVertexArrayOES = _glIsVertexArray;

    var _emscripten_glIsVertexArrayOES = _glIsVertexArrayOES;

    /** @suppress {duplicate } */ function _glLineWidth(x0) {
      GLctx.lineWidth(x0);
    }

    var _emscripten_glLineWidth = _glLineWidth;

    /** @suppress {duplicate } */ var _glLinkProgram = (program) => {
      program = GL.programs[program];
      GLctx.linkProgram(program);
      program.uniformLocsById = 0;
      program.uniformSizeAndIdsByName = {};
    };

    var _emscripten_glLinkProgram = _glLinkProgram;

    /** @suppress {duplicate } */ function _glMapBufferRange(
      target,
      offset,
      length,
      access
    ) {
      offset >>>= 0;
      length >>>= 0;
      if (
        (access & (1 | /*GL_MAP_READ_BIT*/ 32)) !=
        /*GL_MAP_UNSYNCHRONIZED_BIT*/ 0
      ) {
        err(
          "glMapBufferRange access does not support MAP_READ or MAP_UNSYNCHRONIZED"
        );
        return 0;
      }
      if ((access & 2) == /*GL_MAP_WRITE_BIT*/ 0) {
        err("glMapBufferRange access must include MAP_WRITE");
        return 0;
      }
      if (
        (access & (4 | /*GL_MAP_INVALIDATE_BUFFER_BIT*/ 8)) ==
        /*GL_MAP_INVALIDATE_RANGE_BIT*/ 0
      ) {
        err(
          "glMapBufferRange access must include INVALIDATE_BUFFER or INVALIDATE_RANGE"
        );
        return 0;
      }
      if (!emscriptenWebGLValidateMapBufferTarget(target)) {
        GL.recordError(1280);
        /*GL_INVALID_ENUM*/ err("GL_INVALID_ENUM in glMapBufferRange");
        return 0;
      }
      var mem = _malloc(length),
        binding = emscriptenWebGLGetBufferBinding(target);
      if (!mem) return 0;
      if (!GL.mappedBuffers[binding]) GL.mappedBuffers[binding] = {};
      binding = GL.mappedBuffers[binding];
      binding.offset = offset;
      binding.length = length;
      binding.mem = mem;
      binding.access = access;
      return mem;
    }

    var _emscripten_glMapBufferRange = _glMapBufferRange;

    /** @suppress {duplicate } */ function _glPauseTransformFeedback() {
      GLctx.pauseTransformFeedback();
    }

    var _emscripten_glPauseTransformFeedback = _glPauseTransformFeedback;

    /** @suppress {duplicate } */ var _glPixelStorei = (pname, param) => {
      if (pname == 3317) {
        /* GL_UNPACK_ALIGNMENT */ GL.unpackAlignment = param;
      }
      GLctx.pixelStorei(pname, param);
    };

    var _emscripten_glPixelStorei = _glPixelStorei;

    /** @suppress {duplicate } */ function _glPolygonOffset(x0, x1) {
      GLctx.polygonOffset(x0, x1);
    }

    var _emscripten_glPolygonOffset = _glPolygonOffset;

    /** @suppress {duplicate } */ function _glProgramBinary(
      program,
      binaryFormat,
      binary,
      length
    ) {
      binary >>>= 0;
      GL.recordError(1280);
    }

    var _emscripten_glProgramBinary = _glProgramBinary;

    /** @suppress {duplicate } */ var _glProgramParameteri = (
      program,
      pname,
      value
    ) => {
      GL.recordError(1280);
    };

    /*GL_INVALID_ENUM*/ var _emscripten_glProgramParameteri =
      _glProgramParameteri;

    /** @suppress {duplicate } */ var _glQueryCounterEXT = (id, target) => {
      GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.queries[id], target);
    };

    var _emscripten_glQueryCounterEXT = _glQueryCounterEXT;

    /** @suppress {duplicate } */ function _glReadBuffer(x0) {
      GLctx.readBuffer(x0);
    }

    var _emscripten_glReadBuffer = _glReadBuffer;

    var computeUnpackAlignedImageSize = (
      width,
      height,
      sizePerPixel,
      alignment
    ) => {
      function roundedToNextMultipleOf(x, y) {
        return (x + y - 1) & -y;
      }
      var plainRowSize = width * sizePerPixel;
      var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
      return height * alignedRowSize;
    };

    var colorChannelsInGlTextureFormat = (format) => {
      var colorChannels = {
        5: 3,
        6: 4,
        8: 2,
        29502: 3,
        29504: 4,
        26917: 2,
        26918: 2,
        29846: 3,
        29847: 4,
      };
      return colorChannels[format - 6402] || 1;
    };

    var heapObjectForWebGLType = (type) => {
      type -= 5120;
      if (type == 0) return HEAP8;
      if (type == 1) return HEAPU8;
      if (type == 2) return HEAP16;
      if (type == 4) return HEAP32;
      if (type == 6) return HEAPF32;
      if (
        type == 5 ||
        type == 28922 ||
        type == 28520 ||
        type == 30779 ||
        type == 30782
      )
        return HEAPU32;
      return HEAPU16;
    };

    var heapAccessShiftForWebGLHeap = (heap) =>
      31 - Math.clz32(heap.BYTES_PER_ELEMENT);

    var emscriptenWebGLGetTexPixelData = (
      type,
      format,
      width,
      height,
      pixels,
      internalFormat
    ) => {
      var heap = heapObjectForWebGLType(type);
      var shift = heapAccessShiftForWebGLHeap(heap);
      var byteSize = 1 << shift;
      var sizePerPixel = colorChannelsInGlTextureFormat(format) * byteSize;
      var bytes = computeUnpackAlignedImageSize(
        width,
        height,
        sizePerPixel,
        GL.unpackAlignment
      );
      return heap.subarray(pixels >>> shift, (pixels + bytes) >>> shift);
    };

    /** @suppress {duplicate } */ function _glReadPixels(
      x,
      y,
      width,
      height,
      format,
      type,
      pixels
    ) {
      pixels >>>= 0;
      if (true) {
        if (GLctx.currentPixelPackBufferBinding) {
          GLctx.readPixels(x, y, width, height, format, type, pixels);
        } else {
          var heap = heapObjectForWebGLType(type);
          GLctx.readPixels(
            x,
            y,
            width,
            height,
            format,
            type,
            heap,
            pixels >> heapAccessShiftForWebGLHeap(heap)
          );
        }
        return;
      }
      var pixelData = emscriptenWebGLGetTexPixelData(
        type,
        format,
        width,
        height,
        pixels,
        format
      );
      if (!pixelData) {
        GL.recordError(1280);
        /*GL_INVALID_ENUM*/ return;
      }
      GLctx.readPixels(x, y, width, height, format, type, pixelData);
    }

    var _emscripten_glReadPixels = _glReadPixels;

    /** @suppress {duplicate } */ var _glReleaseShaderCompiler = () => {};

    var _emscripten_glReleaseShaderCompiler = _glReleaseShaderCompiler;

    /** @suppress {duplicate } */ function _glRenderbufferStorage(
      x0,
      x1,
      x2,
      x3
    ) {
      GLctx.renderbufferStorage(x0, x1, x2, x3);
    }

    var _emscripten_glRenderbufferStorage = _glRenderbufferStorage;

    /** @suppress {duplicate } */ function _glRenderbufferStorageMultisample(
      x0,
      x1,
      x2,
      x3,
      x4
    ) {
      GLctx.renderbufferStorageMultisample(x0, x1, x2, x3, x4);
    }

    var _emscripten_glRenderbufferStorageMultisample =
      _glRenderbufferStorageMultisample;

    /** @suppress {duplicate } */ function _glResumeTransformFeedback() {
      GLctx.resumeTransformFeedback();
    }

    var _emscripten_glResumeTransformFeedback = _glResumeTransformFeedback;

    /** @suppress {duplicate } */ var _glSampleCoverage = (value, invert) => {
      GLctx.sampleCoverage(value, !!invert);
    };

    var _emscripten_glSampleCoverage = _glSampleCoverage;

    /** @suppress {duplicate } */ var _glSamplerParameterf = (
      sampler,
      pname,
      param
    ) => {
      GLctx.samplerParameterf(GL.samplers[sampler], pname, param);
    };

    var _emscripten_glSamplerParameterf = _glSamplerParameterf;

    /** @suppress {duplicate } */ function _glSamplerParameterfv(
      sampler,
      pname,
      params
    ) {
      params >>>= 0;
      var param = HEAPF32[(params >>> 2) >>> 0];
      GLctx.samplerParameterf(GL.samplers[sampler], pname, param);
    }

    var _emscripten_glSamplerParameterfv = _glSamplerParameterfv;

    /** @suppress {duplicate } */ var _glSamplerParameteri = (
      sampler,
      pname,
      param
    ) => {
      GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
    };

    var _emscripten_glSamplerParameteri = _glSamplerParameteri;

    /** @suppress {duplicate } */ function _glSamplerParameteriv(
      sampler,
      pname,
      params
    ) {
      params >>>= 0;
      var param = HEAP32[(params >>> 2) >>> 0];
      GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
    }

    var _emscripten_glSamplerParameteriv = _glSamplerParameteriv;

    /** @suppress {duplicate } */ function _glScissor(x0, x1, x2, x3) {
      GLctx.scissor(x0, x1, x2, x3);
    }

    var _emscripten_glScissor = _glScissor;

    /** @suppress {duplicate } */ function _glShaderBinary(
      count,
      shaders,
      binaryformat,
      binary,
      length
    ) {
      shaders >>>= 0;
      binary >>>= 0;
      GL.recordError(1280);
    }

    var _emscripten_glShaderBinary = _glShaderBinary;

    /** @suppress {duplicate } */ function _glShaderSource(
      shader,
      count,
      string,
      length
    ) {
      string >>>= 0;
      length >>>= 0;
      var source = GL.getSource(shader, count, string, length);
      GLctx.shaderSource(GL.shaders[shader], source);
    }

    var _emscripten_glShaderSource = _glShaderSource;

    /** @suppress {duplicate } */ function _glStencilFunc(x0, x1, x2) {
      GLctx.stencilFunc(x0, x1, x2);
    }

    var _emscripten_glStencilFunc = _glStencilFunc;

    /** @suppress {duplicate } */ function _glStencilFuncSeparate(
      x0,
      x1,
      x2,
      x3
    ) {
      GLctx.stencilFuncSeparate(x0, x1, x2, x3);
    }

    var _emscripten_glStencilFuncSeparate = _glStencilFuncSeparate;

    /** @suppress {duplicate } */ function _glStencilMask(x0) {
      GLctx.stencilMask(x0);
    }

    var _emscripten_glStencilMask = _glStencilMask;

    /** @suppress {duplicate } */ function _glStencilMaskSeparate(x0, x1) {
      GLctx.stencilMaskSeparate(x0, x1);
    }

    var _emscripten_glStencilMaskSeparate = _glStencilMaskSeparate;

    /** @suppress {duplicate } */ function _glStencilOp(x0, x1, x2) {
      GLctx.stencilOp(x0, x1, x2);
    }

    var _emscripten_glStencilOp = _glStencilOp;

    /** @suppress {duplicate } */ function _glStencilOpSeparate(
      x0,
      x1,
      x2,
      x3
    ) {
      GLctx.stencilOpSeparate(x0, x1, x2, x3);
    }

    var _emscripten_glStencilOpSeparate = _glStencilOpSeparate;

    /** @suppress {duplicate } */ function _glTexImage2D(
      target,
      level,
      internalFormat,
      width,
      height,
      border,
      format,
      type,
      pixels
    ) {
      pixels >>>= 0;
      if (true) {
        if (GLctx.currentPixelUnpackBufferBinding) {
          GLctx.texImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            border,
            format,
            type,
            pixels
          );
        } else if (pixels) {
          var heap = heapObjectForWebGLType(type);
          GLctx.texImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            border,
            format,
            type,
            heap,
            pixels >> heapAccessShiftForWebGLHeap(heap)
          );
        } else {
          GLctx.texImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            border,
            format,
            type,
            null
          );
        }
        return;
      }
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        pixels
          ? emscriptenWebGLGetTexPixelData(
              type,
              format,
              width,
              height,
              pixels,
              internalFormat
            )
          : null
      );
    }

    var _emscripten_glTexImage2D = _glTexImage2D;

    /** @suppress {duplicate } */ function _glTexImage3D(
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      format,
      type,
      pixels
    ) {
      pixels >>>= 0;
      if (GLctx.currentPixelUnpackBufferBinding) {
        GLctx.texImage3D(
          target,
          level,
          internalFormat,
          width,
          height,
          depth,
          border,
          format,
          type,
          pixels
        );
      } else if (pixels) {
        var heap = heapObjectForWebGLType(type);
        GLctx.texImage3D(
          target,
          level,
          internalFormat,
          width,
          height,
          depth,
          border,
          format,
          type,
          heap,
          pixels >> heapAccessShiftForWebGLHeap(heap)
        );
      } else {
        GLctx.texImage3D(
          target,
          level,
          internalFormat,
          width,
          height,
          depth,
          border,
          format,
          type,
          null
        );
      }
    }

    var _emscripten_glTexImage3D = _glTexImage3D;

    /** @suppress {duplicate } */ function _glTexParameterf(x0, x1, x2) {
      GLctx.texParameterf(x0, x1, x2);
    }

    var _emscripten_glTexParameterf = _glTexParameterf;

    /** @suppress {duplicate } */ function _glTexParameterfv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      var param = HEAPF32[(params >>> 2) >>> 0];
      GLctx.texParameterf(target, pname, param);
    }

    var _emscripten_glTexParameterfv = _glTexParameterfv;

    /** @suppress {duplicate } */ function _glTexParameteri(x0, x1, x2) {
      GLctx.texParameteri(x0, x1, x2);
    }

    var _emscripten_glTexParameteri = _glTexParameteri;

    /** @suppress {duplicate } */ function _glTexParameteriv(
      target,
      pname,
      params
    ) {
      params >>>= 0;
      var param = HEAP32[(params >>> 2) >>> 0];
      GLctx.texParameteri(target, pname, param);
    }

    var _emscripten_glTexParameteriv = _glTexParameteriv;

    /** @suppress {duplicate } */ function _glTexStorage2D(x0, x1, x2, x3, x4) {
      GLctx.texStorage2D(x0, x1, x2, x3, x4);
    }

    var _emscripten_glTexStorage2D = _glTexStorage2D;

    /** @suppress {duplicate } */ function _glTexStorage3D(
      x0,
      x1,
      x2,
      x3,
      x4,
      x5
    ) {
      GLctx.texStorage3D(x0, x1, x2, x3, x4, x5);
    }

    var _emscripten_glTexStorage3D = _glTexStorage3D;

    /** @suppress {duplicate } */ function _glTexSubImage2D(
      target,
      level,
      xoffset,
      yoffset,
      width,
      height,
      format,
      type,
      pixels
    ) {
      pixels >>>= 0;
      if (true) {
        if (GLctx.currentPixelUnpackBufferBinding) {
          GLctx.texSubImage2D(
            target,
            level,
            xoffset,
            yoffset,
            width,
            height,
            format,
            type,
            pixels
          );
        } else if (pixels) {
          var heap = heapObjectForWebGLType(type);
          GLctx.texSubImage2D(
            target,
            level,
            xoffset,
            yoffset,
            width,
            height,
            format,
            type,
            heap,
            pixels >> heapAccessShiftForWebGLHeap(heap)
          );
        } else {
          GLctx.texSubImage2D(
            target,
            level,
            xoffset,
            yoffset,
            width,
            height,
            format,
            type,
            null
          );
        }
        return;
      }
      var pixelData = null;
      if (pixels)
        pixelData = emscriptenWebGLGetTexPixelData(
          type,
          format,
          width,
          height,
          pixels,
          0
        );
      GLctx.texSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        type,
        pixelData
      );
    }

    var _emscripten_glTexSubImage2D = _glTexSubImage2D;

    /** @suppress {duplicate } */ function _glTexSubImage3D(
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      type,
      pixels
    ) {
      pixels >>>= 0;
      if (GLctx.currentPixelUnpackBufferBinding) {
        GLctx.texSubImage3D(
          target,
          level,
          xoffset,
          yoffset,
          zoffset,
          width,
          height,
          depth,
          format,
          type,
          pixels
        );
      } else if (pixels) {
        var heap = heapObjectForWebGLType(type);
        GLctx.texSubImage3D(
          target,
          level,
          xoffset,
          yoffset,
          zoffset,
          width,
          height,
          depth,
          format,
          type,
          heap,
          pixels >> heapAccessShiftForWebGLHeap(heap)
        );
      } else {
        GLctx.texSubImage3D(
          target,
          level,
          xoffset,
          yoffset,
          zoffset,
          width,
          height,
          depth,
          format,
          type,
          null
        );
      }
    }

    var _emscripten_glTexSubImage3D = _glTexSubImage3D;

    /** @suppress {duplicate } */ function _glTransformFeedbackVaryings(
      program,
      count,
      varyings,
      bufferMode
    ) {
      varyings >>>= 0;
      program = GL.programs[program];
      var vars = [];
      for (var i = 0; i < count; i++)
        vars.push(UTF8ToString(HEAP32[((varyings + i * 4) >>> 2) >>> 0]));
      GLctx.transformFeedbackVaryings(program, vars, bufferMode);
    }

    var _emscripten_glTransformFeedbackVaryings = _glTransformFeedbackVaryings;

    /** @suppress {duplicate } */ var _glUniform1f = (location, v0) => {
      GLctx.uniform1f(webglGetUniformLocation(location), v0);
    };

    var _emscripten_glUniform1f = _glUniform1f;

    /** @suppress {duplicate } */ function _glUniform1fv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform1fv(
          webglGetUniformLocation(location),
          HEAPF32,
          value >> 2,
          count
        );
    }

    var _emscripten_glUniform1fv = _glUniform1fv;

    /** @suppress {duplicate } */ var _glUniform1i = (location, v0) => {
      GLctx.uniform1i(webglGetUniformLocation(location), v0);
    };

    var _emscripten_glUniform1i = _glUniform1i;

    /** @suppress {duplicate } */ function _glUniform1iv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform1iv(
          webglGetUniformLocation(location),
          HEAP32,
          value >> 2,
          count
        );
    }

    var _emscripten_glUniform1iv = _glUniform1iv;

    /** @suppress {duplicate } */ var _glUniform1ui = (location, v0) => {
      GLctx.uniform1ui(webglGetUniformLocation(location), v0);
    };

    var _emscripten_glUniform1ui = _glUniform1ui;

    /** @suppress {duplicate } */ function _glUniform1uiv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform1uiv(
          webglGetUniformLocation(location),
          HEAPU32,
          value >> 2,
          count
        );
    }

    var _emscripten_glUniform1uiv = _glUniform1uiv;

    /** @suppress {duplicate } */ var _glUniform2f = (location, v0, v1) => {
      GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
    };

    var _emscripten_glUniform2f = _glUniform2f;

    /** @suppress {duplicate } */ function _glUniform2fv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform2fv(
          webglGetUniformLocation(location),
          HEAPF32,
          value >> 2,
          count * 2
        );
    }

    var _emscripten_glUniform2fv = _glUniform2fv;

    /** @suppress {duplicate } */ var _glUniform2i = (location, v0, v1) => {
      GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
    };

    var _emscripten_glUniform2i = _glUniform2i;

    /** @suppress {duplicate } */ function _glUniform2iv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform2iv(
          webglGetUniformLocation(location),
          HEAP32,
          value >> 2,
          count * 2
        );
    }

    var _emscripten_glUniform2iv = _glUniform2iv;

    /** @suppress {duplicate } */ var _glUniform2ui = (location, v0, v1) => {
      GLctx.uniform2ui(webglGetUniformLocation(location), v0, v1);
    };

    var _emscripten_glUniform2ui = _glUniform2ui;

    /** @suppress {duplicate } */ function _glUniform2uiv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform2uiv(
          webglGetUniformLocation(location),
          HEAPU32,
          value >> 2,
          count * 2
        );
    }

    var _emscripten_glUniform2uiv = _glUniform2uiv;

    /** @suppress {duplicate } */ var _glUniform3f = (location, v0, v1, v2) => {
      GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
    };

    var _emscripten_glUniform3f = _glUniform3f;

    /** @suppress {duplicate } */ function _glUniform3fv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform3fv(
          webglGetUniformLocation(location),
          HEAPF32,
          value >> 2,
          count * 3
        );
    }

    var _emscripten_glUniform3fv = _glUniform3fv;

    /** @suppress {duplicate } */ var _glUniform3i = (location, v0, v1, v2) => {
      GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
    };

    var _emscripten_glUniform3i = _glUniform3i;

    /** @suppress {duplicate } */ function _glUniform3iv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform3iv(
          webglGetUniformLocation(location),
          HEAP32,
          value >> 2,
          count * 3
        );
    }

    var _emscripten_glUniform3iv = _glUniform3iv;

    /** @suppress {duplicate } */ var _glUniform3ui = (
      location,
      v0,
      v1,
      v2
    ) => {
      GLctx.uniform3ui(webglGetUniformLocation(location), v0, v1, v2);
    };

    var _emscripten_glUniform3ui = _glUniform3ui;

    /** @suppress {duplicate } */ function _glUniform3uiv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform3uiv(
          webglGetUniformLocation(location),
          HEAPU32,
          value >> 2,
          count * 3
        );
    }

    var _emscripten_glUniform3uiv = _glUniform3uiv;

    /** @suppress {duplicate } */ var _glUniform4f = (
      location,
      v0,
      v1,
      v2,
      v3
    ) => {
      GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
    };

    var _emscripten_glUniform4f = _glUniform4f;

    /** @suppress {duplicate } */ function _glUniform4fv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform4fv(
          webglGetUniformLocation(location),
          HEAPF32,
          value >> 2,
          count * 4
        );
    }

    var _emscripten_glUniform4fv = _glUniform4fv;

    /** @suppress {duplicate } */ var _glUniform4i = (
      location,
      v0,
      v1,
      v2,
      v3
    ) => {
      GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
    };

    var _emscripten_glUniform4i = _glUniform4i;

    /** @suppress {duplicate } */ function _glUniform4iv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform4iv(
          webglGetUniformLocation(location),
          HEAP32,
          value >> 2,
          count * 4
        );
    }

    var _emscripten_glUniform4iv = _glUniform4iv;

    /** @suppress {duplicate } */ var _glUniform4ui = (
      location,
      v0,
      v1,
      v2,
      v3
    ) => {
      GLctx.uniform4ui(webglGetUniformLocation(location), v0, v1, v2, v3);
    };

    var _emscripten_glUniform4ui = _glUniform4ui;

    /** @suppress {duplicate } */ function _glUniform4uiv(
      location,
      count,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniform4uiv(
          webglGetUniformLocation(location),
          HEAPU32,
          value >> 2,
          count * 4
        );
    }

    var _emscripten_glUniform4uiv = _glUniform4uiv;

    /** @suppress {duplicate } */ var _glUniformBlockBinding = (
      program,
      uniformBlockIndex,
      uniformBlockBinding
    ) => {
      program = GL.programs[program];
      GLctx.uniformBlockBinding(
        program,
        uniformBlockIndex,
        uniformBlockBinding
      );
    };

    var _emscripten_glUniformBlockBinding = _glUniformBlockBinding;

    /** @suppress {duplicate } */ function _glUniformMatrix2fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix2fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 4
        );
    }

    var _emscripten_glUniformMatrix2fv = _glUniformMatrix2fv;

    /** @suppress {duplicate } */ function _glUniformMatrix2x3fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix2x3fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 6
        );
    }

    var _emscripten_glUniformMatrix2x3fv = _glUniformMatrix2x3fv;

    /** @suppress {duplicate } */ function _glUniformMatrix2x4fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix2x4fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 8
        );
    }

    var _emscripten_glUniformMatrix2x4fv = _glUniformMatrix2x4fv;

    /** @suppress {duplicate } */ function _glUniformMatrix3fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix3fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 9
        );
    }

    var _emscripten_glUniformMatrix3fv = _glUniformMatrix3fv;

    /** @suppress {duplicate } */ function _glUniformMatrix3x2fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix3x2fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 6
        );
    }

    var _emscripten_glUniformMatrix3x2fv = _glUniformMatrix3x2fv;

    /** @suppress {duplicate } */ function _glUniformMatrix3x4fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix3x4fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 12
        );
    }

    var _emscripten_glUniformMatrix3x4fv = _glUniformMatrix3x4fv;

    /** @suppress {duplicate } */ function _glUniformMatrix4fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix4fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 16
        );
    }

    var _emscripten_glUniformMatrix4fv = _glUniformMatrix4fv;

    /** @suppress {duplicate } */ function _glUniformMatrix4x2fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix4x2fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 8
        );
    }

    var _emscripten_glUniformMatrix4x2fv = _glUniformMatrix4x2fv;

    /** @suppress {duplicate } */ function _glUniformMatrix4x3fv(
      location,
      count,
      transpose,
      value
    ) {
      value >>>= 0;
      count &&
        GLctx.uniformMatrix4x3fv(
          webglGetUniformLocation(location),
          !!transpose,
          HEAPF32,
          value >> 2,
          count * 12
        );
    }

    var _emscripten_glUniformMatrix4x3fv = _glUniformMatrix4x3fv;

    /** @suppress {duplicate } */ var _glUnmapBuffer = (target) => {
      if (!emscriptenWebGLValidateMapBufferTarget(target)) {
        GL.recordError(1280);
        /*GL_INVALID_ENUM*/ err("GL_INVALID_ENUM in glUnmapBuffer");
        return 0;
      }
      var buffer = emscriptenWebGLGetBufferBinding(target);
      var mapping = GL.mappedBuffers[buffer];
      if (!mapping || !mapping.mem) {
        GL.recordError(1282);
        /* GL_INVALID_OPERATION */ err(
          "buffer was never mapped in glUnmapBuffer"
        );
        return 0;
      }
      if (!(mapping.access & 16))
        if (true) {
          /* GL_MAP_FLUSH_EXPLICIT_BIT */ GLctx.bufferSubData(
            target,
            mapping.offset,
            HEAPU8,
            mapping.mem,
            mapping.length
          );
        } else {
          GLctx.bufferSubData(
            target,
            mapping.offset,
            HEAPU8.subarray(
              mapping.mem >>> 0,
              (mapping.mem + mapping.length) >>> 0
            )
          );
        }
      _free(mapping.mem);
      mapping.mem = 0;
      return 1;
    };

    var _emscripten_glUnmapBuffer = _glUnmapBuffer;

    /** @suppress {duplicate } */ var _glUseProgram = (program) => {
      program = GL.programs[program];
      GLctx.useProgram(program);
      GLctx.currentProgram = program;
    };

    var _emscripten_glUseProgram = _glUseProgram;

    /** @suppress {duplicate } */ var _glValidateProgram = (program) => {
      GLctx.validateProgram(GL.programs[program]);
    };

    var _emscripten_glValidateProgram = _glValidateProgram;

    /** @suppress {duplicate } */ function _glVertexAttrib1f(x0, x1) {
      GLctx.vertexAttrib1f(x0, x1);
    }

    var _emscripten_glVertexAttrib1f = _glVertexAttrib1f;

    /** @suppress {duplicate } */ function _glVertexAttrib1fv(index, v) {
      v >>>= 0;
      GLctx.vertexAttrib1f(index, HEAPF32[v >>> 2]);
    }

    var _emscripten_glVertexAttrib1fv = _glVertexAttrib1fv;

    /** @suppress {duplicate } */ function _glVertexAttrib2f(x0, x1, x2) {
      GLctx.vertexAttrib2f(x0, x1, x2);
    }

    var _emscripten_glVertexAttrib2f = _glVertexAttrib2f;

    /** @suppress {duplicate } */ function _glVertexAttrib2fv(index, v) {
      v >>>= 0;
      GLctx.vertexAttrib2f(index, HEAPF32[v >>> 2], HEAPF32[(v + 4) >>> 2]);
    }

    var _emscripten_glVertexAttrib2fv = _glVertexAttrib2fv;

    /** @suppress {duplicate } */ function _glVertexAttrib3f(x0, x1, x2, x3) {
      GLctx.vertexAttrib3f(x0, x1, x2, x3);
    }

    var _emscripten_glVertexAttrib3f = _glVertexAttrib3f;

    /** @suppress {duplicate } */ function _glVertexAttrib3fv(index, v) {
      v >>>= 0;
      GLctx.vertexAttrib3f(
        index,
        HEAPF32[v >>> 2],
        HEAPF32[(v + 4) >>> 2],
        HEAPF32[(v + 8) >>> 2]
      );
    }

    var _emscripten_glVertexAttrib3fv = _glVertexAttrib3fv;

    /** @suppress {duplicate } */ function _glVertexAttrib4f(
      x0,
      x1,
      x2,
      x3,
      x4
    ) {
      GLctx.vertexAttrib4f(x0, x1, x2, x3, x4);
    }

    var _emscripten_glVertexAttrib4f = _glVertexAttrib4f;

    /** @suppress {duplicate } */ function _glVertexAttrib4fv(index, v) {
      v >>>= 0;
      GLctx.vertexAttrib4f(
        index,
        HEAPF32[v >>> 2],
        HEAPF32[(v + 4) >>> 2],
        HEAPF32[(v + 8) >>> 2],
        HEAPF32[(v + 12) >>> 2]
      );
    }

    var _emscripten_glVertexAttrib4fv = _glVertexAttrib4fv;

    /** @suppress {duplicate } */ var _glVertexAttribDivisor = (
      index,
      divisor
    ) => {
      GLctx.vertexAttribDivisor(index, divisor);
    };

    var _emscripten_glVertexAttribDivisor = _glVertexAttribDivisor;

    /** @suppress {duplicate } */ var _glVertexAttribDivisorANGLE =
      _glVertexAttribDivisor;

    var _emscripten_glVertexAttribDivisorANGLE = _glVertexAttribDivisorANGLE;

    /** @suppress {duplicate } */ var _glVertexAttribDivisorARB =
      _glVertexAttribDivisor;

    var _emscripten_glVertexAttribDivisorARB = _glVertexAttribDivisorARB;

    /** @suppress {duplicate } */ var _glVertexAttribDivisorEXT =
      _glVertexAttribDivisor;

    var _emscripten_glVertexAttribDivisorEXT = _glVertexAttribDivisorEXT;

    /** @suppress {duplicate } */ var _glVertexAttribDivisorNV =
      _glVertexAttribDivisor;

    var _emscripten_glVertexAttribDivisorNV = _glVertexAttribDivisorNV;

    /** @suppress {duplicate } */ function _glVertexAttribI4i(
      x0,
      x1,
      x2,
      x3,
      x4
    ) {
      GLctx.vertexAttribI4i(x0, x1, x2, x3, x4);
    }

    var _emscripten_glVertexAttribI4i = _glVertexAttribI4i;

    /** @suppress {duplicate } */ function _glVertexAttribI4iv(index, v) {
      v >>>= 0;
      GLctx.vertexAttribI4i(
        index,
        HEAP32[v >>> 2],
        HEAP32[(v + 4) >>> 2],
        HEAP32[(v + 8) >>> 2],
        HEAP32[(v + 12) >>> 2]
      );
    }

    var _emscripten_glVertexAttribI4iv = _glVertexAttribI4iv;

    /** @suppress {duplicate } */ function _glVertexAttribI4ui(
      x0,
      x1,
      x2,
      x3,
      x4
    ) {
      GLctx.vertexAttribI4ui(x0, x1, x2, x3, x4);
    }

    var _emscripten_glVertexAttribI4ui = _glVertexAttribI4ui;

    /** @suppress {duplicate } */ function _glVertexAttribI4uiv(index, v) {
      v >>>= 0;
      GLctx.vertexAttribI4ui(
        index,
        HEAPU32[v >>> 2],
        HEAPU32[(v + 4) >>> 2],
        HEAPU32[(v + 8) >>> 2],
        HEAPU32[(v + 12) >>> 2]
      );
    }

    var _emscripten_glVertexAttribI4uiv = _glVertexAttribI4uiv;

    /** @suppress {duplicate } */ function _glVertexAttribIPointer(
      index,
      size,
      type,
      stride,
      ptr
    ) {
      ptr >>>= 0;
      var cb = GL.currentContext.clientBuffers[index];
      if (!GLctx.currentArrayBufferBinding) {
        cb.size = size;
        cb.type = type;
        cb.normalized = false;
        cb.stride = stride;
        cb.ptr = ptr;
        cb.clientside = true;
        cb.vertexAttribPointerAdaptor = function (
          index,
          size,
          type,
          normalized,
          stride,
          ptr
        ) {
          this.vertexAttribIPointer(index, size, type, stride, ptr);
        };
        return;
      }
      cb.clientside = false;
      GLctx.vertexAttribIPointer(index, size, type, stride, ptr);
    }

    var _emscripten_glVertexAttribIPointer = _glVertexAttribIPointer;

    /** @suppress {duplicate } */ function _glVertexAttribPointer(
      index,
      size,
      type,
      normalized,
      stride,
      ptr
    ) {
      ptr >>>= 0;
      var cb = GL.currentContext.clientBuffers[index];
      if (!GLctx.currentArrayBufferBinding) {
        cb.size = size;
        cb.type = type;
        cb.normalized = normalized;
        cb.stride = stride;
        cb.ptr = ptr;
        cb.clientside = true;
        cb.vertexAttribPointerAdaptor = function (
          index,
          size,
          type,
          normalized,
          stride,
          ptr
        ) {
          this.vertexAttribPointer(index, size, type, normalized, stride, ptr);
        };
        return;
      }
      cb.clientside = false;
      GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
    }

    var _emscripten_glVertexAttribPointer = _glVertexAttribPointer;

    /** @suppress {duplicate } */ function _glViewport(x0, x1, x2, x3) {
      GLctx.viewport(x0, x1, x2, x3);
    }

    var _emscripten_glViewport = _glViewport;

    /** @suppress {duplicate } */ function _glWaitSync(
      sync,
      flags,
      timeout_low,
      timeout_high
    ) {
      sync >>>= 0;
      var timeout = convertI32PairToI53(timeout_low, timeout_high);
      GLctx.waitSync(GL.syncs[sync], flags, timeout);
    }

    var _emscripten_glWaitSync = _glWaitSync;

    var _emscripten_has_asyncify = () => 0;

    function _emscripten_memcpy_js(dest, src, num) {
      dest >>>= 0;
      src >>>= 0;
      num >>>= 0;
      return HEAPU8.copyWithin(dest >>> 0, src >>> 0, (src + num) >>> 0);
    }

    var doRequestFullscreen = (target, strategy) => {
      if (!JSEvents.fullscreenEnabled()) return -1;
      target = findEventTarget(target);
      if (!target) return -4;
      if (!target.requestFullscreen && !target.webkitRequestFullscreen) {
        return -3;
      }
      var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
      if (!canPerformRequests) {
        if (strategy.deferUntilInEventHandler) {
          JSEvents.deferCall(
            JSEvents_requestFullscreen,
            1,
            /* priority over pointer lock */ [target, strategy]
          );
          return 1;
        }
        return -2;
      }
      return JSEvents_requestFullscreen(target, strategy);
    };

    function _emscripten_request_fullscreen_strategy(
      target,
      deferUntilInEventHandler,
      fullscreenStrategy
    ) {
      target >>>= 0;
      fullscreenStrategy >>>= 0;
      var strategy = {
        scaleMode: HEAP32[(fullscreenStrategy >>> 2) >>> 0],
        canvasResolutionScaleMode:
          HEAP32[((fullscreenStrategy + 4) >>> 2) >>> 0],
        filteringMode: HEAP32[((fullscreenStrategy + 8) >>> 2) >>> 0],
        deferUntilInEventHandler: deferUntilInEventHandler,
        canvasResizedCallback: HEAP32[((fullscreenStrategy + 12) >>> 2) >>> 0],
        canvasResizedCallbackUserData:
          HEAP32[((fullscreenStrategy + 16) >>> 2) >>> 0],
      };
      return doRequestFullscreen(target, strategy);
    }

    function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
      target >>>= 0;
      target = findEventTarget(target);
      if (!target) return -4;
      if (!target.requestPointerLock) {
        return -1;
      }
      var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
      if (!canPerformRequests) {
        if (deferUntilInEventHandler) {
          JSEvents.deferCall(
            requestPointerLock,
            2,
            /* priority below fullscreen */ [target]
          );
          return 1;
        }
        return -2;
      }
      return requestPointerLock(target);
    }

    var growMemory = (size) => {
      var b = wasmMemory.buffer;
      var pages = (size - b.byteLength + 65535) / 65536;
      try {
        wasmMemory.grow(pages);
        updateMemoryViews();
        return 1;
      } /*success*/ catch (e) {}
    };

    function _emscripten_resize_heap(requestedSize) {
      requestedSize >>>= 0;
      var oldSize = HEAPU8.length;
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        return false;
      }
      var alignUp = (x, multiple) =>
        x + ((multiple - (x % multiple)) % multiple);
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
        overGrownHeapSize = Math.min(
          overGrownHeapSize,
          requestedSize + 100663296
        );
        var newSize = Math.min(
          maxHeapSize,
          alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
        );
        var replacement = growMemory(newSize);
        if (replacement) {
          return true;
        }
      }
      return false;
    }

    /** @suppress {checkTypes} */ var _emscripten_sample_gamepad_data = () => {
      try {
        if (navigator.getGamepads)
          return (JSEvents.lastGamepadState = navigator.getGamepads()) ? 0 : -1;
      } catch (e) {
        navigator.getGamepads = null;
      }
      return -1;
    };

    var registerBeforeUnloadEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString
    ) => {
      var beforeUnloadEventHandlerFunc = (e = event) => {
        var confirmationMessage = getWasmTableEntry(callbackfunc)(
          eventTypeId,
          0,
          userData
        );
        if (confirmationMessage) {
          confirmationMessage = UTF8ToString(confirmationMessage);
        }
        if (confirmationMessage) {
          e.preventDefault();
          e.returnValue = confirmationMessage;
          return confirmationMessage;
        }
      };
      var eventHandler = {
        target: findEventTarget(target),
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: beforeUnloadEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_beforeunload_callback_on_thread(
      userData,
      callbackfunc,
      targetThread
    ) {
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (typeof onbeforeunload == "undefined") return -1;
      if (targetThread !== 1) return -5;
      return registerBeforeUnloadEventCallback(
        2,
        userData,
        true,
        callbackfunc,
        28,
        "beforeunload"
      );
    }

    var registerFocusEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.focusEvent) JSEvents.focusEvent = _malloc(256);
      var focusEventHandlerFunc = (e = event) => {
        var nodeName = JSEvents.getNodeNameForTarget(e.target);
        var id = e.target.id ? e.target.id : "";
        var focusEvent = JSEvents.focusEvent;
        stringToUTF8(nodeName, focusEvent + 0, 128);
        stringToUTF8(id, focusEvent + 128, 128);
        if (getWasmTableEntry(callbackfunc)(eventTypeId, focusEvent, userData))
          e.preventDefault();
      };
      var eventHandler = {
        target: findEventTarget(target),
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: focusEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_blur_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerFocusEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        12,
        "blur",
        targetThread
      );
    }

    function _emscripten_set_element_css_size(target, width, height) {
      target >>>= 0;
      target = findEventTarget(target);
      if (!target) return -4;
      target.style.width = width + "px";
      target.style.height = height + "px";
      return 0;
    }

    function _emscripten_set_focus_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerFocusEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        13,
        "focus",
        targetThread
      );
    }

    var fillFullscreenChangeEventData = (eventStruct) => {
      var fullscreenElement =
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;
      var isFullscreen = !!fullscreenElement;
      /** @suppress{checkTypes} */ HEAP32[(eventStruct >>> 2) >>> 0] =
        isFullscreen;
      HEAP32[((eventStruct + 4) >>> 2) >>> 0] = JSEvents.fullscreenEnabled();
      var reportedElement = isFullscreen
        ? fullscreenElement
        : JSEvents.previousFullscreenElement;
      var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
      var id = reportedElement?.id || "";
      stringToUTF8(nodeName, eventStruct + 8, 128);
      stringToUTF8(id, eventStruct + 136, 128);
      HEAP32[((eventStruct + 264) >>> 2) >>> 0] = reportedElement
        ? reportedElement.clientWidth
        : 0;
      HEAP32[((eventStruct + 268) >>> 2) >>> 0] = reportedElement
        ? reportedElement.clientHeight
        : 0;
      HEAP32[((eventStruct + 272) >>> 2) >>> 0] = screen.width;
      HEAP32[((eventStruct + 276) >>> 2) >>> 0] = screen.height;
      if (isFullscreen) {
        JSEvents.previousFullscreenElement = fullscreenElement;
      }
    };

    var registerFullscreenChangeEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.fullscreenChangeEvent)
        JSEvents.fullscreenChangeEvent = _malloc(280);
      var fullscreenChangeEventhandlerFunc = (e = event) => {
        var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;
        fillFullscreenChangeEventData(fullscreenChangeEvent);
        if (
          getWasmTableEntry(callbackfunc)(
            eventTypeId,
            fullscreenChangeEvent,
            userData
          )
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: fullscreenChangeEventhandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_fullscreenchange_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (!JSEvents.fullscreenEnabled()) return -1;
      target = findEventTarget(target);
      if (!target) return -4;
      registerFullscreenChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        19,
        "webkitfullscreenchange",
        targetThread
      );
      return registerFullscreenChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        19,
        "fullscreenchange",
        targetThread
      );
    }

    var registerGamepadEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.gamepadEvent) JSEvents.gamepadEvent = _malloc(1432);
      var gamepadEventHandlerFunc = (e = event) => {
        var gamepadEvent = JSEvents.gamepadEvent;
        fillGamepadEventData(gamepadEvent, e["gamepad"]);
        if (
          getWasmTableEntry(callbackfunc)(eventTypeId, gamepadEvent, userData)
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: findEventTarget(target),
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: gamepadEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_gamepadconnected_callback_on_thread(
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (_emscripten_sample_gamepad_data()) return -1;
      return registerGamepadEventCallback(
        2,
        userData,
        useCapture,
        callbackfunc,
        26,
        "gamepadconnected",
        targetThread
      );
    }

    function _emscripten_set_gamepaddisconnected_callback_on_thread(
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (_emscripten_sample_gamepad_data()) return -1;
      return registerGamepadEventCallback(
        2,
        userData,
        useCapture,
        callbackfunc,
        27,
        "gamepaddisconnected",
        targetThread
      );
    }

    var registerKeyEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.keyEvent) JSEvents.keyEvent = _malloc(176);
      var keyEventHandlerFunc = (e) => {
        var keyEventData = JSEvents.keyEvent;
        HEAPF64[(keyEventData >>> 3) >>> 0] = e.timeStamp;
        var idx = keyEventData >>> 2;
        HEAP32[(idx + 2) >>> 0] = e.location;
        HEAP32[(idx + 3) >>> 0] = e.ctrlKey;
        HEAP32[(idx + 4) >>> 0] = e.shiftKey;
        HEAP32[(idx + 5) >>> 0] = e.altKey;
        HEAP32[(idx + 6) >>> 0] = e.metaKey;
        HEAP32[(idx + 7) >>> 0] = e.repeat;
        HEAP32[(idx + 8) >>> 0] = e.charCode;
        HEAP32[(idx + 9) >>> 0] = e.keyCode;
        HEAP32[(idx + 10) >>> 0] = e.which;
        stringToUTF8(e.key || "", keyEventData + 44, 32);
        stringToUTF8(e.code || "", keyEventData + 76, 32);
        stringToUTF8(e.char || "", keyEventData + 108, 32);
        stringToUTF8(e.locale || "", keyEventData + 140, 32);
        if (
          getWasmTableEntry(callbackfunc)(eventTypeId, keyEventData, userData)
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: findEventTarget(target),
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: keyEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_keydown_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerKeyEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        2,
        "keydown",
        targetThread
      );
    }

    function _emscripten_set_keypress_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerKeyEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        1,
        "keypress",
        targetThread
      );
    }

    function _emscripten_set_keyup_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerKeyEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        3,
        "keyup",
        targetThread
      );
    }

    var _emscripten_set_main_loop_arg = function (
      func,
      arg,
      fps,
      simulateInfiniteLoop
    ) {
      func >>>= 0;
      arg >>>= 0;
      var browserIterationFunc = () => getWasmTableEntry(func)(arg);
      setMainLoop(browserIterationFunc, fps, simulateInfiniteLoop, arg);
    };

    var fillMouseEventData = (eventStruct, e, target) => {
      HEAPF64[(eventStruct >>> 3) >>> 0] = e.timeStamp;
      var idx = eventStruct >>> 2;
      HEAP32[(idx + 2) >>> 0] = e.screenX;
      HEAP32[(idx + 3) >>> 0] = e.screenY;
      HEAP32[(idx + 4) >>> 0] = e.clientX;
      HEAP32[(idx + 5) >>> 0] = e.clientY;
      HEAP32[(idx + 6) >>> 0] = e.ctrlKey;
      HEAP32[(idx + 7) >>> 0] = e.shiftKey;
      HEAP32[(idx + 8) >>> 0] = e.altKey;
      HEAP32[(idx + 9) >>> 0] = e.metaKey;
      HEAP16[(idx * 2 + 20) >>> 0] = e.button;
      HEAP16[(idx * 2 + 21) >>> 0] = e.buttons;
      HEAP32[(idx + 11) >>> 0] = e["movementX"];
      HEAP32[(idx + 12) >>> 0] = e["movementY"];
      var rect = getBoundingClientRect(target);
      HEAP32[(idx + 13) >>> 0] = e.clientX - rect.left;
      HEAP32[(idx + 14) >>> 0] = e.clientY - rect.top;
    };

    var registerMouseEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(72);
      target = findEventTarget(target);
      var mouseEventHandlerFunc = (e = event) => {
        fillMouseEventData(JSEvents.mouseEvent, e, target);
        if (
          getWasmTableEntry(callbackfunc)(
            eventTypeId,
            JSEvents.mouseEvent,
            userData
          )
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        allowsDeferredCalls:
          eventTypeString != "mousemove" &&
          eventTypeString != "mouseenter" &&
          eventTypeString != "mouseleave",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: mouseEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_mousedown_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        5,
        "mousedown",
        targetThread
      );
    }

    function _emscripten_set_mouseenter_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        33,
        "mouseenter",
        targetThread
      );
    }

    function _emscripten_set_mouseleave_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        34,
        "mouseleave",
        targetThread
      );
    }

    function _emscripten_set_mousemove_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        8,
        "mousemove",
        targetThread
      );
    }

    function _emscripten_set_mouseup_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        6,
        "mouseup",
        targetThread
      );
    }

    var fillPointerlockChangeEventData = (eventStruct) => {
      var pointerLockElement =
        document.pointerLockElement ||
        document.mozPointerLockElement ||
        document.webkitPointerLockElement ||
        document.msPointerLockElement;
      var isPointerlocked = !!pointerLockElement;
      /** @suppress{checkTypes} */ HEAP32[(eventStruct >>> 2) >>> 0] =
        isPointerlocked;
      var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
      var id = pointerLockElement?.id || "";
      stringToUTF8(nodeName, eventStruct + 4, 128);
      stringToUTF8(id, eventStruct + 132, 128);
    };

    var registerPointerlockChangeEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.pointerlockChangeEvent)
        JSEvents.pointerlockChangeEvent = _malloc(260);
      var pointerlockChangeEventHandlerFunc = (e = event) => {
        var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
        fillPointerlockChangeEventData(pointerlockChangeEvent);
        if (
          getWasmTableEntry(callbackfunc)(
            eventTypeId,
            pointerlockChangeEvent,
            userData
          )
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: pointerlockChangeEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    /** @suppress {missingProperties} */ function _emscripten_set_pointerlockchange_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (
        !document ||
        !document.body ||
        (!document.body.requestPointerLock &&
          !document.body.mozRequestPointerLock &&
          !document.body.webkitRequestPointerLock &&
          !document.body.msRequestPointerLock)
      ) {
        return -1;
      }
      target = findEventTarget(target);
      if (!target) return -4;
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        "mozpointerlockchange",
        targetThread
      );
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        "webkitpointerlockchange",
        targetThread
      );
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        "mspointerlockchange",
        targetThread
      );
      return registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        "pointerlockchange",
        targetThread
      );
    }

    var registerUiEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.uiEvent) JSEvents.uiEvent = _malloc(36);
      target = findEventTarget(target);
      var uiEventHandlerFunc = (e = event) => {
        if (e.target != target) {
          return;
        }
        var b = document.body;
        if (!b) {
          return;
        }
        var uiEvent = JSEvents.uiEvent;
        HEAP32[(uiEvent >>> 2) >>> 0] = e.detail;
        HEAP32[((uiEvent + 4) >>> 2) >>> 0] = b.clientWidth;
        HEAP32[((uiEvent + 8) >>> 2) >>> 0] = b.clientHeight;
        HEAP32[((uiEvent + 12) >>> 2) >>> 0] = innerWidth;
        HEAP32[((uiEvent + 16) >>> 2) >>> 0] = innerHeight;
        HEAP32[((uiEvent + 20) >>> 2) >>> 0] = outerWidth;
        HEAP32[((uiEvent + 24) >>> 2) >>> 0] = outerHeight;
        HEAP32[((uiEvent + 28) >>> 2) >>> 0] = pageXOffset;
        HEAP32[((uiEvent + 32) >>> 2) >>> 0] = pageYOffset;
        if (getWasmTableEntry(callbackfunc)(eventTypeId, uiEvent, userData))
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: uiEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_resize_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerUiEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        10,
        "resize",
        targetThread
      );
    }

    var registerTouchEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.touchEvent) JSEvents.touchEvent = _malloc(1696);
      target = findEventTarget(target);
      var touchEventHandlerFunc = (e) => {
        var t,
          touches = {},
          et = e.touches;
        for (var i = 0; i < et.length; ++i) {
          t = et[i];
          t.isChanged = t.onTarget = 0;
          touches[t.identifier] = t;
        }
        for (var i = 0; i < e.changedTouches.length; ++i) {
          t = e.changedTouches[i];
          t.isChanged = 1;
          touches[t.identifier] = t;
        }
        for (var i = 0; i < e.targetTouches.length; ++i) {
          touches[e.targetTouches[i].identifier].onTarget = 1;
        }
        var touchEvent = JSEvents.touchEvent;
        HEAPF64[(touchEvent >>> 3) >>> 0] = e.timeStamp;
        var idx = touchEvent >>> 2;
        HEAP32[(idx + 3) >>> 0] = e.ctrlKey;
        HEAP32[(idx + 4) >>> 0] = e.shiftKey;
        HEAP32[(idx + 5) >>> 0] = e.altKey;
        HEAP32[(idx + 6) >>> 0] = e.metaKey;
        idx += 7;
        var targetRect = getBoundingClientRect(target);
        var numTouches = 0;
        for (var i in touches) {
          t = touches[i];
          HEAP32[(idx + 0) >>> 0] = t.identifier;
          HEAP32[(idx + 1) >>> 0] = t.screenX;
          HEAP32[(idx + 2) >>> 0] = t.screenY;
          HEAP32[(idx + 3) >>> 0] = t.clientX;
          HEAP32[(idx + 4) >>> 0] = t.clientY;
          HEAP32[(idx + 5) >>> 0] = t.pageX;
          HEAP32[(idx + 6) >>> 0] = t.pageY;
          HEAP32[(idx + 7) >>> 0] = t.isChanged;
          HEAP32[(idx + 8) >>> 0] = t.onTarget;
          HEAP32[(idx + 9) >>> 0] = t.clientX - targetRect.left;
          HEAP32[(idx + 10) >>> 0] = t.clientY - targetRect.top;
          idx += 13;
          if (++numTouches > 31) {
            break;
          }
        }
        HEAP32[((touchEvent + 8) >>> 2) >>> 0] = numTouches;
        if (getWasmTableEntry(callbackfunc)(eventTypeId, touchEvent, userData))
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        allowsDeferredCalls:
          eventTypeString == "touchstart" || eventTypeString == "touchend",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: touchEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_touchcancel_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        25,
        "touchcancel",
        targetThread
      );
    }

    function _emscripten_set_touchend_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        23,
        "touchend",
        targetThread
      );
    }

    function _emscripten_set_touchmove_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        24,
        "touchmove",
        targetThread
      );
    }

    function _emscripten_set_touchstart_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        22,
        "touchstart",
        targetThread
      );
    }

    var fillVisibilityChangeEventData = (eventStruct) => {
      var visibilityStates = ["hidden", "visible", "prerender", "unloaded"];
      var visibilityState = visibilityStates.indexOf(document.visibilityState);
      /** @suppress{checkTypes} */ HEAP32[(eventStruct >>> 2) >>> 0] =
        document.hidden;
      HEAP32[((eventStruct + 4) >>> 2) >>> 0] = visibilityState;
    };

    var registerVisibilityChangeEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.visibilityChangeEvent)
        JSEvents.visibilityChangeEvent = _malloc(8);
      var visibilityChangeEventHandlerFunc = (e = event) => {
        var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
        fillVisibilityChangeEventData(visibilityChangeEvent);
        if (
          getWasmTableEntry(callbackfunc)(
            eventTypeId,
            visibilityChangeEvent,
            userData
          )
        )
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: visibilityChangeEventHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_visibilitychange_callback_on_thread(
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      if (!specialHTMLTargets[1]) {
        return -4;
      }
      return registerVisibilityChangeEventCallback(
        specialHTMLTargets[1],
        userData,
        useCapture,
        callbackfunc,
        21,
        "visibilitychange",
        targetThread
      );
    }

    var registerWheelEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      if (!JSEvents.wheelEvent) JSEvents.wheelEvent = _malloc(104);
      var wheelHandlerFunc = (e = event) => {
        var wheelEvent = JSEvents.wheelEvent;
        fillMouseEventData(wheelEvent, e, target);
        HEAPF64[((wheelEvent + 72) >>> 3) >>> 0] = e["deltaX"];
        HEAPF64[((wheelEvent + 80) >>> 3) >>> 0] = e["deltaY"];
        HEAPF64[((wheelEvent + 88) >>> 3) >>> 0] = e["deltaZ"];
        HEAP32[((wheelEvent + 96) >>> 2) >>> 0] = e["deltaMode"];
        if (getWasmTableEntry(callbackfunc)(eventTypeId, wheelEvent, userData))
          e.preventDefault();
      };
      var eventHandler = {
        target: target,
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: wheelHandlerFunc,
        useCapture: useCapture,
      };
      return JSEvents.registerOrRemoveHandler(eventHandler);
    };

    function _emscripten_set_wheel_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      target >>>= 0;
      userData >>>= 0;
      callbackfunc >>>= 0;
      targetThread >>>= 0;
      target = findEventTarget(target);
      if (!target) return -4;
      if (typeof target.onwheel != "undefined") {
        return registerWheelEventCallback(
          target,
          userData,
          useCapture,
          callbackfunc,
          9,
          "wheel",
          targetThread
        );
      } else {
        return -1;
      }
    }

    function _emscripten_set_window_title(title) {
      title >>>= 0;
      return (document.title = UTF8ToString(title));
    }

    var _emscripten_sleep = () => {
      throw "Please compile your program with async support in order to use asynchronous operations like emscripten_sleep";
    };

    var ENV = {};

    var getExecutableName = () => thisProgram || "./this.program";

    var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        var lang =
          (
            (typeof navigator == "object" &&
              navigator.languages &&
              navigator.languages[0]) ||
            "C"
          ).replace("-", "_") + ".UTF-8";
        var env = {
          USER: "web_user",
          LOGNAME: "web_user",
          PATH: "/",
          PWD: "/",
          HOME: "/home/web_user",
          LANG: lang,
          _: getExecutableName(),
        };
        for (var x in ENV) {
          if (ENV[x] === undefined) delete env[x];
          else env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(`${x}=${env[x]}`);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    };

    var stringToAscii = (str, buffer) => {
      for (var i = 0; i < str.length; ++i) {
        HEAP8[(buffer++ >>> 0) >>> 0] = str.charCodeAt(i);
      }
      HEAP8[(buffer >>> 0) >>> 0] = 0;
    };

    var _environ_get = function (__environ, environ_buf) {
      __environ >>>= 0;
      environ_buf >>>= 0;
      var bufSize = 0;
      getEnvStrings().forEach((string, i) => {
        var ptr = environ_buf + bufSize;
        HEAPU32[((__environ + i * 4) >>> 2) >>> 0] = ptr;
        stringToAscii(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    };

    var _environ_sizes_get = function (penviron_count, penviron_buf_size) {
      penviron_count >>>= 0;
      penviron_buf_size >>>= 0;
      var strings = getEnvStrings();
      HEAPU32[(penviron_count >>> 2) >>> 0] = strings.length;
      var bufSize = 0;
      strings.forEach((string) => (bufSize += string.length + 1));
      HEAPU32[(penviron_buf_size >>> 2) >>> 0] = bufSize;
      return 0;
    };

    function _fd_close(fd) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno;
      }
    }

    /** @param {number=} offset */ var doReadv = (
      stream,
      iov,
      iovcnt,
      offset
    ) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[(iov >>> 2) >>> 0];
        var len = HEAPU32[((iov + 4) >>> 2) >>> 0];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break;
        if (typeof offset !== "undefined") {
          offset += curr;
        }
      }
      return ret;
    };

    function _fd_read(fd, iov, iovcnt, pnum) {
      iov >>>= 0;
      iovcnt >>>= 0;
      pnum >>>= 0;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doReadv(stream, iov, iovcnt);
        HEAPU32[(pnum >>> 2) >>> 0] = num;
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno;
      }
    }

    function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
      var offset = convertI32PairToI53Checked(offset_low, offset_high);
      newOffset >>>= 0;
      try {
        if (isNaN(offset)) return 61;
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.llseek(stream, offset, whence);
        (tempI64 = [
          stream.position >>> 0,
          ((tempDouble = stream.position),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil(
                  (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                ) >>> 0
            : 0),
        ]),
          (HEAP32[(newOffset >>> 2) >>> 0] = tempI64[0]),
          (HEAP32[((newOffset + 4) >>> 2) >>> 0] = tempI64[1]);
        if (stream.getdents && offset === 0 && whence === 0)
          stream.getdents = null;
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno;
      }
    }

    /** @param {number=} offset */ var doWritev = (
      stream,
      iov,
      iovcnt,
      offset
    ) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[(iov >>> 2) >>> 0];
        var len = HEAPU32[((iov + 4) >>> 2) >>> 0];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (typeof offset !== "undefined") {
          offset += curr;
        }
      }
      return ret;
    };

    function _fd_write(fd, iov, iovcnt, pnum) {
      iov >>>= 0;
      iovcnt >>>= 0;
      pnum >>>= 0;
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doWritev(stream, iov, iovcnt);
        HEAPU32[(pnum >>> 2) >>> 0] = num;
        return 0;
      } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno;
      }
    }

    var isLeapYear = (year) =>
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    var arraySum = (array, index) => {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]) {}
      return sum;
    };

    var MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    var MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    var addDays = (date, days) => {
      var newDate = new Date(date.getTime());
      while (days > 0) {
        var leap = isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[
          currentMonth
        ];
        if (days > daysInCurrentMonth - newDate.getDate()) {
          days -= daysInCurrentMonth - newDate.getDate() + 1;
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth + 1);
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear() + 1);
          }
        } else {
          newDate.setDate(newDate.getDate() + days);
          return newDate;
        }
      }
      return newDate;
    };

    var writeArrayToMemory = (array, buffer) => {
      HEAP8.set(array, buffer >>> 0);
    };

    function _strftime(s, maxsize, format, tm) {
      s >>>= 0;
      maxsize >>>= 0;
      format >>>= 0;
      tm >>>= 0;
      var tm_zone = HEAPU32[((tm + 40) >>> 2) >>> 0];
      var date = {
        tm_sec: HEAP32[(tm >>> 2) >>> 0],
        tm_min: HEAP32[((tm + 4) >>> 2) >>> 0],
        tm_hour: HEAP32[((tm + 8) >>> 2) >>> 0],
        tm_mday: HEAP32[((tm + 12) >>> 2) >>> 0],
        tm_mon: HEAP32[((tm + 16) >>> 2) >>> 0],
        tm_year: HEAP32[((tm + 20) >>> 2) >>> 0],
        tm_wday: HEAP32[((tm + 24) >>> 2) >>> 0],
        tm_yday: HEAP32[((tm + 28) >>> 2) >>> 0],
        tm_isdst: HEAP32[((tm + 32) >>> 2) >>> 0],
        tm_gmtoff: HEAP32[((tm + 36) >>> 2) >>> 0],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : "",
      };
      var pattern = UTF8ToString(format);
      var EXPANSION_RULES_1 = {
        "%c": "%a %b %d %H:%M:%S %Y",
        "%D": "%m/%d/%y",
        "%F": "%Y-%m-%d",
        "%h": "%b",
        "%r": "%I:%M:%S %p",
        "%R": "%H:%M",
        "%T": "%H:%M:%S",
        "%x": "%m/%d/%y",
        "%X": "%H:%M:%S",
        "%Ec": "%c",
        "%EC": "%C",
        "%Ex": "%m/%d/%y",
        "%EX": "%H:%M:%S",
        "%Ey": "%y",
        "%EY": "%Y",
        "%Od": "%d",
        "%Oe": "%e",
        "%OH": "%H",
        "%OI": "%I",
        "%Om": "%m",
        "%OM": "%M",
        "%OS": "%S",
        "%Ou": "%u",
        "%OU": "%U",
        "%OV": "%V",
        "%Ow": "%w",
        "%OW": "%W",
        "%Oy": "%y",
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(
          new RegExp(rule, "g"),
          EXPANSION_RULES_1[rule]
        );
      }
      var WEEKDAYS = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      var MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      function leadingSomething(value, digits, character) {
        var str = typeof value == "number" ? value.toString() : value || "";
        while (str.length < digits) {
          str = character[0] + str;
        }
        return str;
      }
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, "0");
      }
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : value > 0 ? 1 : 0;
        }
        var compare;
        if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
            compare = sgn(date1.getDate() - date2.getDate());
          }
        }
        return compare;
      }
      function getFirstWeekStartDate(janFourth) {
        switch (janFourth.getDay()) {
          case 0:
            return new Date(janFourth.getFullYear() - 1, 11, 29);

          case 1:
            return janFourth;

          case 2:
            return new Date(janFourth.getFullYear(), 0, 3);

          case 3:
            return new Date(janFourth.getFullYear(), 0, 2);

          case 4:
            return new Date(janFourth.getFullYear(), 0, 1);

          case 5:
            return new Date(janFourth.getFullYear() - 1, 11, 31);

          case 6:
            return new Date(janFourth.getFullYear() - 1, 11, 30);
        }
      }
      function getWeekBasedYear(date) {
        var thisDate = addDays(
          new Date(date.tm_year + 1900, 0, 1),
          date.tm_yday
        );
        var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
        var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
        var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
        var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
        if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
          if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
            return thisDate.getFullYear() + 1;
          }
          return thisDate.getFullYear();
        }
        return thisDate.getFullYear() - 1;
      }
      var EXPANSION_RULES_2 = {
        "%a": (date) => WEEKDAYS[date.tm_wday].substring(0, 3),
        "%A": (date) => WEEKDAYS[date.tm_wday],
        "%b": (date) => MONTHS[date.tm_mon].substring(0, 3),
        "%B": (date) => MONTHS[date.tm_mon],
        "%C": (date) => {
          var year = date.tm_year + 1900;
          return leadingNulls((year / 100) | 0, 2);
        },
        "%d": (date) => leadingNulls(date.tm_mday, 2),
        "%e": (date) => leadingSomething(date.tm_mday, 2, " "),
        "%g": (date) => getWeekBasedYear(date).toString().substring(2),
        "%G": getWeekBasedYear,
        "%H": (date) => leadingNulls(date.tm_hour, 2),
        "%I": (date) => {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        "%j": (date) =>
          leadingNulls(
            date.tm_mday +
              arraySum(
                isLeapYear(date.tm_year + 1900)
                  ? MONTH_DAYS_LEAP
                  : MONTH_DAYS_REGULAR,
                date.tm_mon - 1
              ),
            3
          ),
        "%m": (date) => leadingNulls(date.tm_mon + 1, 2),
        "%M": (date) => leadingNulls(date.tm_min, 2),
        "%n": () => "\n",
        "%p": (date) => {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return "AM";
          }
          return "PM";
        },
        "%S": (date) => leadingNulls(date.tm_sec, 2),
        "%t": () => "\t",
        "%u": (date) => date.tm_wday || 7,
        "%U": (date) => {
          var days = date.tm_yday + 7 - date.tm_wday;
          return leadingNulls(Math.floor(days / 7), 2);
        },
        "%V": (date) => {
          var val = Math.floor(
            (date.tm_yday + 7 - ((date.tm_wday + 6) % 7)) / 7
          );
          if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
            val++;
          }
          if (!val) {
            val = 52;
            var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
            if (
              dec31 == 4 ||
              (dec31 == 5 && isLeapYear((date.tm_year % 400) - 1))
            ) {
              val++;
            }
          } else if (val == 53) {
            var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
            if (jan1 != 4 && (jan1 != 3 || !isLeapYear(date.tm_year))) val = 1;
          }
          return leadingNulls(val, 2);
        },
        "%w": (date) => date.tm_wday,
        "%W": (date) => {
          var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
          return leadingNulls(Math.floor(days / 7), 2);
        },
        "%y": (date) => (date.tm_year + 1900).toString().substring(2),
        "%Y": (date) => date.tm_year + 1900,
        "%z": (date) => {
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          off = (off / 60) * 100 + (off % 60);
          return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
        },
        "%Z": (date) => date.tm_zone,
        "%%": () => "%",
      };
      pattern = pattern.replace(/%%/g, "\0\0");
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.includes(rule)) {
          pattern = pattern.replace(
            new RegExp(rule, "g"),
            EXPANSION_RULES_2[rule](date)
          );
        }
      }
      pattern = pattern.replace(/\0\0/g, "%");
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
      writeArrayToMemory(bytes, s);
      return bytes.length - 1;
    }

    function _strftime_l(s, maxsize, format, tm, loc) {
      s >>>= 0;
      maxsize >>>= 0;
      format >>>= 0;
      tm >>>= 0;
      loc >>>= 0;
      return _strftime(s, maxsize, format, tm);
    }

    var FSNode = /** @constructor */ function (parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      this.parent = parent;
      this.mount = parent.mount;
      this.mounted = null;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.node_ops = {};
      this.stream_ops = {};
      this.rdev = rdev;
    };

    var readMode = 292 | /*292*/ 73;

    /*73*/ var writeMode = 146;

    /*146*/ Object.defineProperties(FSNode.prototype, {
      read: {
        get: /** @this{FSNode} */ function () {
          return (this.mode & readMode) === readMode;
        },
        set: /** @this{FSNode} */ function (val) {
          val ? (this.mode |= readMode) : (this.mode &= ~readMode);
        },
      },
      write: {
        get: /** @this{FSNode} */ function () {
          return (this.mode & writeMode) === writeMode;
        },
        set: /** @this{FSNode} */ function (val) {
          val ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
        },
      },
      isFolder: {
        get: /** @this{FSNode} */ function () {
          return FS.isDir(this.mode);
        },
      },
      isDevice: {
        get: /** @this{FSNode} */ function () {
          return FS.isChrdev(this.mode);
        },
      },
    });

    FS.FSNode = FSNode;

    FS.createPreloadedFile = FS_createPreloadedFile;

    FS.staticInit();

    embind_init_charCodes();

    BindingError = Module["BindingError"] = class BindingError extends Error {
      constructor(message) {
        super(message);
        this.name = "BindingError";
      }
    };

    InternalError = Module["InternalError"] = class InternalError extends (
      Error
    ) {
      constructor(message) {
        super(message);
        this.name = "InternalError";
      }
    };

    init_emval();

    UnboundTypeError = Module["UnboundTypeError"] = extendError(
      Error,
      "UnboundTypeError"
    );

    Module["requestFullscreen"] = Browser.requestFullscreen;

    Module["requestAnimationFrame"] = Browser.requestAnimationFrame;

    Module["setCanvasSize"] = Browser.setCanvasSize;

    Module["pauseMainLoop"] = Browser.mainLoop.pause;

    Module["resumeMainLoop"] = Browser.mainLoop.resume;

    Module["getUserMedia"] = Browser.getUserMedia;

    Module["createContext"] = Browser.createContext;

    var preloadedImages = {};

    var preloadedAudios = {};

    var GLctx;

    for (var i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));

    var wasmImports = {
      /** @export */ a: ___cxa_throw,
      /** @export */ ji: ___syscall_faccessat,
      /** @export */ Fa: ___syscall_fcntl64,
      /** @export */ ii: ___syscall_fstat64,
      /** @export */ hi: ___syscall_getcwd,
      /** @export */ gi: ___syscall_getdents64,
      /** @export */ fi: ___syscall_ioctl,
      /** @export */ ei: ___syscall_lstat64,
      /** @export */ di: ___syscall_newfstatat,
      /** @export */ Ab: ___syscall_openat,
      /** @export */ ci: ___syscall_readlinkat,
      /** @export */ bi: ___syscall_stat64,
      /** @export */ Eb: __embind_register_bigint,
      /** @export */ _h: __embind_register_bool,
      /** @export */ Zh: __embind_register_emval,
      /** @export */ xb: __embind_register_float,
      /** @export */ n: __embind_register_function,
      /** @export */ x: __embind_register_integer,
      /** @export */ h: __embind_register_memory_view,
      /** @export */ wb: __embind_register_std_string,
      /** @export */ Ea: __embind_register_std_wstring,
      /** @export */ Yh: __embind_register_void,
      /** @export */ Xh: __emscripten_get_now_is_monotonic,
      /** @export */ Wh: __emscripten_throw_longjmp,
      /** @export */ vb: __emval_as,
      /** @export */ Da: __emval_call_method,
      /** @export */ p: __emval_decref,
      /** @export */ Vh: __emval_get_global,
      /** @export */ Ca: __emval_get_method_caller,
      /** @export */ ub: __emval_get_property,
      /** @export */ K: __emval_incref,
      /** @export */ Uh: __emval_instanceof,
      /** @export */ Th: __emval_new_array,
      /** @export */ tb: __emval_new_cstring,
      /** @export */ R: __emval_run_destructors,
      /** @export */ ba: __emval_take_value,
      /** @export */ Db: __mmap_js,
      /** @export */ Cb: __munmap_js,
      /** @export */ Q: _abort,
      /** @export */ Sh: _eglBindAPI,
      /** @export */ Rh: _eglChooseConfig,
      /** @export */ Qh: _eglCreateContext,
      /** @export */ Ph: _eglCreateWindowSurface,
      /** @export */ Oh: _eglDestroyContext,
      /** @export */ Nh: _eglDestroySurface,
      /** @export */ Mh: _eglGetConfigAttrib,
      /** @export */ sb: _eglGetDisplay,
      /** @export */ Lh: _eglGetError,
      /** @export */ Kh: _eglInitialize,
      /** @export */ Jh: _eglMakeCurrent,
      /** @export */ Ih: _eglQueryString,
      /** @export */ Hh: _eglSwapBuffers,
      /** @export */ Gh: _eglSwapInterval,
      /** @export */ Fh: _eglTerminate,
      /** @export */ Eh: _eglWaitGL,
      /** @export */ Dh: _eglWaitNative,
      /** @export */ aa: _emscripten_asm_const_int,
      /** @export */ l: _emscripten_asm_const_int_sync_on_main_thread,
      /** @export */ Ch: _emscripten_cancel_main_loop,
      /** @export */ Bh: _emscripten_date_now,
      /** @export */ Ah: _emscripten_exit_fullscreen,
      /** @export */ zh: _emscripten_exit_pointerlock,
      /** @export */ A: _emscripten_get_device_pixel_ratio,
      /** @export */ z: _emscripten_get_element_css_size,
      /** @export */ rb: _emscripten_get_gamepad_status,
      /** @export */ yh: _emscripten_get_heap_max,
      /** @export */ Ba: _emscripten_get_now,
      /** @export */ xh: _emscripten_get_num_gamepads,
      /** @export */ wh: _emscripten_get_screen_size,
      /** @export */ vh: _emscripten_glActiveTexture,
      /** @export */ uh: _emscripten_glAttachShader,
      /** @export */ th: _emscripten_glBeginQuery,
      /** @export */ sh: _emscripten_glBeginQueryEXT,
      /** @export */ rh: _emscripten_glBeginTransformFeedback,
      /** @export */ qh: _emscripten_glBindAttribLocation,
      /** @export */ ph: _emscripten_glBindBuffer,
      /** @export */ oh: _emscripten_glBindBufferBase,
      /** @export */ nh: _emscripten_glBindBufferRange,
      /** @export */ mh: _emscripten_glBindFramebuffer,
      /** @export */ lh: _emscripten_glBindRenderbuffer,
      /** @export */ kh: _emscripten_glBindSampler,
      /** @export */ jh: _emscripten_glBindTexture,
      /** @export */ ih: _emscripten_glBindTransformFeedback,
      /** @export */ hh: _emscripten_glBindVertexArray,
      /** @export */ gh: _emscripten_glBindVertexArrayOES,
      /** @export */ fh: _emscripten_glBlendColor,
      /** @export */ eh: _emscripten_glBlendEquation,
      /** @export */ dh: _emscripten_glBlendEquationSeparate,
      /** @export */ ch: _emscripten_glBlendFunc,
      /** @export */ bh: _emscripten_glBlendFuncSeparate,
      /** @export */ ah: _emscripten_glBlitFramebuffer,
      /** @export */ $g: _emscripten_glBufferData,
      /** @export */ _g: _emscripten_glBufferSubData,
      /** @export */ Zg: _emscripten_glCheckFramebufferStatus,
      /** @export */ Yg: _emscripten_glClear,
      /** @export */ Xg: _emscripten_glClearBufferfi,
      /** @export */ Wg: _emscripten_glClearBufferfv,
      /** @export */ Vg: _emscripten_glClearBufferiv,
      /** @export */ Ug: _emscripten_glClearBufferuiv,
      /** @export */ Tg: _emscripten_glClearColor,
      /** @export */ Sg: _emscripten_glClearDepthf,
      /** @export */ Rg: _emscripten_glClearStencil,
      /** @export */ Qg: _emscripten_glClientWaitSync,
      /** @export */ Pg: _emscripten_glColorMask,
      /** @export */ Og: _emscripten_glCompileShader,
      /** @export */ Ng: _emscripten_glCompressedTexImage2D,
      /** @export */ Mg: _emscripten_glCompressedTexImage3D,
      /** @export */ Lg: _emscripten_glCompressedTexSubImage2D,
      /** @export */ Kg: _emscripten_glCompressedTexSubImage3D,
      /** @export */ Jg: _emscripten_glCopyBufferSubData,
      /** @export */ Ig: _emscripten_glCopyTexImage2D,
      /** @export */ Hg: _emscripten_glCopyTexSubImage2D,
      /** @export */ Gg: _emscripten_glCopyTexSubImage3D,
      /** @export */ Fg: _emscripten_glCreateProgram,
      /** @export */ Eg: _emscripten_glCreateShader,
      /** @export */ Dg: _emscripten_glCullFace,
      /** @export */ Cg: _emscripten_glDeleteBuffers,
      /** @export */ Bg: _emscripten_glDeleteFramebuffers,
      /** @export */ Ag: _emscripten_glDeleteProgram,
      /** @export */ zg: _emscripten_glDeleteQueries,
      /** @export */ yg: _emscripten_glDeleteQueriesEXT,
      /** @export */ xg: _emscripten_glDeleteRenderbuffers,
      /** @export */ wg: _emscripten_glDeleteSamplers,
      /** @export */ vg: _emscripten_glDeleteShader,
      /** @export */ ug: _emscripten_glDeleteSync,
      /** @export */ tg: _emscripten_glDeleteTextures,
      /** @export */ sg: _emscripten_glDeleteTransformFeedbacks,
      /** @export */ rg: _emscripten_glDeleteVertexArrays,
      /** @export */ qg: _emscripten_glDeleteVertexArraysOES,
      /** @export */ pg: _emscripten_glDepthFunc,
      /** @export */ og: _emscripten_glDepthMask,
      /** @export */ ng: _emscripten_glDepthRangef,
      /** @export */ mg: _emscripten_glDetachShader,
      /** @export */ lg: _emscripten_glDisable,
      /** @export */ kg: _emscripten_glDisableVertexAttribArray,
      /** @export */ jg: _emscripten_glDrawArrays,
      /** @export */ ig: _emscripten_glDrawArraysInstanced,
      /** @export */ hg: _emscripten_glDrawArraysInstancedANGLE,
      /** @export */ gg: _emscripten_glDrawArraysInstancedARB,
      /** @export */ fg: _emscripten_glDrawArraysInstancedEXT,
      /** @export */ eg: _emscripten_glDrawArraysInstancedNV,
      /** @export */ dg: _emscripten_glDrawBuffers,
      /** @export */ cg: _emscripten_glDrawBuffersEXT,
      /** @export */ bg: _emscripten_glDrawBuffersWEBGL,
      /** @export */ ag: _emscripten_glDrawElements,
      /** @export */ $f: _emscripten_glDrawElementsInstanced,
      /** @export */ _f: _emscripten_glDrawElementsInstancedANGLE,
      /** @export */ Zf: _emscripten_glDrawElementsInstancedARB,
      /** @export */ Yf: _emscripten_glDrawElementsInstancedEXT,
      /** @export */ Xf: _emscripten_glDrawElementsInstancedNV,
      /** @export */ Wf: _emscripten_glDrawRangeElements,
      /** @export */ Vf: _emscripten_glEnable,
      /** @export */ Uf: _emscripten_glEnableVertexAttribArray,
      /** @export */ Tf: _emscripten_glEndQuery,
      /** @export */ Sf: _emscripten_glEndQueryEXT,
      /** @export */ Rf: _emscripten_glEndTransformFeedback,
      /** @export */ Qf: _emscripten_glFenceSync,
      /** @export */ Pf: _emscripten_glFinish,
      /** @export */ Of: _emscripten_glFlush,
      /** @export */ Nf: _emscripten_glFlushMappedBufferRange,
      /** @export */ Mf: _emscripten_glFramebufferRenderbuffer,
      /** @export */ Lf: _emscripten_glFramebufferTexture2D,
      /** @export */ Kf: _emscripten_glFramebufferTextureLayer,
      /** @export */ Jf: _emscripten_glFrontFace,
      /** @export */ If: _emscripten_glGenBuffers,
      /** @export */ Hf: _emscripten_glGenFramebuffers,
      /** @export */ Gf: _emscripten_glGenQueries,
      /** @export */ Ff: _emscripten_glGenQueriesEXT,
      /** @export */ Ef: _emscripten_glGenRenderbuffers,
      /** @export */ Df: _emscripten_glGenSamplers,
      /** @export */ Cf: _emscripten_glGenTextures,
      /** @export */ Bf: _emscripten_glGenTransformFeedbacks,
      /** @export */ Af: _emscripten_glGenVertexArrays,
      /** @export */ zf: _emscripten_glGenVertexArraysOES,
      /** @export */ yf: _emscripten_glGenerateMipmap,
      /** @export */ xf: _emscripten_glGetActiveAttrib,
      /** @export */ wf: _emscripten_glGetActiveUniform,
      /** @export */ vf: _emscripten_glGetActiveUniformBlockName,
      /** @export */ uf: _emscripten_glGetActiveUniformBlockiv,
      /** @export */ tf: _emscripten_glGetActiveUniformsiv,
      /** @export */ sf: _emscripten_glGetAttachedShaders,
      /** @export */ rf: _emscripten_glGetAttribLocation,
      /** @export */ qf: _emscripten_glGetBooleanv,
      /** @export */ pf: _emscripten_glGetBufferParameteri64v,
      /** @export */ of: _emscripten_glGetBufferParameteriv,
      /** @export */ nf: _emscripten_glGetBufferPointerv,
      /** @export */ mf: _emscripten_glGetError,
      /** @export */ lf: _emscripten_glGetFloatv,
      /** @export */ kf: _emscripten_glGetFragDataLocation,
      /** @export */ jf: _emscripten_glGetFramebufferAttachmentParameteriv,
      /** @export */ hf: _emscripten_glGetInteger64i_v,
      /** @export */ gf: _emscripten_glGetInteger64v,
      /** @export */ ff: _emscripten_glGetIntegeri_v,
      /** @export */ ef: _emscripten_glGetIntegerv,
      /** @export */ df: _emscripten_glGetInternalformativ,
      /** @export */ cf: _emscripten_glGetProgramBinary,
      /** @export */ bf: _emscripten_glGetProgramInfoLog,
      /** @export */ af: _emscripten_glGetProgramiv,
      /** @export */ $e: _emscripten_glGetQueryObjecti64vEXT,
      /** @export */ _e: _emscripten_glGetQueryObjectivEXT,
      /** @export */ Ze: _emscripten_glGetQueryObjectui64vEXT,
      /** @export */ Ye: _emscripten_glGetQueryObjectuiv,
      /** @export */ Xe: _emscripten_glGetQueryObjectuivEXT,
      /** @export */ We: _emscripten_glGetQueryiv,
      /** @export */ Ve: _emscripten_glGetQueryivEXT,
      /** @export */ Ue: _emscripten_glGetRenderbufferParameteriv,
      /** @export */ Te: _emscripten_glGetSamplerParameterfv,
      /** @export */ Se: _emscripten_glGetSamplerParameteriv,
      /** @export */ Re: _emscripten_glGetShaderInfoLog,
      /** @export */ Qe: _emscripten_glGetShaderPrecisionFormat,
      /** @export */ Pe: _emscripten_glGetShaderSource,
      /** @export */ Oe: _emscripten_glGetShaderiv,
      /** @export */ Ne: _emscripten_glGetString,
      /** @export */ Me: _emscripten_glGetStringi,
      /** @export */ Le: _emscripten_glGetSynciv,
      /** @export */ Ke: _emscripten_glGetTexParameterfv,
      /** @export */ Je: _emscripten_glGetTexParameteriv,
      /** @export */ Ie: _emscripten_glGetTransformFeedbackVarying,
      /** @export */ He: _emscripten_glGetUniformBlockIndex,
      /** @export */ Ge: _emscripten_glGetUniformIndices,
      /** @export */ Fe: _emscripten_glGetUniformLocation,
      /** @export */ Ee: _emscripten_glGetUniformfv,
      /** @export */ De: _emscripten_glGetUniformiv,
      /** @export */ Ce: _emscripten_glGetUniformuiv,
      /** @export */ Be: _emscripten_glGetVertexAttribIiv,
      /** @export */ Ae: _emscripten_glGetVertexAttribIuiv,
      /** @export */ ze: _emscripten_glGetVertexAttribPointerv,
      /** @export */ ye: _emscripten_glGetVertexAttribfv,
      /** @export */ xe: _emscripten_glGetVertexAttribiv,
      /** @export */ we: _emscripten_glHint,
      /** @export */ ve: _emscripten_glInvalidateFramebuffer,
      /** @export */ ue: _emscripten_glInvalidateSubFramebuffer,
      /** @export */ te: _emscripten_glIsBuffer,
      /** @export */ se: _emscripten_glIsEnabled,
      /** @export */ re: _emscripten_glIsFramebuffer,
      /** @export */ qe: _emscripten_glIsProgram,
      /** @export */ pe: _emscripten_glIsQuery,
      /** @export */ oe: _emscripten_glIsQueryEXT,
      /** @export */ ne: _emscripten_glIsRenderbuffer,
      /** @export */ me: _emscripten_glIsSampler,
      /** @export */ le: _emscripten_glIsShader,
      /** @export */ ke: _emscripten_glIsSync,
      /** @export */ je: _emscripten_glIsTexture,
      /** @export */ ie: _emscripten_glIsTransformFeedback,
      /** @export */ he: _emscripten_glIsVertexArray,
      /** @export */ ge: _emscripten_glIsVertexArrayOES,
      /** @export */ fe: _emscripten_glLineWidth,
      /** @export */ ee: _emscripten_glLinkProgram,
      /** @export */ de: _emscripten_glMapBufferRange,
      /** @export */ ce: _emscripten_glPauseTransformFeedback,
      /** @export */ be: _emscripten_glPixelStorei,
      /** @export */ ae: _emscripten_glPolygonOffset,
      /** @export */ $d: _emscripten_glProgramBinary,
      /** @export */ _d: _emscripten_glProgramParameteri,
      /** @export */ Zd: _emscripten_glQueryCounterEXT,
      /** @export */ Yd: _emscripten_glReadBuffer,
      /** @export */ Xd: _emscripten_glReadPixels,
      /** @export */ Wd: _emscripten_glReleaseShaderCompiler,
      /** @export */ Vd: _emscripten_glRenderbufferStorage,
      /** @export */ Ud: _emscripten_glRenderbufferStorageMultisample,
      /** @export */ Td: _emscripten_glResumeTransformFeedback,
      /** @export */ Sd: _emscripten_glSampleCoverage,
      /** @export */ Rd: _emscripten_glSamplerParameterf,
      /** @export */ Qd: _emscripten_glSamplerParameterfv,
      /** @export */ Pd: _emscripten_glSamplerParameteri,
      /** @export */ Od: _emscripten_glSamplerParameteriv,
      /** @export */ Nd: _emscripten_glScissor,
      /** @export */ Md: _emscripten_glShaderBinary,
      /** @export */ Ld: _emscripten_glShaderSource,
      /** @export */ Kd: _emscripten_glStencilFunc,
      /** @export */ Jd: _emscripten_glStencilFuncSeparate,
      /** @export */ Id: _emscripten_glStencilMask,
      /** @export */ Hd: _emscripten_glStencilMaskSeparate,
      /** @export */ Gd: _emscripten_glStencilOp,
      /** @export */ Fd: _emscripten_glStencilOpSeparate,
      /** @export */ Ed: _emscripten_glTexImage2D,
      /** @export */ Dd: _emscripten_glTexImage3D,
      /** @export */ Cd: _emscripten_glTexParameterf,
      /** @export */ Bd: _emscripten_glTexParameterfv,
      /** @export */ Ad: _emscripten_glTexParameteri,
      /** @export */ zd: _emscripten_glTexParameteriv,
      /** @export */ yd: _emscripten_glTexStorage2D,
      /** @export */ xd: _emscripten_glTexStorage3D,
      /** @export */ wd: _emscripten_glTexSubImage2D,
      /** @export */ vd: _emscripten_glTexSubImage3D,
      /** @export */ ud: _emscripten_glTransformFeedbackVaryings,
      /** @export */ td: _emscripten_glUniform1f,
      /** @export */ sd: _emscripten_glUniform1fv,
      /** @export */ rd: _emscripten_glUniform1i,
      /** @export */ qd: _emscripten_glUniform1iv,
      /** @export */ pd: _emscripten_glUniform1ui,
      /** @export */ od: _emscripten_glUniform1uiv,
      /** @export */ nd: _emscripten_glUniform2f,
      /** @export */ md: _emscripten_glUniform2fv,
      /** @export */ ld: _emscripten_glUniform2i,
      /** @export */ kd: _emscripten_glUniform2iv,
      /** @export */ jd: _emscripten_glUniform2ui,
      /** @export */ id: _emscripten_glUniform2uiv,
      /** @export */ hd: _emscripten_glUniform3f,
      /** @export */ gd: _emscripten_glUniform3fv,
      /** @export */ fd: _emscripten_glUniform3i,
      /** @export */ ed: _emscripten_glUniform3iv,
      /** @export */ dd: _emscripten_glUniform3ui,
      /** @export */ cd: _emscripten_glUniform3uiv,
      /** @export */ bd: _emscripten_glUniform4f,
      /** @export */ ad: _emscripten_glUniform4fv,
      /** @export */ $c: _emscripten_glUniform4i,
      /** @export */ _c: _emscripten_glUniform4iv,
      /** @export */ Zc: _emscripten_glUniform4ui,
      /** @export */ Yc: _emscripten_glUniform4uiv,
      /** @export */ Xc: _emscripten_glUniformBlockBinding,
      /** @export */ Wc: _emscripten_glUniformMatrix2fv,
      /** @export */ Vc: _emscripten_glUniformMatrix2x3fv,
      /** @export */ Uc: _emscripten_glUniformMatrix2x4fv,
      /** @export */ Tc: _emscripten_glUniformMatrix3fv,
      /** @export */ Sc: _emscripten_glUniformMatrix3x2fv,
      /** @export */ Rc: _emscripten_glUniformMatrix3x4fv,
      /** @export */ Qc: _emscripten_glUniformMatrix4fv,
      /** @export */ Pc: _emscripten_glUniformMatrix4x2fv,
      /** @export */ Oc: _emscripten_glUniformMatrix4x3fv,
      /** @export */ Nc: _emscripten_glUnmapBuffer,
      /** @export */ Mc: _emscripten_glUseProgram,
      /** @export */ Lc: _emscripten_glValidateProgram,
      /** @export */ Kc: _emscripten_glVertexAttrib1f,
      /** @export */ Jc: _emscripten_glVertexAttrib1fv,
      /** @export */ Ic: _emscripten_glVertexAttrib2f,
      /** @export */ Hc: _emscripten_glVertexAttrib2fv,
      /** @export */ Gc: _emscripten_glVertexAttrib3f,
      /** @export */ Fc: _emscripten_glVertexAttrib3fv,
      /** @export */ Ec: _emscripten_glVertexAttrib4f,
      /** @export */ Dc: _emscripten_glVertexAttrib4fv,
      /** @export */ Cc: _emscripten_glVertexAttribDivisor,
      /** @export */ Bc: _emscripten_glVertexAttribDivisorANGLE,
      /** @export */ Ac: _emscripten_glVertexAttribDivisorARB,
      /** @export */ zc: _emscripten_glVertexAttribDivisorEXT,
      /** @export */ yc: _emscripten_glVertexAttribDivisorNV,
      /** @export */ xc: _emscripten_glVertexAttribI4i,
      /** @export */ wc: _emscripten_glVertexAttribI4iv,
      /** @export */ vc: _emscripten_glVertexAttribI4ui,
      /** @export */ uc: _emscripten_glVertexAttribI4uiv,
      /** @export */ tc: _emscripten_glVertexAttribIPointer,
      /** @export */ sc: _emscripten_glVertexAttribPointer,
      /** @export */ rc: _emscripten_glViewport,
      /** @export */ qc: _emscripten_glWaitSync,
      /** @export */ Aa: _emscripten_has_asyncify,
      /** @export */ pc: _emscripten_memcpy_js,
      /** @export */ oc: _emscripten_request_fullscreen_strategy,
      /** @export */ qb: _emscripten_request_pointerlock,
      /** @export */ nc: _emscripten_resize_heap,
      /** @export */ pb: _emscripten_sample_gamepad_data,
      /** @export */ ob: _emscripten_set_beforeunload_callback_on_thread,
      /** @export */ nb: _emscripten_set_blur_callback_on_thread,
      /** @export */ P: _emscripten_set_canvas_element_size,
      /** @export */ za: _emscripten_set_element_css_size,
      /** @export */ mb: _emscripten_set_focus_callback_on_thread,
      /** @export */ lb: _emscripten_set_fullscreenchange_callback_on_thread,
      /** @export */ kb: _emscripten_set_gamepadconnected_callback_on_thread,
      /** @export */ jb: _emscripten_set_gamepaddisconnected_callback_on_thread,
      /** @export */ ib: _emscripten_set_keydown_callback_on_thread,
      /** @export */ hb: _emscripten_set_keypress_callback_on_thread,
      /** @export */ gb: _emscripten_set_keyup_callback_on_thread,
      /** @export */ mc: _emscripten_set_main_loop_arg,
      /** @export */ fb: _emscripten_set_mousedown_callback_on_thread,
      /** @export */ eb: _emscripten_set_mouseenter_callback_on_thread,
      /** @export */ db: _emscripten_set_mouseleave_callback_on_thread,
      /** @export */ cb: _emscripten_set_mousemove_callback_on_thread,
      /** @export */ bb: _emscripten_set_mouseup_callback_on_thread,
      /** @export */ ab: _emscripten_set_pointerlockchange_callback_on_thread,
      /** @export */ ya: _emscripten_set_resize_callback_on_thread,
      /** @export */ $a: _emscripten_set_touchcancel_callback_on_thread,
      /** @export */ _a: _emscripten_set_touchend_callback_on_thread,
      /** @export */ Za: _emscripten_set_touchmove_callback_on_thread,
      /** @export */ Ya: _emscripten_set_touchstart_callback_on_thread,
      /** @export */ Xa: _emscripten_set_visibilitychange_callback_on_thread,
      /** @export */ Wa: _emscripten_set_wheel_callback_on_thread,
      /** @export */ lc: _emscripten_set_window_title,
      /** @export */ xa: _emscripten_sleep,
      /** @export */ ai: _environ_get,
      /** @export */ $h: _environ_sizes_get,
      /** @export */ kc: _exit,
      /** @export */ ca: _fd_close,
      /** @export */ zb: _fd_read,
      /** @export */ Fb: _fd_seek,
      /** @export */ yb: _fd_write,
      /** @export */ wa: _glActiveTexture,
      /** @export */ jc: _glAttachShader,
      /** @export */ k: _glBindBuffer,
      /** @export */ J: _glBindFramebuffer,
      /** @export */ $: _glBindRenderbuffer,
      /** @export */ t: _glBindTexture,
      /** @export */ va: _glBindVertexArray,
      /** @export */ Va: _glBlendEquationSeparate,
      /** @export */ _: _glBlendFuncSeparate,
      /** @export */ ic: _glBlitFramebuffer,
      /** @export */ Ua: _glBufferData,
      /** @export */ Ta: _glBufferSubData,
      /** @export */ ua: _glCheckFramebufferStatus,
      /** @export */ O: _glClear,
      /** @export */ ta: _glClearColor,
      /** @export */ sa: _glClearDepthf,
      /** @export */ hc: _glClearStencil,
      /** @export */ Z: _glColorMask,
      /** @export */ gc: _glCompileShader,
      /** @export */ fc: _glCopyBufferSubData,
      /** @export */ Sa: _glCopyTexImage2D,
      /** @export */ ec: _glCreateProgram,
      /** @export */ dc: _glCreateShader,
      /** @export */ ra: _glCullFace,
      /** @export */ I: _glDeleteBuffers,
      /** @export */ cc: _glDeleteFramebuffers,
      /** @export */ bc: _glDeleteProgram,
      /** @export */ ac: _glDeleteQueries,
      /** @export */ qa: _glDeleteRenderbuffers,
      /** @export */ pa: _glDeleteShader,
      /** @export */ $b: _glDeleteTextures,
      /** @export */ oa: _glDeleteVertexArrays,
      /** @export */ na: _glDepthFunc,
      /** @export */ ma: _glDepthMask,
      /** @export */ H: _glDetachShader,
      /** @export */ o: _glDisable,
      /** @export */ Ra: _glDisableVertexAttribArray,
      /** @export */ N: _glDrawArrays,
      /** @export */ Qa: _glDrawArraysInstanced,
      /** @export */ Pa: _glDrawBuffers,
      /** @export */ _b: _glDrawElements,
      /** @export */ Zb: _glDrawElementsInstanced,
      /** @export */ s: _glDrawRangeElements,
      /** @export */ r: _glEnable,
      /** @export */ Y: _glEnableVertexAttribArray,
      /** @export */ Yb: _glFinish,
      /** @export */ la: _glFlush,
      /** @export */ Oa: _glFramebufferRenderbuffer,
      /** @export */ Na: _glFramebufferTexture2D,
      /** @export */ M: _glGenBuffers,
      /** @export */ Xb: _glGenFramebuffers,
      /** @export */ Wb: _glGenRenderbuffers,
      /** @export */ Vb: _glGenTextures,
      /** @export */ Ub: _glGenVertexArrays,
      /** @export */ ka: _glGenerateMipmap,
      /** @export */ ja: _glGetAttribLocation,
      /** @export */ y: _glGetBooleanv,
      /** @export */ i: _glGetError,
      /** @export */ ia: _glGetFloatv,
      /** @export */ u: _glGetFramebufferAttachmentParameteriv,
      /** @export */ c: _glGetIntegerv,
      /** @export */ Tb: _glGetProgramInfoLog,
      /** @export */ Ma: _glGetProgramiv,
      /** @export */ w: _glGetRenderbufferParameteriv,
      /** @export */ Sb: _glGetShaderInfoLog,
      /** @export */ La: _glGetShaderiv,
      /** @export */ G: _glGetString,
      /** @export */ Rb: _glGetStringi,
      /** @export */ Qb: _glGetUniformLocation,
      /** @export */ ha: _glLineWidth,
      /** @export */ Pb: _glLinkProgram,
      /** @export */ v: _glPixelStorei,
      /** @export */ Ob: _glReadBuffer,
      /** @export */ m: _glReadPixels,
      /** @export */ ga: _glRenderbufferStorage,
      /** @export */ Ka: _glRenderbufferStorageMultisample,
      /** @export */ X: _glScissor,
      /** @export */ Nb: _glShaderSource,
      /** @export */ F: _glStencilFuncSeparate,
      /** @export */ E: _glStencilMaskSeparate,
      /** @export */ D: _glStencilOpSeparate,
      /** @export */ g: _glTexImage2D,
      /** @export */ Mb: _glTexImage3D,
      /** @export */ Ja: _glTexParameterf,
      /** @export */ j: _glTexParameteri,
      /** @export */ Lb: _glTransformFeedbackVaryings,
      /** @export */ Kb: _glUniform1f,
      /** @export */ Jb: _glUniform1fv,
      /** @export */ Ib: _glUniform1i,
      /** @export */ Hb: _glUniform1iv,
      /** @export */ Ia: _glUniform2fv,
      /** @export */ Gb: _glUniform2iv,
      /** @export */ fa: _glUniform3fv,
      /** @export */ ea: _glUniform4fv,
      /** @export */ Ha: _glUniformMatrix3fv,
      /** @export */ da: _glUniformMatrix4fv,
      /** @export */ W: _glUseProgram,
      /** @export */ V: _glVertexAttribDivisor,
      /** @export */ U: _glVertexAttribPointer,
      /** @export */ T: _glViewport,
      /** @export */ S: invoke_i,
      /** @export */ b: invoke_ii,
      /** @export */ e: invoke_iii,
      /** @export */ q: invoke_iiii,
      /** @export */ Ga: invoke_iiiii,
      /** @export */ C: invoke_v,
      /** @export */ d: invoke_vi,
      /** @export */ f: invoke_vii,
      /** @export */ B: invoke_viii,
      /** @export */ L: invoke_viiii,
      /** @export */ Bb: _strftime_l,
    };

    var wasmExports = createWasm();

    var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["li"])();

    var _malloc = (a0) => (_malloc = wasmExports["mi"])(a0);

    var _main = (Module["_main"] = (a0, a1) =>
      (_main = Module["_main"] = wasmExports["ni"])(a0, a1));

    var _free = (a0) => (_free = wasmExports["pi"])(a0);

    var ___cxa_demangle = (a0, a1, a2, a3) =>
      (___cxa_demangle = wasmExports["qi"])(a0, a1, a2, a3);

    var ___getTypeName = (a0) => (___getTypeName = wasmExports["ri"])(a0);

    var _emscripten_builtin_memalign = (a0, a1) =>
      (_emscripten_builtin_memalign = wasmExports["si"])(a0, a1);

    var _setThrew = (a0, a1) => (_setThrew = wasmExports["ti"])(a0, a1);

    var stackSave = () => (stackSave = wasmExports["ui"])();

    var stackRestore = (a0) => (stackRestore = wasmExports["vi"])(a0);

    var stackAlloc = (a0) => (stackAlloc = wasmExports["wi"])(a0);

    var ___cxa_is_pointer_type = (a0) =>
      (___cxa_is_pointer_type = wasmExports["xi"])(a0);

    var dynCall_viij = (Module["dynCall_viij"] = (a0, a1, a2, a3, a4) =>
      (dynCall_viij = Module["dynCall_viij"] = wasmExports["yi"])(
        a0,
        a1,
        a2,
        a3,
        a4
      ));

    var dynCall_vij = (Module["dynCall_vij"] = (a0, a1, a2, a3) =>
      (dynCall_vij = Module["dynCall_vij"] = wasmExports["zi"])(
        a0,
        a1,
        a2,
        a3
      ));

    var dynCall_iij = (Module["dynCall_iij"] = (a0, a1, a2, a3) =>
      (dynCall_iij = Module["dynCall_iij"] = wasmExports["Ai"])(
        a0,
        a1,
        a2,
        a3
      ));

    var dynCall_viji = (Module["dynCall_viji"] = (a0, a1, a2, a3, a4) =>
      (dynCall_viji = Module["dynCall_viji"] = wasmExports["Bi"])(
        a0,
        a1,
        a2,
        a3,
        a4
      ));

    var dynCall_jiji = (Module["dynCall_jiji"] = (a0, a1, a2, a3, a4) =>
      (dynCall_jiji = Module["dynCall_jiji"] = wasmExports["Ci"])(
        a0,
        a1,
        a2,
        a3,
        a4
      ));

    var dynCall_ji = (Module["dynCall_ji"] = (a0, a1) =>
      (dynCall_ji = Module["dynCall_ji"] = wasmExports["Di"])(a0, a1));

    var dynCall_viijii = (Module["dynCall_viijii"] = (
      a0,
      a1,
      a2,
      a3,
      a4,
      a5,
      a6
    ) =>
      (dynCall_viijii = Module["dynCall_viijii"] = wasmExports["Ei"])(
        a0,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6
      ));

    var dynCall_iiiiij = (Module["dynCall_iiiiij"] = (
      a0,
      a1,
      a2,
      a3,
      a4,
      a5,
      a6
    ) =>
      (dynCall_iiiiij = Module["dynCall_iiiiij"] = wasmExports["Fi"])(
        a0,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6
      ));

    var dynCall_iiiiijj = (Module["dynCall_iiiiijj"] = (
      a0,
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8
    ) =>
      (dynCall_iiiiijj = Module["dynCall_iiiiijj"] = wasmExports["Gi"])(
        a0,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6,
        a7,
        a8
      ));

    var dynCall_iiiiiijj = (Module["dynCall_iiiiiijj"] = (
      a0,
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9
    ) =>
      (dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = wasmExports["Hi"])(
        a0,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6,
        a7,
        a8,
        a9
      ));

    function invoke_viiii(index, a1, a2, a3, a4) {
      var sp = stackSave();
      try {
        getWasmTableEntry(index)(a1, a2, a3, a4);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_iii(index, a1, a2) {
      var sp = stackSave();
      try {
        return getWasmTableEntry(index)(a1, a2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_iiiii(index, a1, a2, a3, a4) {
      var sp = stackSave();
      try {
        return getWasmTableEntry(index)(a1, a2, a3, a4);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_iiii(index, a1, a2, a3) {
      var sp = stackSave();
      try {
        return getWasmTableEntry(index)(a1, a2, a3);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_v(index) {
      var sp = stackSave();
      try {
        getWasmTableEntry(index)();
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_vii(index, a1, a2) {
      var sp = stackSave();
      try {
        getWasmTableEntry(index)(a1, a2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_ii(index, a1) {
      var sp = stackSave();
      try {
        return getWasmTableEntry(index)(a1);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_vi(index, a1) {
      var sp = stackSave();
      try {
        getWasmTableEntry(index)(a1);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_i(index) {
      var sp = stackSave();
      try {
        return getWasmTableEntry(index)();
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function invoke_viii(index, a1, a2, a3) {
      var sp = stackSave();
      try {
        getWasmTableEntry(index)(a1, a2, a3);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
      }
    }

    function applySignatureConversions(wasmExports) {
      wasmExports = Object.assign({}, wasmExports);
      var makeWrapper_pp = (f) => (a0) => f(a0) >>> 0;
      var makeWrapper_ppp = (f) => (a0, a1) => f(a0, a1) >>> 0;
      var makeWrapper_p = (f) => () => f() >>> 0;
      wasmExports["mi"] = makeWrapper_pp(wasmExports["mi"]);
      wasmExports["ri"] = makeWrapper_pp(wasmExports["ri"]);
      wasmExports["si"] = makeWrapper_ppp(wasmExports["si"]);
      wasmExports["ui"] = makeWrapper_p(wasmExports["ui"]);
      wasmExports["wi"] = makeWrapper_pp(wasmExports["wi"]);
      return wasmExports;
    }

    var calledRun;

    dependenciesFulfilled = function runCaller() {
      if (!calledRun) run();
      if (!calledRun) dependenciesFulfilled = runCaller;
    };

    function callMain() {
      var entryFunction = _main;
      var argc = 0;
      var argv = 0;
      try {
        var ret = entryFunction(argc, argv);
        exitJS(ret, /* implicit = */ true);
        return ret;
      } catch (e) {
        return handleException(e);
      }
    }

    function run() {
      if (runDependencies > 0) {
        return;
      }
      preRun();
      if (runDependencies > 0) {
        return;
      }
      function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        readyPromiseResolve(Module);
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
        if (shouldRunNow) callMain();
        postRun();
      }
      if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function () {
          setTimeout(function () {
            Module["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }

    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
      }
    }

    var shouldRunNow = true;

    if (Module["noInitialRun"]) shouldRunNow = false;

    run();

    return moduleArg.ready;
  };
})();
export default Module;
