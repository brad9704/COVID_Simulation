importScripts("https://d3js.org/d3.v5.min.js",
    "//unpkg.com/d3-force-bounce/dist/d3-force-bounce.min.js",
    "//unpkg.com/d3-force-surface/dist/d3-force-surface.min.js",
    "//unpkg.com/underscore@1.12.0/underscore-min.js",
    "simNode.js")
var running_time = 0;

onmessage = function(event){
    if (event.data.type === "START") {
        postMessage(startSim(event.data.main))
    }
    else if (event.data.type === "STOP") {
        postMessage(stopSim(event.data.main))
    }
    else if (event.data.type === "REPORT") {
        postMessage(reportSim(event.data.main))
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
        age_distribution: ["10-19": {float}, "20-39": {float}, "40-64": {float}, "65+": {float}]
        age_vulnerability: ["10-19": {float}, "20-39": {float}, "40-64": {float}, "65+": {float}]
        age_death_rate: ["10-19":[0,1], "20-39":[0,1], "40-64":[0,1], "65+":[0,1]]

        // Flag "quarantine" settings
        hospitalized_rate: {float} in [0, 1]
        hospitalization_max: {int}

        // Flag "distance" settings
        social_distancing_strength: {float} > 0

        // Flag "vaccine" settings
    }
*/

var simulation;

function age_list () {
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
function createNodes () {
    let _nodes = [];

    // Assigns age factor for each node
    let age_list = age_list();

    // Initialize node value
    for (let i = 0; i < param.node_num; i++) {
        _nodes.push(new Node(param["sim_size"][0], param["sim_size"][1], i, age_list[i]));
    }

    // console.log(_nodes);
    return _nodes;
}


var startSim = function(param) {
    /*
        Assertion for necessary parameters
    */
    function assertion (param) {
        for (let key in ["sim_count", "sim_size",
            "flag", "node_num", "speed", "size",
            "initial_patient", "latent_period",
            "infect_period", "TPC_base"]) {
            console.assert(param.hasOwnProperty(key));
        }
        if ("mask" in param["flag"]) {
            console.assert(param.hasOwnProperty("mask_ratio"));
            console.assert(param.hasOwnProperty("mask_factor"));
        }
        if ("quarantine" in param["flag"]) {
            console.assert(param.hasOwnProperty("hospitalized_rate"));
            console.assert(param.hasOwnProperty("hospitalization_max"));
        }
        if ("distance" in param["flag"]) {
            console.assert(param.hasOwnProperty("social_distancing_strength"));
        }
        if ("age" in param["flag"]) {
            console.assert(param.hasOwnProperty("age_distribution"));
            console.assert(param.hasOwnProperty("age_vulnerability"));
            console.assert(param.hasOwnProperty("age_death_rate"));
        }
    }

    assertion();

    var node_list = createNodes();

    simulation = d3.forceSimulation(node_list)
        .alphaDecay(0)
        .velocityDecay(0);

    /*
        Location settings
     */
    simulation.loc = [];
    simulation.loc.push({loc_count: 0,
        xrange: [0, param["sim_size"][0]],
        yrange: [0, param["sim_size"][1]],
        surface: [
            {from: {x:0, y:0}, to: {x:param["sim_size"][0], y:0}},
            {from: {x:param["sim_size"][0], y:0}, to: {x:param["sim_size"][0], y:param["sim_size"][1]}},
            {from: {x:param["sim_size"][0], y:param["sim_size"][1]}, to: {x:0, y:param["sim_size"][1]}},
            {from: {x:0, y:param["sim_size"][1]}, to: {x:0, y:0}}
        ]});
    if (param["sim_count"] > 1) {
        Loop: for (let v = 0; v < 4; v++) {
            for (let h = 0; h < 4; h++) {
                simulation.loc.push({loc_count: v * 4 + h + 1,
                    xrange: [param["sim_size"][0] / 4 * h, param["sim_size"][0] / 4 * (h + 1)],
                    yrange: [param["sim_size"][1] / 4 * v, param["sim_size"][1] / 4 * (v + 1)],
                    surface: [{from: {x: param["sim_size"][0] / 4 * h, y: param["sim_size"][1] / 4 * v}, to: {x: param["sim_size"][0] / 4 * (h + 1), y: param["sim_size"][1] / 4 * v}},
                        {from: {x: param["sim_size"][0] / 4 * (h + 1), y: param["sim_size"][1] / 4 * v}, to: {x: param["sim_size"][0] / 4 * (h + 1), y: param["sim_size"][1] / 4 * (v + 1)}},
                        {from: {x: param["sim_size"][0] / 4 * (h + 1), y: param["sim_size"][1] / 4 * (v + 1)}, to: {x: param["sim_size"][0] / 4 * h, y: param["sim_size"][1] / 4 * (v + 1)}},
                        {from: {x: param["sim_size"][0] / 4 * h, y: param["sim_size"][1] / 4 * (v + 1)}, to: {x: param["sim_size"][0] / 4 * (h + 1), y: param["sim_size"][1] / 4 * v}}]});
                if (v * 4 + h + 1 >= param["sim_count"]) break Loop;
            }
        }
    }

    function get_surface() {
        return Array.from(simulation.loc, e => e.surface);
    }

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
        if ("age" in param["flag"]) {
            tpc *= param["age_vulnerability"][node1.age]
        }
        if (node1.mask) tpc *= param.mask_factor;
        if (node2.mask) tpc *= param.mask_factor;
        return tpc;
    }

    if ("collision" in param["sim_flag"]) {
        simulation.force("collide", d3.forceBounce()
            .elasticity(1)
            .onImpact(collision))
    } else {
        simulation.force("collide", d3.forceCollide()
            .strength(0)
            .onImpact(collision))
    }
    if ("distance" in param["sim_flag"]) {
        simulation.force("charge", d3.forceManyBody()
            .strength(-1 * param.social_distancing_strength))
    }

    simulation.force("surface", d3.forceSurface()
        .surfaces(get_surface(param))
        .elasticity(1)
        .radius(param.size)
        .oneWay(true));

    _.sample(simulation.nodes(), param.mask_ratio).forEach(node => node.mask = true);
    _.sample(simulation.nodes(), param.initial_patient).forEach(node => node.infected());
    running_time = new Date().getTime();


}

var stopSim = function(param) {
    simulation.stop();
}

var reportSim = function(param) {
    let node_data = simulation.nodes();
    return {
        "tick": (new Date().getTime() - running_time) / 1000,
        "S": node_data.filter(e => e.state === state.S).length,
        "E": node_data.filter(e => e.state === state.E).length,
        "I": node_data.filter(e => e.state === state.I).length,
        "H": node_data.filter(e => e.state === state.H).length,
        "R": node_data.filter(e => e.state === state.R).length
    };
}