use crate::{PhotonPacket::PhotonPacket, RunConfig::RunConfig, Simulation};

pub fn gen_rand_float(main: &mut Simulation) -> f64 {
    let rand = main.rng.next_u32();
    rand as f64 / std::u32::MAX as f64
}


/***********************************************************
 * Compute the specular reflection.
 *
 * If the first layer is a turbid medium, use the Fresnel
 * reflection from the boundary of the first layer as the
 * specular reflectance.
 *
 * If the first layer is glass, multiple reflections in
 * the first layer is considered to get the specular
 * reflectance.
 *
 * The subroutine assumes the Layerspecs array is correctly
 * initialized.
 ****/
pub fn calculate_r_specular(run_config: &RunConfig) -> f64 {
    let mut r1: f64;
    /* direct reflections from the 1st and 2nd layers. */
    let mut temp: f64;

    let layers = &run_config.layers;

    temp = (layers[0].n - layers[1].n) / (layers[0].n + layers[1].n);
    r1 = temp * temp;

    if layers[1].mua == 0.0 && layers[1].mus == 0.0 {
        /* glass layer. */
        temp = (layers[1].n - layers[2].n) / (layers[1].n + layers[2].n);
        
        let r2 = temp * temp;
        r1 = r1 + (1.0 - r1) * (1.0 - r1) * r2 / (1.0 - r1 * r2);
    }
    return r1;
}

// Cache layer properties in the photon for faster access.
pub fn update_layer(main: &Simulation, photon: &mut PhotonPacket) {
    let layer = &main.run_config.layers[photon.layer];
    photon.layer_mua = layer.mua;
    photon.layer_mus = layer.mus;
    photon.layer_z0 = layer.z0;
    photon.layer_z1 = layer.z1;
    photon.layer_g = layer.g;
}

/***********************************************************
*   Initialize a photon packet.
****/
pub fn launch_photon(main: &Simulation, photon: &mut PhotonPacket) {
    photon.weight = 1.0 - main.r_specular;
    photon.layer = 1;

    let n1 = main.run_config.layers[0].n;
    let n2 = main.run_config.layers[photon.layer].n;
    let n_rel = n2 / n1;
    let alphai = main.run_config.alpha;
    
    
    // use snells law
    let alphat = (alphai.to_radians().sin() / n_rel).asin();
    photon.ux = alphat.sin();
    photon.uz = alphat.cos();

    update_layer(main, photon);
}

/***********************************************************
 *  Choose (sample) a new theta angle for photon propagation
 *  according to the anisotropy.
 *
 *  If anisotropy g is 0, then
 *      cos(theta) = 2*rand-1.
 *  otherwise
 *  sample according to the Henyey-Greenstein function.
 *
 *  Returns the cosine of the polar deflection angle theta.
 ****/
pub fn spin_theta(main: &mut Simulation, g: f64) -> f64 {
    let mut cost: f64;
    let random = gen_rand_float(main);
    
    if g == 0.0 {
        cost = 2.0 * random - 1.0;
    } else {
        let temp = (1.0 - g * g) / (1.0 - g + 2.0 * g * random);
        cost = (1.0 + g * g - temp * temp) / (2.0 * g);
        if cost < -1.0 {
            cost = -1.0;
        } else if cost > 1.0 {
            cost = 1.0;
        }
    }
    return cost;
}

/***********************************************************
 *  Choose a new direction for photon propagation by
 *  sampling the polar deflection angle theta and the
 *  azimuthal angle psi.
 *
 *  Note:
 *      theta: 0 - pi so sin(theta) is always positive
 *      feel free to use sqrt() for cos(theta).
 *
 *      psi:   0 - 2pi
 *      for 0-pi  sin(psi) is +
 *      for pi-2pi sin(psi) is -
 ****/
pub fn spin(main: &mut Simulation, g: f64, photon: &mut PhotonPacket) {
    let ux = photon.ux;
    let uy = photon.uy;
    let uz = photon.uz;

    /* cosine and sine of the */
    /* polar deflection angle theta. */
    let cost = spin_theta(main, g);
    let sint = (1.0 - cost * cost).sqrt();
    /* sqrt() is faster than sin(). */

    /* cosine and sine of the */
    /* azimuthal angle psi. */
    let psi = 2.0 * std::f64::consts::PI * gen_rand_float(main); /* spin psi 0-2pi. */
    let cosp = psi.cos();
    let sinp;

    if psi < std::f64::consts::PI {
        sinp = (1.0 - cosp * cosp).sqrt();
    } else {
        /* sqrt() is faster than sin(). */
        sinp = -(1.0 - cosp * cosp).sqrt();
    }

    if (uz).abs() > 1.0 - 1.0E-12 {
        /* normal incident. */
        photon.ux = sint * cosp;
        photon.uy = sint * sinp;
        photon.uz = cost * uz.signum();
        /* SIGN() is faster than division. */
    } else {
        /* regular incident. */
        let temp = (1.0 - uz * uz).sqrt();
        photon.ux = sint * (ux * uz * cosp - uy * sinp) / temp + ux * cost;
        photon.uy = sint * (uy * uz * cosp + ux * sinp) / temp + uy * cost;
        photon.uz = -sint * cosp * temp + uz * cost;
    }

    photon.scatters += 1;
}

