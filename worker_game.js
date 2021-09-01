importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode_game.js")
var running_time;
var simulation;
var param;
var chart_data;
var policy_setting = {
    mask: false,
    lock: false,
    curfew: false,
    online: false
};

onmessage = function(event){
    switch (event.data.type) {
        case "START":
            postMessage(startSim(event.data.main));
            break;
        case "PAUSE":
            break;
        case "RESUME":
            let policy = _.mapObject(policy_setting, (value, key) => {
                return ([value !== event.data.data[key], event.data.data[key]]);
            })
            policy_setting = event.data.data;
            apply_policy(policy);
            break;
        case "STOP":
            postMessage(stopSim());
            break;
        case "REPORT":
            postMessage(reportSim(event.data.data));
            break;
        case "LOG":
            postMessage({type: "LOG", data: chart_data});
            break;
    }
}


var startSim = function(event_data) {
    /*
        Assertion for necessary parameters
    */
    function assertion (event_data) {
        for (let key of ["sim_width", "sim_height", "size", "timeunit", "fps", "mask_factor", "duration", "age_dist", "age_infect", "age_severe",
        "node_num", "initial_patient", "speed", "TPC_base", "hospital_max"]) {
            console.assert(event_data.hasOwnProperty(key));
        }
    }
    assertion(event_data);
    param = event_data;
    chart_data = [];
    running_time = 0;
    simulation = null;

    var node_list = createNodes();

    simulation = d3.forceSimulation(node_list)
        .alphaDecay(0)
        .velocityDecay(0);

    /*
        Location settings
     */
    simulation.loc = new locs();
    simulation.loc.push(new simLoc("world", 0, 0, 0, param.sim_width, param.sim_height));

    simulation.nodes().forEach(node => node.move(simulation.loc.by_name("world")))

    simulation.force("surface", d3.forceSurface()
        .surfaces(simulation.loc.get_surface())
        .elasticity(1)
        .radius(param.size)
        .oneWay(false));

    //_.sample(simulation.nodes(), Math.floor(param.node_num * param.mask_ratio)).forEach(node => node.mask = true);
    _.sample(simulation.nodes(), param.initial_patient).forEach(node => node.infected());

    let report_nodes = [];
    simulation.nodes().forEach(node => {
        report_nodes.push({
            index: node.index,
            x: node.x,
            y: node.y,
            v: Math.hypot(node.vx, node.vy),
            state: node.state,
            age: node.age,
            mask: node.mask,
            loc: node.loc,
            flag: node.flag
        });
    })
    simulation.stop();
    return {type:"START", state:report_nodes, time: running_time, loc: simulation.loc};
}

/*
    Calls when two nodes collide
 */
function collision (node1, node2) {
    // Collision event
    if (node1.state === state.S && (node2.state === state.E2 || node2.state === state.I1 || node2.state === state.H1)) {
        if (Math.random() < TPC(node1,node2)) {
            node1.infected();
        }
    }
    else if ((node1.state === state.E2 || node1.state === state.I1 || node1.state === state.H1) && node2.state === state.S) {
        if (Math.random() < TPC(node1,node2)) {
            node2.infected();
        }
    }
}

/*
Transmission probability per contact
 */
const TPC = function(node1, node2) {
    let tpc = param.TPC_base;
    tpc *= param.age_infect[node1.age.toString()]
    if (node1.mask) tpc *= param.mask_factor;
    if (node2.mask) tpc *= param.mask_factor;
    return tpc;
}

function ticked() {
    running_time += 1;
    simulation.tick();
    this.nodes().forEach(node1 => {
        this.nodes().forEach(node2 => {
            if (Math.hypot(node1.x - node2.x, node1.y - node2.y) < param.size * 2)
                collision(node1, node2);
            })
    }, this);
    simulation.nodes().forEach(node => node.dispatch.call("tick", this));

    if (running_time % param.fps === 0) {
        let node_data = simulation.nodes();
        chart_data.push({
            "tick": running_time / param.fps,
            "S": node_data.filter(e => e.state === state.S).length,
            "E1": node_data.filter(e => e.state === state.E1).length,
            "E2": node_data.filter(e => e.state === state.E2).length,
            "I1": node_data.filter(e => e.state === state.I1).length,
            "I2": node_data.filter(e => e.state === state.I2).length,
            "H1": node_data.filter(e => e.state === state.H1).length,
            "H2": node_data.filter(e => e.state === state.H2).length,
            "R1": node_data.filter(e => e.state === state.R1).length,
            "R2": node_data.filter(e => e.state === state.R2).length,
            "GDP": node_data.filter(e => e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + curr.v, 0) / 2
        });
    }
    if (Math.ceil(running_time / (param.fps * param.turnUnit)) !== Math.ceil((running_time + 1) / (param.fps * param.turnUnit))) {
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
            v: Math.hypot(node.vx, node.vy),
            state: node.state,
            age: node.age,
            mask: node.mask,
            loc: node.loc,
            flag: node.flag,
            queue: node.queue.length,
            tick: node.curTime
        });
    })
    return {type:"REPORT", state:report_nodes, time: running_time};
}

function create_age_list () {
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
function createNodes () {
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
    if (policy.mask[0] && policy.mask[1]) {
        simulation.nodes().forEach(node => {
            node.mask = true;
        })
    } else if (policy.mask[0]){
        simulation.nodes().forEach(node => {
            node.mask = false;
        })
    }
    if (policy.lock[0] && policy.lock[1]) {
        simulation.nodes().forEach(node => {
            node.speed(param.lockdown_factor);
        })
    } else if (policy.lock[0]){
        simulation.nodes().forEach(node => {
            node.speed(1 / param.lockdown_factor);
        })
    }
    if (policy.curfew[0] && policy.curfew[1]) {
        simulation.nodes().filter(node => node.age > 10 && node.age < 60).forEach(node => {
            node.speed(param.curfew_factor);
        })
    } else if (policy.curfew[0]) {
        simulation.nodes().filter(node => node.age > 10 && node.age < 60).forEach(node => {
            node.speed(1 / param.curfew_factor);
        })
    }
    if (policy.online[0] && policy.online[1]) {
        simulation.nodes().filter(node => node.age < 20).forEach(node => {
            node.speed(param.online_factor);
        })
    } else if (policy.online[0]) {
        simulation.nodes().filter(node => node.age < 20).forEach(node => {
            node.speed(1 / param.online_factor);
        })
    }
}


