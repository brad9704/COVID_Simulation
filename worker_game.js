importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode_game.js")
var running_time;
var simulation;
var param;

onmessage = function(event){
    switch (event.data.type) {
        case "START":
            postMessage(startSim(event.data.main));
            break;
        case "PAUSE":
            pauseSim();
            break;
        case "RESUME":
            resumeSim(event.data.main);
            break;
        case "STOP":
            postMessage(stopSim());
            break;
        case "REPORT":
            postMessage(reportSim());
            break;
    }
}

/*
Event data consists of:
    type = one of ("START","STOP","REPORT")
    //In case of type "START"
    main = {
        sim_count = 1 or 3 or 16
        sim_size = [width,height]
        flag = subset of ("age", "mask", "collision", "quarantine", "distance", "vaccine")

        // General simulation settings
        node_num: {int}
        speed: {float}
        size: {float}
        initial_patient: {int}

        // Epidemic settings
        latent_period: {float}
        infect_period: {float}
        TPC_base: {float} in [0, 1]

        // Mask settings
        mask_ratio: {float} in [0, 1] represents how much of population will wear mask
        mask_factor: {float} in [0, 1] represents how much wearing mask would affect

        // Flag "age" settings
        age_distribution: ["10": {float}, "20": {float}, "40": {float}, "65": {float}]
        age_vulnerability: ["10": {float}, "20": {float}, "40": {float}, "65": {float}]
        age_death_rate: ["10":[0,1], "20":[0,1], "40":[0,1], "65":[0,1]]

        // Flag "quarantine" settings
        hospitalized_rate: {float} in [0, 1]
        hospitalization_max: {int}

        // Flag "distance" settings
        social_distancing_strength: {float} > 0

        // Flag "vaccine" settings
    }
*/


var startSim = function(event_data) {
    /*
        Assertion for necessary parameters
    */
    function assertion (event_data) {
        for (let key of ["sim_width", "sim_height", "size", "timeunit", "mask_factor", "duration", "age_dist", "age_infect", "age_severe",
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
    /*
        Calls when two nodes collide
     */
    function collision (node1, node2) {
        // Collision event
        if (node1.state === state.S && (node2.state === state.E2 || node2.state === state.I1)) {
            if (Math.random() < TPC(node1,node2)) {
                node1.infected();
            }
        }
        else if ((node1.state === state.E2 || node1.state === state.I1) && node2.state === state.S) {
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

    simulation.on("tick.impact", function() {
        this.nodes().forEach(node1 => {
            this.nodes().forEach(node2 => {
                if (Math.hypot(node1.x - node2.x, node1.y - node2.y) < param.size)
                    collision(node1, node2);
            })
        }, this)
    });

    simulation.force("surface", d3.forceSurface()
        .surfaces(simulation.loc.get_surface())
        .elasticity(1)
        .radius(param.size)
        .oneWay(false));
    simulation.on("tick.check_loc", function() { this.nodes().forEach(node => node.check_loc())});

    //_.sample(simulation.nodes(), Math.floor(param.node_num * param.mask_ratio)).forEach(node => node.mask = true);
    _.sample(simulation.nodes(), param.initial_patient).forEach(node => node.infected());

    let report_nodes = [];
    simulation.nodes().forEach(node => {
        report_nodes.push({
            index: node.index,
            x: node.x,
            y: node.y,
            state: node.state,
            age: node.age,
            mask: node.mask,
            loc: node.loc,
            flag: node.flag,
            isQuarantined: node.isQuarantined
        })
    })

    return {type:"START", state:report_nodes, time: new Date().getTime(), loc: simulation.loc};
}

var pauseSim = function() {
    simulation.nodes().forEach(node => node.pause())
    simulation.stop();
}

var resumeSim = function(event_data) {
    simulation.nodes().forEach(node => node.resume())
    simulation.restart();
}

var stopSim = function() {
    simulation.stop();
    simulation.nodes().forEach(node => node.run = false)
    return {type:"STOP", state:0};
}

var reportSim = function() {
    let report_nodes = [];
    simulation.nodes().forEach(node => {
        report_nodes.push({
            index: node.index,
            x: node.x,
            y: node.y,
            state: node.state,
            age: node.age,
            mask: node.mask,
            loc: node.loc,
            flag: node.flag,
            isQuarantined: node.isQuarantined
        })
    })
    return {type:"REPORT", state:report_nodes, time: new Date().getTime()};
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