/***********************************************************
 * Move the photon s away in the current layer of medium.
 ****/
pub fn hop(photon: &mut PhotonPacket) {
    let s = photon.step_size;

    photon.x += s * photon.ux;
    photon.y += s * photon.uy;
    photon.z += s * photon.uz;

    // update the r hypotenuse
    photon.r = (photon.x * photon.x + photon.y * photon.y).sqrt();
}

/***********************************************************
 *  If uz != 0, return the photon step size in glass,
 *  Otherwise, return 0.
 *
 *  The step size is the distance between the current
 *  position and the boundary in the photon direction.
 *
 *  Make sure uz !=0 before calling this function.
 ****/
pub fn step_size_in_glass(photon: &mut PhotonPacket) {
    let dl_b: f64; /* step size to boundary. */
    let uz = photon.uz;

    /* Stepsize to the boundary. */
    if uz > 0.0 {
        dl_b = (photon.layer_z1 - photon.z) / uz;
    } else if uz < 0.0 {
        dl_b = (photon.layer_z0 - photon.z) / uz;
    } else {
        dl_b = 0.0;
    }

    photon.step_size = dl_b;
}

/**
 * Pick a step size for a photon packet when it is in tissue.
 * If the member sleft is zero, make a new step size with: -Math.log(Math.random()) / (mua + mus).
 * Otherwise, pick up the leftover in sleft.
 */
pub fn step_size_in_tissue(main: &mut Simulation, photon: &mut PhotonPacket) {
    let mua = photon.layer_mua;
    let mus = photon.layer_mus;

    if photon.step_size_left == 0.0 {
        let mut rnd = 0.0;
        while rnd <= 0.0 {
            // Avoid zero.
            rnd = gen_rand_float(main);
        }

        photon.step_size = -rnd.ln() / (mua + mus);
    } else {
        photon.step_size = photon.step_size_left / (mua + mus);
        photon.step_size_left = 0.0;
    }
}

/**
 * Check if the step will hit the boundary.
 * Return true (1) if it hits the boundary.
 * Return false (0) otherwise.
 * If the projected step hits the boundary, update the s and sleft members of Photon_Ptr.
 */
pub fn hit_boundary(photon: &mut PhotonPacket) -> bool {
    let dl_b: f64; /* length to boundary. */
    let uz = photon.uz;

    /* calculate distance to the boundary. */
    if uz > 0.0 {
        dl_b = (photon.layer_z1 - photon.z) / uz; /* dl_b > 0. */
    } else if uz < 0.0 {
        dl_b = (photon.layer_z0 - photon.z) / uz; /* dl_b > 0. */
    } else {
        dl_b = 0.0;
    }

    if uz != 0.0 && photon.step_size > dl_b {
        /* not horizontal and crossing. */
        let mut_ = photon.layer_mua + photon.layer_mus;

        photon.step_size_left = (photon.step_size - dl_b) * mut_;
        photon.step_size = dl_b;
        return true;
    } else {
        return false;
    }
}

/**
 * Drop photon weight inside the tissue (not glass).
 * The photon is assumed not dead.
 * The weight drop is dw = w * mua / (mua + mus).
 * The dropped weight is assigned to the absorption array elements.
 */
pub fn drop(main: &mut Simulation, photon: &mut PhotonPacket) {
    let izd: usize = (photon.z / main.run_config.dz) as usize;
    let iz = izd.min(main.run_config.nz - 1);

    let ird: usize = (photon.r / main.run_config.dr) as usize;
    let ir = ird.min(main.run_config.nr - 1);

    let mua = photon.layer_mua;
    let mus = photon.layer_mus;
    let dwa = (photon.weight * mua) / (mua + mus);
    photon.weight -= dwa;

    main.results.a_rz[ir * main.run_config.nz + iz] += dwa;
}

/***********************************************************
 *  The photon weight is small, and the photon packet tries
 *  to survive a roulette.
 ****/
pub fn roulette(main: &mut Simulation, photon: &mut PhotonPacket) {
    if photon.weight == 0.0 {
        photon.dead = true;
    } else if gen_rand_float(main) < main.run_config.chance {
        photon.weight /= main.run_config.chance;
    } else {
        photon.dead = true;
    }
}

