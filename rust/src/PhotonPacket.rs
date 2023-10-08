
pub struct PhotonPacket {
    // Position
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub r: f64,

    // Direction
    pub ux: f64,
    pub uy: f64,
    pub uz: f64,

    pub weight: f64,
    pub step_size: f64,
    pub step_size_left: f64,

    pub layer: usize,
    pub dead: bool,

    // Cached layer properties
    pub layer_mua: f64,
    pub layer_mus: f64,
    pub layer_z0: f64,
    pub layer_z1: f64,
    pub layer_g: f64
}

impl PhotonPacket {
    pub fn new() -> PhotonPacket {
        PhotonPacket {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            r: 0.0,
            ux: 0.0,
            uy: 0.0,
            uz: 0.0,
            weight: 0.0,
            step_size: 0.0,
            step_size_left: 0.0,
            layer: 0,
            dead: false,
            layer_mua: 0.0,
            layer_mus: 0.0,
            layer_z0: 0.0,
            layer_z1: 0.0,
            layer_g: 0.0
        }
    }
}