const state = {
    S: "green", // Susceptible
    E: "yellow", // Exposed, latent period
    I: "red",
    H: "grey",
    R: "blue" // Removed state
};

class simlocation {
    constructor(name, index, coor_x, coor_y, width, height) {
        this.name = name;
        this.index = index;
        this.width = width;
        this.height = height;
        this.x = coor_x;
        this.y = coor_y;

        this.surface = [
            {
                from: {x: coor_x, y: coor_y}, to: {x: coor_x + width, y: coor_y}
            },
            {
                from: {x: coor_x + width, y: coor_y}, to: {x: coor_x + width, y: coor_y + height}
            },
            {
                from: {x: coor_x + width, y: coor_y + height}, to: {x: coor_x, y: coor_y + height}
            },
            {
                from: {x: coor_x, y: coor_y + height}, to: {x: coor_x, y: coor_y}
            }
        ];

        this.xrange = [coor_x, coor_x + width];
        this.yrange = [coor_y, coor_y + height];
    }
}

class locs {
    constructor () {
        this.list = [];
    }

    by_index (index) {
        return this.list[index];
    }

    by_name (name) {
        let found_loc = this.list.filter(loc => loc.name === name);
        if (found_loc.length > 1) {
            return found_loc[Math.floor(Math.random() * found_loc.length)];
        } else return this.list.find(loc => loc.name === name);
    }

    push(x) {
        this.list.push(x);
        this.length = this.list.length;
    }

    get_surface() {
        return Array.from(this.list, e => e.surface).flat();
    }
}

class Node {
    constructor(param, width, height, index, age) {
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
        this.flag = [];
        this.param = param;
        this.run = true;
        this.quarantine_interval = null;
    }

    // Methods

    /*
        Moves this node to certain location.
        Location should be passed by {loc_count, xrange, yrange, surface} form.
     */
    move(loc_to) {
        if (this.loc.name === loc_to.name) return;
        this.flag.push("move");
        this.x = d3.randomUniform(...loc_to.xrange)();
        this.y = d3.randomUniform(...loc_to.yrange)();
        if (loc_to.name !== "hospital") {
            this.fx = null;
            this.fy = null;
            let angle = Math.random() * 2 * Math.PI;
            this.vx = this.param.speed * Math.cos(angle);
            this.vy = this.param.speed * Math.sin(angle);
        } else {
            this.fx = this.x;
            this.fy = this.y;
        }
        this.loc = loc_to;
        this.flag.splice(this.flag.indexOf("move"), 1);
    }

    /*
        Infects this node
     */
    infected() {
        if (this.state !== state.S) return;
        if (!this.run) return;
        this.state = state.E;
        setTimeout(() => {
            this.state = state.I;
            if (this.param.flag.includes("quarantine") &&
                Math.random() < this.param.hospitalized_rate) {
                this.quarantine_interval = setInterval(this.hospitalized.bind(this), 1000);
            }
            setTimeout(this.removed.bind(this), this.param.infect_period * 1000);
        }, this.param.latent_period * 1000)
    }

    /*
        Hospitalizes this node
     */
    hospitalized() {
        if (simulation.nodes().filter(e => e.state === state.H).length >= this.param.hospitalization_max) return;
        if (this.state === state.R || this.state === state.H || !this.run) {
            clearInterval(this.quarantine_interval);
            return;
        }
        this.state = state.H;
        this.move(simulation.loc.by_name("hospital"));
        setTimeout(() => this.flag.push("hidden"), 500)
    }

    /*
        Removed node, either recovered or dead
     */
    removed() {
        if (!this.run) return;
        this.state = state.R;
        if (this.param.flag.includes("quarantine")) {
            this.move(simulation.loc.by_name("normal"));
            this.flag.splice(this.flag.indexOf("hidden"),1);
        }
        if (this.param.flag.includes("age") && Math.random() < this.param.age_death_rate[this.age]) {
            this.flag.push("dead");
        }
    }

    /*
        Recursively moves this node to school
     */
    to_school() {
        if (this.state === state.H) return;
        if (!this.run) return;
        this.move(simulation.loc.by_name("school"));
        setTimeout(this.from_school.bind(this), 2000);
    }

    /*
        Recursively moves this node from school
     */
    from_school() {
        if (this.state === state.H) return;
        if (!this.run) return;
        this.move(simulation.loc.by_name("normal"));
        setTimeout(this.to_school.bind(this), 2000);
    }

    /*
        Checks if this node exceeds given location range
     */
    check_loc() {
        if (this.x < this.loc.xrange[0] - 10 || this.x > this.loc.xrange[1] + 10) {
            this.x = d3.randomUniform(...this.loc.xrange)();
        }
        if (this.y < this.loc.yrange[0] - 10 || this.y > this.loc.yrange[1] + 10) {
            this.y = d3.randomUniform(...this.loc.yrange)();
        }
    }

}