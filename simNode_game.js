const state = {
    S: "#98E294", // Susceptible
    E1: "#FFE054", // Exposed, non_infectious
    E2: "#FF9900", // Exposed, infectious
    I1: "#C00000", // Infectious, mild
    I2: "#FF00FF", // Infectious, severe
    H1: "#C0C0C0", // Self-quarantine
    H2: "#5260d0", // Hospitalized
    R1: "#254488", // Recovered
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
        let speed = param.speed * param.age_speed[age];

        // Variables
        this.multiplier = 1;
        this.index = index;
        this.x = d3.randomUniform(width * 0.1, width * 0.9)();
        this.y = d3.randomUniform(height * 0.1, height * 0.9)();
        this.vx = speed * Math.cos(angle);
        this.vy = speed * Math.sin(angle);

        this.state = state.S;
        this.age = age;
        this.mask = false;
        this.loc = "World";
        this.flag = [];
        this.param = param;
        this.run = true;

        this.curTime = 0;
        this.queue = [];

        this.dispatch = d3.dispatch("tick", "change");

        this.dispatch.on("tick.time", () => {
            this.curTime += 1;
            if (this.queue.length > 0) {
                this.queue.forEach((task, i) => {
                    if (this.curTime >= task.time) {
                        this.dispatch.call("change", this, task);
                        task.mark_for_delete = true;
                    }
                })
            }
            this.queue = this.queue.filter(task => !task.hasOwnProperty("mark_for_delete"));
        });

        this.dispatch.on("change.state", task => {
            task.func.apply(this, task.args);
        })
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
        this.state = state.E1;
        this.queue.push({
            time: d3.randomUniform(...this.param.duration["E1-E2"])() * this.param.fps + this.curTime,
            func: this.change_state,
            args: ["E1", "E2"]
        });
    }

    change_state (from, to) {
        switch (from + "-" + to) {
            case "E1-E2":
                if (this.state !== state.E1) return;
                this.state = state.E2;
                this.queue.push({
                    time: d3.randomUniform(...this.param.duration["E2-I1"])() * this.param.fps + this.curTime,
                    func: this.change_state,
                    args: ["E2", "I1"]
                });
                break;
            case "E2-I1":
                if (this.state !== state.E2) return;
                this.state = state.I1;
                if (Math.random() < this.param.age_severe[this.age.toString()]) {
                    this.queue.push({
                        time: d3.randomUniform(...this.param.duration["I1-I2"])() * this.param.fps + this.curTime,
                        func: this.change_state,
                        args: ["I1", "I2"]
                    });
                } else {
                    this.queue.push({
                        time: d3.randomUniform(...this.param.duration["I1-H1"])() * this.param.fps + this.curTime,
                        func: this.change_state,
                        args: ["I1", "H1"]});
                    this.queue.push({
                        time: d3.randomUniform(...this.param.duration["I1-R1"])() * this.param.fps + this.curTime,
                        func: this.change_state,
                        args: ["I1", "R1"]
                    });
                }
                break;
            case "I1-I2":
                if (this.state !== state.I1 && this.state !== state.H1) return;
                this.state = state.I2;
                this.queue.push({
                    time: d3.randomUniform(...this.param.duration["I2-H2"])() * this.param.fps + this.curTime,
                    func: this.change_state,
                    args: ["I2", "H2"]
                });
                this.queue.push({
                    time: d3.randomUniform(...this.param.duration["I2-R2"])() * this.param.fps + this.curTime,
                    func: this.change_state,
                    args: ["I2", "R2"]
                })
                break;
            case "I1-H1":
                if (this.state !== state.I1) return;
                this.state = state.H1;
                break;
            case "I1-R1":
                if (this.state !== state.I1 && this.state !== state.H1) return;
                this.state = state.R1;
                break;
            case "I2-H2":
                if (this.state !== state.I2) return;
                if (simulation.nodes().filter(e => e.state === state.H2).length >= this.param["hospital_max"]) {
                    this.queue.push({
                        time: d3.randomUniform(...this.param.duration["I2-H2"])() * this.param.fps + this.curTime,
                        func: this.change_state,
                        args: ["I2", "H2"]
                    });
                } else {
                    this.state = state.H2;
                    this._vx = this.vx;
                    this._vy = this.vy;
                    this.vx = 0;
                    this.vy = 0;
                    this.queue.push({
                        time: d3.randomUniform(...this.param.duration["H2-R1"])() * this.param.fps + this.curTime,
                        func: this.change_state,
                        args: ["H2", "R1"]
                    });
                    this.queue[this.queue.findIndex(task => task.args[1] === "R2")].mark_for_delete = true;
                }
                break;
            case "I2-R2":
                if (this.state !== state.I2 && this.state !== state.H2) return;
                this.state = state.R2;
                this.vx = 0;
                this.vy = 0;
                break;
            case "H2-R1":
                if (this.state !== state.H2) return;
                this.state = state.R1;
                this.vx = this._vx;
                this.vy = this._vy;
                this._vx = null;
                this._vy = null;
                break;
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

    speed (multiplier) {
        this.vx = this.vx / this.multiplier * multiplier;
        this.vy = this.vy / this.multiplier * multiplier;
        this.multiplier = multiplier;
    }

}