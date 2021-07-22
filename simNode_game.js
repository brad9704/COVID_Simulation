const state = {
    S: "#00FF00", // Susceptible
    E1: "#FFFF00", // Exposed, non_infectious
    E2: "#FF9900", // Exposed, infectious
    I1: "#FF0000", // Infectious, mild
    I2: "#FF00FF", // Infectious, severe
    H1: "#C0C0C0", // Self-quarantine
    H2: "#505050", // Hospitalized
    R1: "#0000FF", // Recovered
    R2: "#000000" // Dead
};

class simLoc {
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
        this.state_timeout = {
            id: null,
            func: null,
            delay: null,
            startTime: null
        };
        this.age = age;
        this.mask = false;
        this.loc = "World";
        this.flag = [];
        this.param = param;
        this.run = true;
        this.quarantine_interval = null;
        this.quarantine_delay = null;
        this.isQuarantined = false;
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
        this.state = state.E1;
        this.state_timeout.func = () => {
            this.state = state.I1;
            this.state_timeout.delay = d3.randomUniform(...this.param.duration["I1-H1"])() * this.param.timeunit;
            this.state_timeout.startTime = new Date().getTime();
            this.state_timeout.func = () => {
                this.state = state.H1;
                let next_phase = (Math.random() > this.param.age_severe[this.age.toString()]) ? state.R1 : state.I2;
                if (next_phase === state.R1) {
                    this.state_timeout.delay = d3.randomUniform(...this.param.duration["H1-R1"])() * this.param.timeunit;
                    this.state_timeout.startTime = new Date().getTime();
                    this.state_timeout.func = () => {
                        this.state = state.R1;
                    }
                } else {
                    this.state_timeout.delay = d3.randomUniform(...this.param.duration["H1-I2"])() * this.param.timeunit;
                    this.state_timeout.startTime = new Date().getTime();
                    this.state_timeout.func = () => {
                        this.state = state.I2;
                        this.state_timeout.id = null;
                        this.state_timeout.delay = d3.randomUniform(...this.param.duration["I2-R2"]) * this.param.timeunit;
                        this.quarantine_delay = this.param.timeunit / 2;
                        this.state_timeout.startTime = new Date().getTime();
                        this.quarantine_interval = setInterval(this.hospitalized.bind(this), this.quarantine_delay);
                        this.state_timeout.func = () => {
                            clearInterval(this.quarantine_interval);
                            this.quarantine_interval = null;
                            this.state = state.R2;
                        }
                        this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
                    }
                }
                this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
            }
            this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
        };
        this.state_timeout.delay = d3.randomUniform(...this.param.duration["E1-E2"])() * this.param.timeunit;
        this.state_timeout.startTime = new Date().getTime();
        this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
    }

    /*
        Hospitalizes this node
     */
    hospitalized() {
        if (simulation.nodes().filter(e => e.state === state.H2).length >= this.param["hospital_max"]) return;
        if (this.state !== state.I2 || !this.run) {
            clearInterval(this.quarantine_interval);
            return;
        }
        this.state = state.H2;
        this.isQuarantined = true;
        clearInterval(this.quarantine_interval);
        if (this.state_timeout.id != null) {
            clearTimeout(this.state_timeout.id);
        }
        this.state_timeout.delay = d3.randomUniform(...this.param.duration["H2-R1"])() * this.param.timeunit;
        this.state_timeout.startTime = new Date().getTime();
        this.state_timeout.func = () => {
            this.state = state.R1;
        }
        this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
    }

    pause() {
        if (this.quarantine_interval === null && this.state_timeout.id === null) return;
        else if (this.quarantine_interval != null) {
            clearInterval(this.quarantine_interval);
            this.quarantine_delay -= (new Date().getTime() - this.state_timeout.startTime) % (this.param.timeunit / 2);
        }
        clearTimeout(this.state_timeout.id);
        this.state_timeout.delay -= (new Date().getTime() - this.state_timeout.startTime);
    }

    resume() {
        if (this.quarantine_delay === null && this.state_timeout.func === null) return;
        else if (this.quarantine_delay != null) {
            this.state_timeout.startTime = new Date().getTime();
            setTimeout(() => {this.quarantine_interval = setInterval(this.hospitalized.bind(this), this.param.timeunit / 2);}, this.quarantine_delay);
        }
        if (this.state_timeout.func != null) {
            this.state_timeout.startTime = new Date().getTime();
            this.state_timeout.id = setTimeout(this.state_timeout.func.bind(this), this.state_timeout.delay);
        }
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