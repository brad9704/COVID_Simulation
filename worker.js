importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode.js")
var running_time = 0;

onmessage = function(event){
    if (event.data.type === "START") {
        postMessage(startSim(event.data.main));
    }
    else if (event.data.type === "STOP") {
        postMessage(stopSim());
    }
    else if (event.data.type === "REPORT") {
        postMessage(reportSim());
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

var simulation;

function create_age_list (param) {
    let age_list = _.range(0, param.node_num);
    let dist_total = 0;
    for (let [k, v] in param["age_distribution"]) {
        dist_total += v;
    }
    let age_dist = {};
    for (let [k, v] in param["age_distribution"]) {
        if (param["age_distribution"].hasOwnProperty(k))
            age_dist[k] = (Math.ceil(v/dist_total*param.node_num));
    }
    let acc = 0;
    for (let [k,v] in age_dist) {
        age_list.fill(k, acc, acc + v);
        acc += v;
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
        _nodes.push(new Node(param, param["sim_size"][0], param["sim_size"][1], i, age_list[i]));
    }

    // console.log(_nodes);
    return _nodes;
}


var startSim = function(param) {
    /*
        Assertion for necessary parameters
    */
    function assertion (param) {
        for (let key of ["sim_count", "sim_size",
            "flag", "node_num", "speed", "size",
            "initial_patient", "latent_period",
            "infect_period", "TPC_base"]) {
            console.assert(param.hasOwnProperty(key));
        }
        if (param["flag"].includes("mask")) {
            console.assert(param.hasOwnProperty("mask_ratio"));
            console.assert(param.hasOwnProperty("mask_factor"));
        }
        if (param["flag"].includes("quarantine")) {
            console.assert(param.hasOwnProperty("hospitalized_rate"));
            console.assert(param.hasOwnProperty("hospitalization_max"));
        }
        if (param["flag"].includes("distance")) {
            console.assert(param.hasOwnProperty("social_distancing_strength"));
        }
        if (param["flag"].includes("age")) {
            console.assert(param.hasOwnProperty("age_distribution"));
            console.assert(param.hasOwnProperty("age_vulnerability"));
            console.assert(param.hasOwnProperty("age_death_rate"));
        }
    }

    assertion(param);

    var node_list = createNodes(param);

    simulation = d3.forceSimulation(node_list)
        .alphaDecay(0)
        .velocityDecay(0);

    /*
        Location settings
     */
    simulation.loc = new locs();
    simulation.loc.push(new simlocation("world", 0, 0, 0, param["sim_size"][0], param["sim_size"][1]));
    if (param["sim_count"] > 1) {
        Loop: for (let v = 0; v < 4; v++) {
            for (let h = 0; h < 4; h++) {
                simulation.loc.push(new simlocation(
                    "normal", v * 4 + h + 1,
                    param["sim_size"][0] / 4 * h, param["sim_size"][1] / 4 * v,
                    param["sim_size"][0] / 4, param["sim_size"][1] / 4));
                if (v * 4 + h + 1 >= param["sim_count"]) break Loop;
            }
        }
        if (param["flag"].includes("quarantine")) simulation.loc.by_index(1).name = "hospital";
        if (param["flag"].includes("age")) simulation.loc.by_index(2).name = "school";
    } else {
        if (param["flag"].includes("quarantine")) simulation.loc.push(new simlocation(
            "hospital", 1, 0, 0, param["sim_size"][0] * 0.2, param["sim_size"][1] * 0.2));
        if (param["flag"].includes("age")) simulation.loc.push(new simlocation(
            "school", simulation.loc.length, param["sim_size"][0] * 0.8, 0, param["sim_size"][0] * 0.2, param["sim_size"][1] * 0.2));
        if (simulation.loc.length > 1) simulation.loc.push(new simlocation(
            "normal", simulation.loc.length, 0, param["sim_size"][1] * 0.2, param["sim_size"][0], param["sim_size"][1] * 0.8));
        else simulation.loc.push(new simlocation(
            "normal", simulation.loc.length, 0, 0, param["sim_size"][0], param["sim_size"][1]));
    }

    simulation.nodes().forEach(node => node.move(simulation.loc.by_name("normal")))

    /*
        Calls when two nodes collide
     */
    function collision (node1, node2) {
        // Collision event
        if (node1.state === state.S && (node2.state === state.E || node2.state === state.I)) {
            if (Math.random() < TPC(node1,node2)) {
                node1.infected();
            }
        }
        else if ((node1.state === state.E || node1.state === state.I) && node2.state === state.S) {
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
        if (param["flag"].includes("age")) {
            tpc *= param["age_vulnerability"][node1.age.toString()]
        }
        if (param["flag"].includes("mask")) {
            if (node1.mask) tpc *= param.mask_factor;
            if (node2.mask) tpc *= param.mask_factor;
        }
        if (!param["flag"].includes("collision")) tpc /= 30;
        return tpc;
    }

    if (param["flag"].includes("collision")) {
        simulation.force("collide", d3.forceBounce()
            .elasticity(1)
            .radius(param["size"])
            .onImpact(collision));
    } else {
        simulation.on("tick.impact", function() {
            this.nodes().forEach(node1 => {
                this.nodes().forEach(node2 => {
                    if (Math.hypot(node1.x - node2.x, node1.y - node2.y) < param["size"])
                        collision(node1, node2);
                })
            }, this)
        });

    }
    if (param["flag"].includes("distance")) {
        simulation.force("charge", d3.forceManyBody()
            .strength(-1 * param.social_distancing_strength))
    }

    simulation.force("surface", d3.forceSurface()
        .surfaces(simulation.loc.get_surface())
        .elasticity(1)
        .radius(param["size"])
        .oneWay(false));
    simulation.on("tick.check_loc", function() { this.nodes().forEach(node => node.check_loc())});

    if (param["flag"].includes("mask"))
        _.sample(simulation.nodes(), param.mask_ratio).forEach(node => node.mask = true);
    _.sample(simulation.nodes(), param.initial_patient).forEach(node => node.infected());

    if (param["flag"].includes("age")) simulation.nodes().forEach(node => {
        if (node.age < 20) node.to_school();
    })

    return {type:"START", state:simulation.nodes(), time: new Date().getTime(), loc: simulation.loc};
}

var stopSim = function() {
    simulation.stop();
    return {type:"STOP", state:0};
}

var reportSim = function() {
    return {type:"REPORT", state:simulation.nodes(), time: new Date().getTime()};
}