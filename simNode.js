const state = {
    S: "green", // Susceptible
    E: "yellow", // Exposed, latent period
    I: "red",
    H: "grey",
    R: "blue" // Removed state
};

class location {
    constructor(name, index, ) {

    }
}

class Node {
    constructor(width, height, index, age) {
        let angle = Math.random() * 2 * Math.PI;

        // Variables
        this.index = index;
        this.x = d3.randomUniform(width * 0.1, width * 0.9)();
        this.y = d3.randomUniform(height * 0.1, height * 0.9)();
        this.vx = param.speed * Math.cos(angle);
        this.vy = param.speed * Math.sin(angle);
        this.state = state.S;
        this.age = age;
        this.mask = false;
        this.loc = "Outside";
        this.flag = null;
    }

    // Methods

    /*
        Moves this node to certain location.
        Location should be passed by {loc_count, xrange, yrange, surface} form.
     */
    move(loc_to) {
        this.flag = "move";
        this.x = d3.randomUniform(...loc_to.xrange)();
        this.y = d3.randomUniform(...loc_to.yrange)();
        this.loc = loc_to;
        this.flag = null;
    }

    /*
        Infects this node
     */
    infected() {
        if (this.state !== state.S) return;
        this.state = state.E;
        setTimeout(() => {
            this.state = state.I;
            if ("quarantine" in param.flag &&
                Math.random() < param.hospitalized_rate &&
                simulation.nodes().filter(e => e.state === state.H).length < param.hospitalization_max) {
                setTimeout(this.hospitalized.bind(this), 1000);
            }
            setTimeout(this.removed.bind(this), param.infect_period);
        }, param.latent_period * 1000)
    }

    /*
        Hospitalizes this node
     */
    hospitalized() {
        this.state = state.H;
        this.move(simulation.loc[1]);
    }

    /*
        Removed node, either recovered or dead
     */
    removed() {
        this.state = state.R;
        this.move(simulation.loc[3]);
    }

    /*
        Recursively moves this node to school
     */
    to_school() {
        if (this.state === state.H) return;
        this.move(simulation.loc[2]);
        setTimeout(this.from_school.bind(this), 1000);
    }

    /*
        Recursively moves this node from school
     */
    from_school() {
        if (this.state === state.H) return;
        this.move(simulation.loc[0]);
        setTimeout(this.to_school.bind(this), 1000);
    }

    /*
        Checks if this node exceeds given location range
     */
    check_loc() {
        if (this.x < this.loc.xrange[0] || this.x > this.loc.xrange[1]) {
            this.x = d3.randomUniform(...this.loc.xrange)();
        }
        if (this.y < this.loc.yrange[0] || this.y > this.loc.yrange[1]) {
            this.y = d3.randomUniform(...this.loc.yrange)();
        }
    }

}