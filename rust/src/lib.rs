#![allow(non_snake_case)]
use rand_mt::Mt64;
use wasm_bindgen::prelude::*;
use js_sys::Float64Array;

mod Go;
mod PhotonPacket;
mod RunConfig;

pub struct Results {
    tt_ra: Vec<f64>,
    rd_ra: Vec<f64>,
    a_rz: Vec<f64>,
    w_txz: Vec<f64>,
    rd_unscattered: f64,
    tt_unscattered: f64,
}

#[wasm_bindgen]
pub struct Simulation {
    run_config: RunConfig::RunConfig,
    r_specular: f64,
    rng: Mt64,
    results: Results,
}

impl Simulation {
    fn initialize_results(&mut self) {
        self.results.tt_ra = vec![0.0; self.run_config.na * self.run_config.nr];
        self.results.rd_ra = vec![0.0; self.run_config.na * self.run_config.nr];
        self.results.a_rz = vec![0.0; self.run_config.nz * self.run_config.nr];
        self.results.w_txz = vec![0.0; self.run_config.nz * self.run_config.nr * 2 * self.run_config.nt];
        self.results.rd_unscattered = 0.0;
        self.results.tt_unscattered = 0.0;
    }
}

#[wasm_bindgen]
impl Simulation {
    pub fn new() -> Simulation {
        Simulation {
            run_config: RunConfig::RunConfig::new(),
            r_specular: 0.0,
            rng: Mt64::new(0),
            results: Results {
                tt_ra: Vec::new(),
                rd_ra: Vec::new(),
                a_rz: Vec::new(),
                w_txz: Vec::new(),
                rd_unscattered: 0.0,
                tt_unscattered: 0.0,
            },
        }
    }

    pub fn configure_run(
        &mut self,
        dz: f64,
        dr: f64,
        da: f64,
        nz: usize,
        nr: usize,
        na: usize,
        nt: usize,
        wth: f64,
        chance: f64,
    ) {
        self.run_config.dz = dz;
        self.run_config.dr = dr;
        self.run_config.da = da;
        self.run_config.nz = nz;
        self.run_config.nr = nr;
        self.run_config.na = na;
        self.run_config.nt = nt;
        self.run_config.wth = wth;
        self.run_config.chance = chance;

        self.initialize_results();
    }

    pub fn set_seed(&mut self, seed: u64) {
        self.rng = Mt64::new(seed);
    }

    pub fn clear_layers(&mut self) {
        self.run_config.layers.clear();
    }

    pub fn add_layer(&mut self, n: f64, mua: f64, mus: f64, g: f64, d: f64) {
        self.run_config.add_layer(n, mua, mus, g, d);
    }

    pub fn initialize(&mut self) {
        self.run_config.update_layer_boundaries();
        self.run_config.update_cos_crit();
        self.initialize_results();

        self.r_specular = Go::calculate_r_specular(&self.run_config);
    }

    pub fn launch_photon(&mut self) {
        let mut photon = PhotonPacket::PhotonPacket::new();

        // Launch
        Go::launch_photon(&self, &mut photon);

        let mut tick = 0;
        while !photon.dead {
            Go::hop_drop_spin(self, &mut photon);

            if tick < self.run_config.nt {
                let ix: i64 = ((photon.x / self.run_config.dr).round() as i64) + (self.run_config.nr as i64);
                let iz: usize = (photon.z / self.run_config.dz) as usize;
                if ix >= 0 && ix < ((self.run_config.nr * 2) as i64) && iz < self.run_config.nz {
                    self.results.w_txz[tick * self.run_config.nz * self.run_config.nr * 2 + (ix as usize) * self.run_config.nz + iz] += photon.weight;
                }
            }

            tick += 1;
        }
    }

    pub fn launch_photons(&mut self, n: usize) {
        for _ in 0..n {
            self.launch_photon();
        }
    }

    pub fn get_tt_ra(&self) -> Float64Array {
        Float64Array::from(self.results.tt_ra.as_slice())
    }

    pub fn get_rd_ra(&self) -> Float64Array {
        Float64Array::from(self.results.rd_ra.as_slice())
    }

    pub fn get_a_rz(&self) -> Float64Array {
        Float64Array::from(self.results.a_rz.as_slice())
    }

    pub fn get_w_txz(&self) -> Float64Array {
        Float64Array::from(self.results.w_txz.as_slice())
    }

    pub fn get_r_specular(&self) -> f64 {
        self.r_specular
    }

    pub fn get_rd_unscattered(&self) -> f64 {
        self.results.rd_unscattered
    }

    pub fn get_tt_unscattered(&self) -> f64 {
        self.results.tt_unscattered
    }
}