/***********************************************************
 * Compute the Fresnel reflectance.
 *
 * Make sure that the cosine of the incident angle a1
 * is positive, and the case when the angle is greater
 * than the critical angle is ruled out.
 *
 * Avoid trigonometric function operations as much as
 * possible, because they are computation-intensive.
 ****/
pub fn rfresnel(n1: f64, n2: f64, ca1: f64) -> (f64, f64) {
    let r: f64;
    let ca2: f64;

    if n1 == n2 {
        ca2 = ca1;
        r = 0.0;
    } else if ca1 > 1.0 - 1.0E-12 {
        ca2 = ca1;
        r = ((n2 - n1) / (n2 + n1)).powi(2);
    } else if ca1 < 1.0E-6 {
        ca2 = 0.0;
        r = 1.0;
    } else {
        let sa1 = (1.0 - ca1 * ca1).sqrt();
        let sa2 = (n1 * sa1) / n2;

        if sa2 >= 1.0 {
            ca2 = 0.0;
            r = 1.0;
        } else {
            ca2 = (1.0 - sa2 * sa2).sqrt();
            let cap = ca1 * ca2 - sa1 * sa2;
            let cam = ca1 * ca2 + sa1 * sa2;
            let sap = sa1 * ca2 + ca1 * sa2;
            let sam = sa1 * ca2 - ca1 * sa2;

            r = 0.5 * sam * sam * (cam * cam + cap * cap) / (sap * sap * cam * cam);
        }
    }

    return (r, ca2);
}

/***********************************************************
 * Record the photon weight exiting the first layer (uz < 0),
 * no matter whether the layer is glass or not, to the
 * reflection array.
 *
 * Update the photon weight as well.
 ****/
pub fn record_r(main: &mut Simulation, refl: f64, photon: &mut PhotonPacket) {
    let ir: usize;
    let ia: usize;

    let ird: usize = (photon.r / main.run_config.dr) as usize;
    if ird > main.run_config.nr - 1 {
        ir = main.run_config.nr - 1;
    } else {
        ir = ird;
    }

    let iad: usize = ((-photon.uz).acos() / main.run_config.da) as usize;
    if iad > main.run_config.na - 1 {
        ia = main.run_config.na - 1;
    } else {
        ia = iad;
    }

    // clamp ix to 0 and nr*2
    let ix = (((photon.x / main.run_config.dr).round() as i64) + (main.run_config.nr as i64)).max(0).min((main.run_config.nr * 2 - 1) as i64) as usize;

    if photon.scatters > 0 {
        // Assign photon to the reflection array element.
        main.results.rd_ra[ir * main.run_config.na + ia] += photon.weight * (1.0 - refl);
        main.results.rd_x[ix] += photon.weight * (1.0 - refl);
    } else {
        main.results.rd_unscattered += photon.weight * (1.0 - refl);
    }

    photon.weight *= refl;
}

/***********************************************************
 *  Record the photon weight exiting the last layer(uz>0),
 *  no matter whether the layer is glass or not, to the
 *  transmittance array.
 *
 *  Update the photon weight as well.
 ****/
pub fn record_t(main: &mut Simulation, refl: f64, photon: &mut PhotonPacket) {
    let ir: usize;
    let ia: usize;

    let ird: usize = (photon.r / main.run_config.dr) as usize;
    if ird > main.run_config.nr - 1 {
        ir = main.run_config.nr - 1;
    } else {
        ir = ird;
    }

    let iad: usize = ((photon.uz).acos() / main.run_config.da) as usize;
    if iad > main.run_config.na - 1 {
        ia = main.run_config.na - 1;
    } else {
        ia = iad;
    }

    if photon.scatters > 0 {
        // Assign photon to the transmittance array element.
        main.results.tt_ra[ir * main.run_config.na + ia] += photon.weight * (1.0 - refl);
    } else {
        main.results.tt_unscattered += photon.weight * (1.0 - refl);
    }

    photon.weight *= refl;
}

