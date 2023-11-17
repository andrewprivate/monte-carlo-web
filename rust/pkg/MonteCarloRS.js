let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
/**
*/
export class Simulation {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Simulation.prototype);
        obj.__wbg_ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_simulation_free(ptr);
    }
    /**
    * @returns {Simulation}
    */
    static new() {
        const ret = wasm.simulation_new();
        return Simulation.__wrap(ret);
    }
    /**
    * @param {number} alpha
    * @param {number} dz
    * @param {number} dr
    * @param {number} da
    * @param {number} nz
    * @param {number} nr
    * @param {number} na
    * @param {number} nt
    * @param {number} wth
    * @param {number} chance
    */
    configure_run(alpha, dz, dr, da, nz, nr, na, nt, wth, chance) {
        wasm.simulation_configure_run(this.__wbg_ptr, alpha, dz, dr, da, nz, nr, na, nt, wth, chance);
    }
    /**
    * @param {bigint} seed
    */
    set_seed(seed) {
        wasm.simulation_set_seed(this.__wbg_ptr, seed);
    }
    /**
    */
    clear_layers() {
        wasm.simulation_clear_layers(this.__wbg_ptr);
    }
    /**
    * @param {number} n
    * @param {number} mua
    * @param {number} mus
    * @param {number} g
    * @param {number} d
    */
    add_layer(n, mua, mus, g, d) {
        wasm.simulation_add_layer(this.__wbg_ptr, n, mua, mus, g, d);
    }
    /**
    */
    initialize() {
        wasm.simulation_initialize(this.__wbg_ptr);
    }
    /**
    */
    launch_photon() {
        wasm.simulation_launch_photon(this.__wbg_ptr);
    }
    /**
    * @param {number} n
    */
    launch_photons(n) {
        wasm.simulation_launch_photons(this.__wbg_ptr, n);
    }
    /**
    * @returns {Float64Array}
    */
    get_tt_ra() {
        const ret = wasm.simulation_get_tt_ra(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {Float64Array}
    */
    get_rd_ra() {
        const ret = wasm.simulation_get_rd_ra(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {Float64Array}
    */
    get_rd_x() {
        const ret = wasm.simulation_get_rd_x(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {Float64Array}
    */
    get_a_rz() {
        const ret = wasm.simulation_get_a_rz(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {Float64Array}
    */
    get_w_txz() {
        const ret = wasm.simulation_get_w_txz(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {number}
    */
    get_r_specular() {
        const ret = wasm.simulation_get_r_specular(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_rd_unscattered() {
        const ret = wasm.simulation_get_rd_unscattered(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_tt_unscattered() {
        const ret = wasm.simulation_get_tt_unscattered(this.__wbg_ptr);
        return ret;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_buffer_085ec1f694018c4f = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_b8047c68e84e60be = function(arg0, arg1, arg2) {
        const ret = new Float64Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbg_new_c13cb67c90ba8a3b = function(arg0) {
        const ret = new Float64Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, maybe_memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedUint8Memory0 = null;


    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;

    if (typeof input === 'undefined') {
        input = new URL('MonteCarloRS_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
        input = fetch(input);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await input, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync }
export default __wbg_init;
