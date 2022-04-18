/*ver.2022.03.07.02*/
importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode_game.js")
var running_time;
var simulation = {};

onmessage = function(event){
    console.log(event.data);
    switch (event.data.type) {
        case "START":
            let start_ret = startSim(event.data.params);
            apply_policy(event.data.policy);
            postMessage(start_ret);
            break;
        case "TICK":
            postMessage(reportSim(event.data.data));
            break;
        case "PAUSE":
            break;
        case "RESUME":
            simulation.nodes().forEach(node => node.updateAngle())
            apply_policy(event.data.data);
            break;
        case "STOP":
            postMessage(stopSim());
            break;
    }
}


var startSim = function(event_data) {
    let param = event_data;
    param.sim_height = param["sim_size"];
    param.sim_width = param["sim_size"];
    running_time = 0;
    simulation = null;

    var node_list = createNodes(param);

    simulation = d3.forceSimulation(node_list)
        .alphaDecay(0)
        .velocityDecay(0);

    simulation.param = param;

    /*
        Location settings
     */
    simulation.loc = new locs();
    simulation.loc.push(new simLoc("world", 0, 0, 0, simulation.param.sim_width, simulation.param.sim_height));

    simulation.nodes().forEach(node => node.move(simulation.loc.by_name("world")))

    simulation.force("surface", d3.forceSurface()
        .surfaces(simulation.loc.get_surface())
        .elasticity(1)
        .radius(param.size)
        .oneWay(false));

    //_.sample(simulation.nodes(), Math.floor(param.node_num * simulation.param.mask_ratio)).forEach(node => node.mask = true);
    simulation.find(param.sim_width / 2, simulation.param.sim_height / 2).infected();

    let report_nodes = [];
    simulation.nodes().forEach(node => {
        report_nodes.push({
            index: node.index,
            x: node.x,
            y: node.y,
            v: Math.sqrt(node.vx * node.vx + node.vy * node.vy),
            income: node.income,
            state: node.state,
            age: node.age,
            detail_age: node.detail_age,
            mask: node.mask,
            loc: node.loc,
            flag: node.flag
        });
    })
    simulation.stop();

    simulation.policyData = {
        area: {
            upper_left: {
                speed: [1,1,1]
            },
            upper_right: {
                speed: [1,1,1]
            },
            lower_left: {
                speed: [1,1,1]
            },
            lower_right: {
                speed: [1,1,1]
            }
        },
        border: {
            upper: 0,
            lower: 0,
            left: 0,
            right: 0
        },
        budget: 0,
        hospital_max: 0
    };
    simulation.updatePolicy = function () {
        let policy = simulation.policyData;
        simulation.nodes()
            .forEach(node => {
                node.speed(policy.area[node.isIn()][node.getAgeGroup()]);
                node.hospital_max = policy.hospital_max;
            });

        let surface = [
            {
            from: {
                x: simulation.param.sim_width / 2,
                y: simulation.param.sim_height * (1 - policy.border.upper) / 4},
            to: {
                x: simulation.param.sim_width / 2,
                y: simulation.param.sim_height * (1 + policy.border.upper) / 4}
        }, {
            from: {
                x: simulation.param.sim_width / 2,
                y: simulation.param.sim_height * (3 - policy.border.lower) / 4},
            to: {
                x: simulation.param.sim_width / 2,
                y: simulation.param.sim_height * (3 + policy.border.lower) / 4}
        }, {
            from: {
                x: simulation.param.sim_width * (1 - policy.border.left) / 4,
                y: simulation.param.sim_height / 2},
            to: {
                x: simulation.param.sim_width * (1 + policy.border.left) / 4,
                y: simulation.param.sim_height / 2}
        }, {
            from: {
                x: simulation.param.sim_width * (3 - policy.border.right) / 4,
                y: simulation.param.sim_height / 2},
            to: {
                x: simulation.param.sim_width * (3 + policy.border.right) / 4,
                y: simulation.param.sim_height / 2}
        }]
        simulation.force("surface").surfaces(surface);
    }
    return {type:"START_SUCCESS", main:report_nodes};
}

/*
    Calls when two nodes collide
 */
function collision (node1, node2) {
    // Collision event
    if (node1.state === state.S && (node2.state === state.E2 || node2.state === state.I1)) {
        if (Math.random() < TPC(node1)) {
            postMessage({type: "CONSOLE_LOG", data: "Infected"});
            node1.infected();
        } else {
            postMessage({type: "CONSOLE_LOG", data: "Not infected"});
        }
    }
}

/*
Transmission probability per contact
 */
function TPC (node1) {
    return simulation.param.TPC_base * simulation.param.age_infect[node1.age.toString()];
}

function ticked() {
    running_time += 1;
    simulation.tick();
    this.nodes().forEach(node1 => {
        this.nodes().forEach(node2 => {
            let a = (node1.x - node2.x), b = node1.y - node2.y;
            if (a*a+b*b < simulation.param.size*param.size*4)
                collision(node1, node2);
        })
    }, this);
    simulation.nodes().forEach(node => node.dispatch.call("tick", this));
    if (Math.ceil(running_time / (param.fps * simulation.param.turnUnit)) !== Math.ceil((running_time + 1) / (param.fps * simulation.param.turnUnit))) {
        postMessage({type:"PAUSE"});
    }
}

var stopSim = function() {
    simulation.nodes().forEach(node => node.run = false)
    return {type:"STOP", state:0};
}

var reportSim = function(iter) {
    for (let i=0;i<iter;i++) {
        ticked.call(simulation);
    }
    //ticked.call(simulation);
    let report_nodes = [];
    simulation.nodes().forEach(node => {
        report_nodes.push({
            index: node.index,
            x: node.x,
            y: node.y,
            v: Math.sqrt(node.vx * node.vx + node.vy * node.vy),
            income: node.income,
            state: node.state,
            age: node.age,
            detail_age: node.detail_age,
            mask: node.mask,
            vaccine: node.vaccine,
            loc: node.loc,
            flag: node.flag,
            queue: node.queue.length,
            tick: node.curTime
        });
    })
    return {type:"TICK", state:report_nodes, time: running_time};
}

function create_age_list (param) {
    let age_list = _.range(0, param.node_num);
    let dist_total = 0;
    for (let k in param["age_dist"]) {
        dist_total += param["age_dist"][k];
    }
    let age_dist = {};
    for (let k in param["age_dist"]) {
        age_dist[k] = (Math.ceil(param["age_dist"][k]/dist_total*param.node_num));
    }
    let acc = 0;
    for (let k in age_dist) {
        age_list.fill(k, acc, acc + age_dist[k]);
        acc += age_dist[k];
    }
    return d3.shuffle(age_list);
}

/*
Create nodes and assign initial values
 */
function createNodes (param) {
    let _nodes = [];

    // Assigns age factor for each node
    let age_list = create_age_list(param);

    // Initialize node value
    for (let i = 0; i < param.node_num; i++) {
        _nodes.push(new Node(param, param.sim_width, param.sim_height, i, age_list[i]));
    }

    // console.log(_nodes);
    return _nodes;
}

function apply_policy(policy) {
    simulation.policyData = policy;
    simulation.updatePolicy();
}