/***********************************************************
 *Decide whether the photon will be transmitted or
*reflected on the upper boundary (uz<0) of the current
*layer.
*
*If "layer" is the first layer, the photon packet will
*be partially transmitted and partially reflected if
*PARTIALREFLECTION is set to 1,
*or the photon packet will be either transmitted or
*reflected determined statistically if PARTIALREFLECTION
*is set to 0.
*
*Record the transmitted photon weight as reflection.
*
*If the "layer" is not the first layer and the photon
*packet is transmitted, move the photon to "layer-1".
*
*Update the photon parmameters.
****/
pub fn cross_up_or_not(main: &mut Simulation, photon: &mut PhotonPacket) {
    let uz = photon.uz; /* z directional cosine. */
    let uz1; /* cosines of transmission alpha. always */
    /* positive. */
    // let mut r = 0.0; /* reflectance */
    let layer = photon.layer;
    let ni = main.run_config.layers[layer].n;
    let nt = main.run_config.layers[layer - 1].n;

    /* Get r. */
    if -uz <= main.run_config.layers[layer].cos_crit0 {
        //r = 1.0; /* total internal reflection. */
        /* reflected. */
        photon.uz = -uz;
    } else {
        let res = rfresnel(ni, nt, -uz);
        //r = res.0;
        uz1 = res.1;

        if gen_rand_float(main) > res.0 {
            /* transmitted to layer-1. */
            if layer == 1 {
                photon.uz = -uz1;
                record_r(main, 0.0, photon);
                photon.dead = true;
            } else {
                photon.layer -= 1;
                update_layer(main, photon);
                photon.ux *= ni / nt;
                photon.uy *= ni / nt;
                photon.uz = -uz1;
            }
        } else {
            /* reflected. */
            photon.uz = -uz;
        }
    }
}

//       /***********************************************************
//      * Decide whether the photon will be transmitted  or be
//      * reflected on the bottom boundary (uz>0) of the current
//      * layer.
//      *
//      * If the photon is transmitted, move the photon to
//      * "layer+1". If "layer" is the last layer, record the
//      * transmitted weight as transmittance. See comments for
//      * CrossUpOrNot.
//      *
//      * Update the photon parmameters.
pub fn cross_dn_or_not(main: &mut Simulation, photon: &mut PhotonPacket) {
    let uz = photon.uz; /* z directional cosine. */
    let uz1; /* cosines of transmission alpha. */
    // let mut r = 0.0; /* reflectance */
    let layer = photon.layer;
    let ni = main.run_config.layers[layer].n;
    let nt = main.run_config.layers[layer + 1].n;

    /* Get r. */
    if uz <= main.run_config.layers[layer].cos_crit1 {
        // r = 1.0; /* total internal reflection. */
        /* reflected. */
        photon.uz = -uz;
    } else {
        let res = rfresnel(ni, nt, uz);
        // r = res.0;
        uz1 = res.1;

        if gen_rand_float(main) > res.0 {
            /* transmitted to layer+1. */
            if layer == main.run_config.layers.len() - 2 {
                photon.uz = uz1;
                record_t(main, 0.0, photon);
                photon.dead = true;
            } else {
                photon.layer += 1;
                update_layer(main, photon);
                photon.ux *= ni / nt;
                photon.uy *= ni / nt;
                photon.uz = uz1;
            }
        } else {
            /* reflected. */
            photon.uz = -uz;
        }
    }
}

/***********************************************************
 ****/
pub fn cross_or_not(main: &mut Simulation, photon: &mut PhotonPacket) {
    if photon.uz < 0.0 {
        cross_up_or_not(main, photon);
    } else {
        cross_dn_or_not(main, photon);
    }
}

/***********************************************************
 *  Move the photon packet in glass layer.
 *  Horizontal photons are killed because they will
 *  never interact with tissue again.
 ****/
pub fn hop_in_glass(main: &mut Simulation, photon: &mut PhotonPacket) {
    if photon.uz == 0.0 {
        photon.dead = true;
    } else {
        step_size_in_glass(photon);
        hop(photon);
        cross_or_not(main, photon);
    }
}

/***********************************************************
 * Set a step size, move the photon, drop some weight,
 * choose a new photon direction for propagation.
 *
 * When a step size is long enough for the photon to
 * hit an interface, this step is divided into two steps.
 * First, move the photon to the boundary free of
 * absorption or scattering, then decide whether the
 * photon is reflected or transmitted.
 * Then move the photon in the current or transmission
 * medium with the unfinished stepsize to interaction
 * site.  If the unfinished stepsize is still too long,
 * repeat the above process.
 ****/
pub fn hop_drop_spin_in_tissue(main: &mut Simulation, photon: &mut PhotonPacket) {
    step_size_in_tissue(main, photon);

    if hit_boundary(photon) {
        hop(photon);
        cross_or_not(main, photon);
    } else {
        hop(photon);
        drop(main, photon);
        spin(main, photon.layer_g, photon);
    }
}

pub fn hop_drop_spin(main: &mut Simulation, photon: &mut PhotonPacket) {
    if photon.layer_mua == 0.0 && photon.layer_mus == 0.0 {
        hop_in_glass(main, photon);
    } else {
        hop_drop_spin_in_tissue(main, photon);
    }

    if photon.weight < main.run_config.wth && !photon.dead {
        roulette(main, photon);
    }
}
