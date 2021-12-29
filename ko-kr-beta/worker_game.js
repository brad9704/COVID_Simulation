importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode_game.js")
var running_time;
var simulation;
var param;
var budget;

onmessage = function(event){
    switch (event.data.type) {
        case "START":
            budget = event.data.budget;
            postMessage(startSim(event.data.main));
            break;
        case "PAUSE":
            break;
        case "RESUME":
            apply_policy(event.data.data);
            break;
        case "STOP":
            postMessage(stopSim());
            break;
        case "REPORT":
            postMessage(reportSim(event.data.data));
            break;
    }
}


var startSim = function(event_data) {
    /*
        Assertion for necessary parameters
    */
    function assertion (event_data) {
        for (let key of ["sim_width", "sim_height", "size", "timeunit", "fps", "duration", "age_dist", "age_infect", "age_severe",
            "node_num", "initial_patient", "speed", "TPC_base", "hospital_max"]) {
            console.assert(event_data.hasOwnProperty(key));
        }
    }
    assertion(event_data);
    param = event_data;
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
    simulation.find(param.sim_width / 2, param.sim_height / 2).infected();

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
    return param.TPC_base * param.age_infect[node1.age.toString()];
}

function ticked() {
    running_time += 1;
    simulation.tick();
    this.nodes().forEach(node1 => {
        this.nodes().forEach(node2 => {
            let a = (node1.x - node2.x), b = node1.y - node2.y;
            if (a*a+b*b < param.size*param.size*4)
                collision(node1, node2);
        })
    }, this);
    simulation.nodes().forEach(node => node.dispatch.call("tick", this));
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
            v: Math.sqrt(node.vx * node.vx + node.vy * node.vy),
            income: node.income,
            state: node.state,
            age: node.age,
            mask: node.mask,
            vaccine: node.vaccine,
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
    for (let i in policy.age) {
        simulation.nodes()
            .filter(node => node.age === i)
            .forEach(node => {
                node.speed(policy.age[i][policy.area[node.isIn()]])
            });
        simulation.nodes().forEach(node => {
            node.param.hospital_max = policy.hospital_max;
        })
    }
    let temp = simulation.loc.get_surface(), line_rate = policy.rate;
    if (policy.surface.upper === "1") temp.push({
        from: {x: param.sim_width / 2, y: param.sim_height * (1 - line_rate) / 4}, to: {x: param.sim_width / 2, y: param.sim_height * (1 + line_rate) / 4}
    });
    if (policy.surface.lower === "1") temp.push({
        from: {x: param.sim_width / 2, y: param.sim_height * (3 - line_rate) / 4}, to: {x: param.sim_width / 2, y: param.sim_height * (3 + line_rate) / 4}
    });
    if (policy.surface.left === "1") temp.push({
        from: {x: param.sim_width * (1 - line_rate) / 4, y: param.sim_height / 2}, to: {x: param.sim_width * (1 + line_rate) / 4, y: param.sim_height / 2}
    });
    if (policy.surface.right === "1") temp.push({
        from: {x: param.sim_width * (3 - line_rate) / 4, y: param.sim_height / 2}, to: {x: param.sim_width * (3 + line_rate) / 4, y: param.sim_height / 2}
    });
    simulation.force("surface").surfaces(temp);
}
