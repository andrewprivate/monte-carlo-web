// Run config struct

pub struct Layer {
    pub n: f64,         // Refractive index
    pub mua: f64,       // Absorption coefficient
    pub mus: f64,       // Scattering coefficient
    pub g: f64,         // Anisotropy
    pub d: f64,         // Thickness

    // z0 and z1 are the boundaries of the layer
    pub z0: f64, 
    pub z1: f64,

    // cos_crit0 and cos_crit1 are the critical angles of the layer
    pub cos_crit0: f64,
    pub cos_crit1: f64
}

impl Layer {
    pub fn new(n: f64, mua: f64, mus: f64, g: f64, d: f64) -> Layer {
        Layer {
            n: n,
            mua: mua,
            mus: mus,
            g: g,
            d: d,
            z0: 0.0,
            z1: 0.0,
            cos_crit0: 0.0,
            cos_crit1: 0.0
        }
    }
}

pub struct RunConfig {
    pub dz: f64,        // Step size in z
    pub dr: f64,        // Step size in r
    pub da: f64,        // Step size in angle
    pub nz: usize,      // Number of steps in z
    pub nr: usize,      // Number of steps in r
    pub na: usize,      // Number of steps in angle
    pub nt: usize,      // Number of time steps

    pub wth: f64,       // Weight threshold
    pub chance: f64,    // Chance of photon survival

    // vec for layers
    pub layers: Vec<Layer>
}

impl RunConfig {
    pub fn new() -> RunConfig {
        RunConfig {
            dz: 0.0,
            dr: 0.0,
            da: 0.0,
            nz: 0,
            nr: 0,
            na: 0,
            nt: 0,
            wth: 0.0,
            chance: 0.0,
            layers: Vec::new()
        }
    }

    pub fn add_layer(&mut self, n: f64, mua: f64, mus: f64, g: f64, d: f64) {
        let layer = Layer::new(n, mua, mus, g, d);
        self.layers.push(layer);
    }

    pub fn update_layer_boundaries(&mut self) {
        let mut z = 0.0;
        for layer in &mut self.layers {
            layer.z0 = z;
            layer.z1 = z + layer.d;
            z += layer.d;
        }
    }

    pub fn update_cos_crit(&mut self) {
        for i in 1..(self.layers.len() - 1) {
            let n2 = self.layers[i - 1].n;
            let n3 = self.layers[i + 1].n;

            let layer = &mut self.layers[i];
            let n1 = layer.n;

            layer.cos_crit0 = if n1 > n2 { 
                (1.0 - n2 * n2 / (n1 * n1)).sqrt() 
            } else { 
                0.0 
            };

            layer.cos_crit1 = if n1 > n3 { 
                (1.0 - n3 * n3 / (n1 * n1)).sqrt() 
            } else { 
                0.0 
            };
        }
    }
}